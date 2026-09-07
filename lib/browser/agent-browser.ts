import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { connect, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";

// The version-pinned agent-browser Rust daemon executes every AI interaction.
// Own a foreground child instead of the CLI's detached auto-start daemon so
// Electron's supervisor can reliably track and clean it up, including crashes.
export class AgentBrowserExecutor {
  private child: ChildProcess | undefined;
  private directory = "";
  private stopped = false;
  private readonly sockets = new Set<Socket>();
  private exited: Promise<void> = Promise.resolve();

  async start(cdpUrl: string, targetId: string, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    const require = createRequire(join(process.cwd(), "package.json"));
    const root = dirname(require.resolve("agent-browser/package.json"));
    const executable = join(root, "bin", `agent-browser-${process.platform}-${process.arch}`);
    if (!existsSync(executable)) throw new Error("agent-browser 未安装完整，请运行 npm ci --legacy-peer-deps。");
    // Unix socket paths have a short length limit on macOS.
    this.directory = mkdtempSync(join(tmpdir(), "ab-"));
    this.child = spawn(executable, [], {
      cwd: this.directory,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        PATH: process.env.PATH,
        TMPDIR: tmpdir(),
        AGENT_BROWSER_DAEMON: "1",
        AGENT_BROWSER_SESSION: "task",
        AGENT_BROWSER_SOCKET_DIR: this.directory,
        AGENT_BROWSER_DEFAULT_TIMEOUT: "8000",
        AGENT_BROWSER_IDLE_TIMEOUT_MS: "600000",
      },
      stdio: "ignore",
    });
    let startError: NodeJS.ErrnoException | undefined;
    this.exited = new Promise((resolve) => {
      this.child!.once("error", (error) => { startError = error; resolve(); });
      this.child!.once("exit", () => {
        this.stopped = true;
        for (const socket of this.sockets) socket.destroy(new Error("浏览器执行器已停止"));
        resolve();
      });
    });
    signal.addEventListener("abort", () => { void this.stop(); }, { once: true });
    const deadline = Date.now() + 10000;
    while (!existsSync(join(this.directory, "task.sock"))) {
      signal.throwIfAborted();
      if (startError) throw new Error(`agent-browser 无法启动：${startError.code ?? startError.message}`);
      if (this.stopped || Date.now() > deadline) throw new Error("agent-browser 启动超时或提前退出");
      await delay(20, undefined, { signal });
    }
    // Only the host can connect or select a target. Never expose these commands
    // or the CDP address to the model. Pinning prevents neighbor-tab fallback.
    await this.send({ action: "launch", cdpUrl });
    await this.send({ action: "tab_switch", tabId: targetId, pinTab: true });
  }

  private async send(command: Record<string, unknown>): Promise<unknown> {
    if (this.stopped) throw new Error("浏览器执行器已停止，不能继续操作");
    return new Promise((resolve, reject) => {
      const socket = connect(join(this.directory, "task.sock"));
      this.sockets.add(socket);
      let buffer = "";
      const finish = (error?: Error, value?: unknown) => {
        this.sockets.delete(socket);
        socket.removeAllListeners();
        socket.destroy();
        if (error) reject(error); else resolve(value);
      };
      socket.setTimeout(12000, () => finish(new Error("网页操作超时，请核对页面当前结果后重新发起任务")));
      socket.on("error", (error) => finish(error));
      socket.on("end", () => finish(new Error("agent-browser 连接已断开")));
      socket.on("connect", () => socket.write(`${JSON.stringify({ id: randomUUID(), ...command })}\n`));
      socket.on("data", (chunk) => {
        buffer += chunk.toString();
        if (buffer.length > 1_000_000) return finish(new Error("网页响应过大"));
        if (!buffer.includes("\n")) return;
        try {
          const response = JSON.parse(buffer.slice(0, buffer.indexOf("\n")));
          if (!response.success) finish(new Error(response.error || "agent-browser 操作失败"));
          else finish(undefined, response.data);
        } catch { finish(new Error("agent-browser 返回了无效响应")); }
      });
    });
  }

  async snapshot(): Promise<string> {
    const data = await this.send({ action: "snapshot", compact: true, maxDepth: 12 }) as { snapshot?: string };
    return (data.snapshot ?? JSON.stringify(data)).slice(0, 24000);
  }

  async perform(input: BrowserStep): Promise<void> {
    await this.send(browserCommand(input));
  }

  async stop(): Promise<void> {
    this.stopped = true;
    // Killing this owned daemon cancels pending auto-waits without closing the
    // observed Chrome page. Already-submitted web requests cannot be undone.
    if (this.child && this.child.exitCode === null && this.child.signalCode === null) this.child.kill("SIGKILL");
    await this.exited;
    if (this.directory) rmSync(this.directory, { recursive: true, force: true });
  }
}

export interface BrowserStep {
  action: "navigate" | "click" | "fill" | "select" | "press" | "scroll" | "wait";
  ref?: string;
  value?: string;
  url?: string;
  direction?: "up" | "down";
}

export function assertTaskUrl(value: string): string {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("浏览器任务只支持不含凭据的 HTTP / HTTPS 网址");
  if (url.port === "30141") throw new Error("浏览器任务不能访问 Syntropic 工作台或其接口");
  return url.href;
}

// Construct the protocol ourselves: model input never becomes a shell command,
// arbitrary daemon command, selector, CDP target, file path, or JavaScript.
export function browserCommand(input: BrowserStep): Record<string, unknown> {
  const ref = () => {
    if (!input.ref || !/^@?e\d+$/.test(input.ref)) throw new Error("请使用当前网页快照中的元素引用");
    return input.ref.startsWith("@") ? input.ref : `@${input.ref}`;
  };
  switch (input.action) {
    case "navigate": return { action: "navigate", url: assertTaskUrl(input.url ?? ""), waitUntil: "domcontentloaded" };
    case "click": return { action: "click", selector: ref() };
    case "fill": return { action: "fill", selector: ref(), value: input.value ?? "" };
    case "select": return { action: "select", selector: ref(), values: [input.value ?? ""] };
    case "press": {
      if (!input.value || !/^[a-zA-Z0-9+_-]{1,60}$/.test(input.value)) throw new Error("无效按键");
      return { action: "press", key: input.value };
    }
    case "scroll": return { action: "scroll", direction: input.direction === "up" ? "up" : "down", amount: 600 };
    case "wait": return { action: "wait", selector: ref(), state: "visible", timeout: 8000 };
    default: throw new Error("该操作不在浏览器任务的允许范围内");
  }
}
