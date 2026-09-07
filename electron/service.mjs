import { createHash } from 'node:crypto';
import { realpathSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { APP_ORIGIN } from './policy.mjs';
import { OwnedProcessTree } from './process-tree.mjs';
import { prepareNativeHost } from './native-host.mjs';

export function checkoutId(root) {
  return createHash('sha256').update(realpathSync(root)).digest('hex');
}
export function portIsOpen(port = 30141) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const finish = (open) => { socket.destroy(); resolve(open); };
    socket.setTimeout(800, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}
export class LocalService {
  constructor({ root, onStatus = () => {}, onFailure = () => {}, origin = APP_ORIGIN, timeout = 120_000, command, env = process.env }) {
    this.root = realpathSync(root);
    this.identity = checkoutId(root);
    this.origin = origin;
    this.timeout = timeout;
    this.onStatus = onStatus;
    this.onFailure = onFailure;
    this.customCommand = Boolean(command);
    this.command = command ?? [process.execPath, join(root, 'node_modules/next/dist/bin/next'), 'dev', '-H', '127.0.0.1', '-p', '30141'];
    this.env = env;
    this.owned = false;
    this.stopped = false;
  }
  start() {
    this.starting ??= this.connect();
    return this.starting;
  }
  async connect() {
    const occupied = await portIsOpen(Number(new URL(this.origin).port));
    if (this.stopped) throw new Error('启动已取消。');
    if (!occupied) {
      if (existsSync(join(this.root, '.next/dev/lock'))) {
        throw new Error('此 checkout 的 .next/dev/lock 已存在。请检查已有 npm run dev；不要同时启动第二个开发实例。确认没有服务后再按 AGENTS.md 处理遗留锁。');
      }
      if (!this.customCommand) {
        try { prepareNativeHost(); }
        catch { throw new Error('本机 node-pty 模块不可用。请在当前 Node 下重新安装依赖；不要使用 Electron rebuild。'); }
      }
      this.onStatus('正在启动本机后台…', '使用本机 Node 运行 Next.js 和 Pi；首次编译可能需要一至两分钟。');
      const env = { ...this.env };
      delete env.ELECTRON_RUN_AS_NODE;
      delete env.NODE_ENV;
      // This launcher does not relay raw backend output: SDKs/extensions may log
      // authorization URLs or tool output. Status messages below contain no secrets.
      this.child = spawn(this.command[0], this.command.slice(1), {
        cwd: this.root, env, detached: true, stdio: 'ignore',
      });
      this.owned = true;
      this.child.on('error', () => {
        this.failure = '本机后台无法启动。请确认 Node 路径有效，并运行 npm ci --legacy-peer-deps 安装依赖。';
      });
      this.child.on('exit', (code, signal) => {
        this.failure = `本机后台已停止（${signal || `退出码 ${code}`}）。请在本 checkout 运行 npm run dev 检查错误，修复后重试连接。`;
        if (this.ready && !this.stopped) this.onFailure(this.failure);
        if (!this.stopped) void this.tree?.stop().catch(() => {});
      });
      if (this.child.pid) {
        this.tree = new OwnedProcessTree(this.child.pid);
        await this.tree.capture();
      }
    } else {
      this.onStatus('正在检查已有服务…', '将核对端口上的服务是否属于当前 worktree；复用的服务始终由原启动者管理。');
    }
    const deadline = Date.now() + this.timeout;
    while (!this.stopped && Date.now() < deadline) {
      if (this.failure) throw new Error(this.failure);
      try {
        const response = await fetch(`${this.origin}/api/desktop/health`, { signal: AbortSignal.timeout(Math.min(3000, deadline - Date.now())), redirect: 'manual' });
        if (response.status === 401) throw new Error('服务启用了 PI_WEB_PASSWORD。请使用已有网页登录方式；本阶段桌面启动不绕过或转存该密码。');
        if (response.ok) {
          const health = await response.json();
          if (health.app !== 'syntropic-local' || health.checkoutId !== this.identity) {
            throw new Error('30141 已被其他项目或 worktree 占用。请在该服务原来的终端停止它，或从对应 checkout 启动桌面；App 不会终止它。');
          }
          // The lightweight identity route alone doesn't prove the page or Pi API compiles.
          const checks = await Promise.all(['/', '/api/agent/running'].map((path) => fetch(`${this.origin}${path}`, {
            signal: AbortSignal.timeout(Math.max(1, Math.min(10_000, deadline - Date.now()))), redirect: 'manual',
          })));
          const api = checks[1].ok ? await checks[1].json() : null;
          await checks[0].arrayBuffer();
          if (checks.every((r) => r.ok) && Array.isArray(api?.runningSessionIds)) {
            this.ready = true;
            return { owned: this.owned };
          }
        }
      } catch (error) {
        if (error.message.startsWith('30141 ') || error.message.startsWith('服务启用了')) throw error;
      }
      await delay(350);
    }
    if (this.stopped) throw new Error('启动已取消。');
    throw new Error(occupied
      ? '30141 上的服务未能通过当前 worktree 的健康检查。请检查是否为其他程序、旧版本服务或编译失败；App 没有停止它。'
      : '本机服务未能在两分钟内就绪。请检查依赖与编译错误（npm run dev），然后重试。');
  }
  async stop() {
    this.stopped = true;
    // No process tree exists for a reused service: it is never signaled.
    await this.tree?.stop();
  }
}
