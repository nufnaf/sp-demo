import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright-core";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import type { BrowserAction, BrowserPageState, BrowserSystemEvent, BrowserTaskState, BrowserController } from "./types";

const DEFAULT_URL = "about:blank";
const MAX_SNAPSHOT_TEXT = 8_000;
const MAX_SNAPSHOT_ELEMENTS = 120;

type BrowserListener = (event: BrowserSystemEvent) => void;

interface ManagedPage {
  pageId: string;
  taskSessionId: string | null;
  cwd: string;
  page: Page;
  revision: number;
  loading: boolean;
  controller: BrowserController;
  task?: BrowserTaskState;
  updatedAt: string;
  operationTail: Promise<void>;
}

interface WorkspaceBrowser {
  cwd: string;
  key: string;
  cdpUrl?: string;
  context: BrowserContext;
  pages: Map<string, ManagedPage>;
  taskPages: Map<string, string>;
  idleTimer: ReturnType<typeof setTimeout> | null;
}

declare global {
  var __piBrowserManager: BrowserManager | undefined;
}

function profileName(cwd: string): string {
  return createHash("sha256").update(cwd).digest("hex").slice(0, 20);
}

function resolveBrowserExecutable(): string | undefined {
  const configured = process.env.PI_WEB_BROWSER_EXECUTABLE?.trim();
  if (configured) return configured;
  const candidates = process.platform === "darwin"
    ? [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
      ]
    : process.platform === "win32"
      ? [
          join(process.env.PROGRAMFILES ?? "", "Google/Chrome/Application/chrome.exe"),
          join(process.env["PROGRAMFILES(X86)"] ?? "", "Google/Chrome/Application/chrome.exe"),
          join(process.env.LOCALAPPDATA ?? "", "Google/Chrome/Application/chrome.exe"),
          join(process.env.PROGRAMFILES ?? "", "Microsoft/Edge/Application/msedge.exe"),
        ]
      : [
          "/usr/bin/google-chrome",
          "/usr/bin/google-chrome-stable",
          "/usr/bin/chromium",
          "/usr/bin/chromium-browser",
          "/usr/bin/microsoft-edge",
        ];
  return candidates.find((candidate) => candidate && existsSync(candidate));
}

export function normalizeBrowserUrl(value?: string): string {
  const input = value?.trim() || DEFAULT_URL;
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(input);
  const looksLikeHost = /^(?:localhost|\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?(?:\/|$)/i.test(input)
    || /^[^\s/]+\.[^\s/]+(?:\/|$)/.test(input);
  const withScheme = hasScheme
    ? input
    : looksLikeHost
      ? `https://${input}`
      : `https://www.google.com/search?q=${encodeURIComponent(input)}`;
  const parsed = new URL(withScheme);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:" && parsed.protocol !== "about:") {
    throw new Error("Browser navigation only supports http and https URLs");
  }
  if (parsed.protocol === "about:" && parsed.href !== "about:blank") {
    throw new Error("Only about:blank is allowed");
  }
  return parsed.href;
}

function stateOf(managed: ManagedPage): BrowserPageState {
  return {
    pageId: managed.pageId,
    taskSessionId: managed.taskSessionId,
    cwd: managed.cwd,
    url: managed.page.url(),
    title: "",
    revision: managed.revision,
    loading: managed.loading,
    controller: managed.controller,
    viewport: managed.page.viewportSize() ?? { width: 1280, height: 800 },
    focus: null,
    updatedAt: managed.updatedAt,
    ...(managed.task ? { task: managed.task } : {}),
  };
}

export class BrowserManager {
  private readonly workspaces = new Map<string, WorkspaceBrowser>();
  private readonly starting = new Map<string, Promise<WorkspaceBrowser>>();
  private readonly listeners = new Set<BrowserListener>();

  subscribe(listener: BrowserListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: BrowserSystemEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private async pageState(managed: ManagedPage): Promise<BrowserPageState> {
    const state = stateOf(managed);
    try {
      const [title, focus] = await Promise.all([
        managed.page.title(),
        managed.page.evaluate(() => {
          const active = document.activeElement;
          if (!(active instanceof HTMLElement)) return null;
          const input = active instanceof HTMLInputElement ? active : null;
          const textarea = active instanceof HTMLTextAreaElement ? active : null;
          const textInputTypes = new Set(["", "email", "number", "password", "search", "tel", "text", "url"]);
          const isEditable = Boolean(
            (input && textInputTypes.has(input.type) && !input.disabled && !input.readOnly)
            || (textarea && !textarea.disabled && !textarea.readOnly)
            || active.isContentEditable,
          );
          if (!isEditable) return null;

          let caret: { x: number; y: number; height: number } | null = null;
          if (active.isContentEditable) {
            const selection = window.getSelection();
            if (selection?.rangeCount) {
              const range = selection.getRangeAt(0).cloneRange();
              range.collapse(true);
              const rangeRect = range.getClientRects()[0] ?? range.getBoundingClientRect();
              if (rangeRect) caret = { x: rangeRect.left, y: rangeRect.top, height: rangeRect.height };
            }
          } else if (input || textarea) {
            const field = input ?? textarea!;
            const rect = field.getBoundingClientRect();
            const style = getComputedStyle(field);
            const selectionStart = field.selectionStart ?? field.value.length;
            const fontSize = Number.parseFloat(style.fontSize) || 16;
            const lineHeight = style.lineHeight === "normal" ? fontSize * 1.2 : Number.parseFloat(style.lineHeight) || fontSize * 1.2;

            if (input) {
              const canvas = document.createElement("canvas");
              const context = canvas.getContext("2d");
              if (context) context.font = style.font;
              const beforeCaret = input.value.slice(0, selectionStart);
              const letterSpacing = Number.parseFloat(style.letterSpacing) || 0;
              const textWidth = (context?.measureText(beforeCaret).width ?? 0) + Math.max(0, beforeCaret.length - 1) * letterSpacing;
              caret = {
                x: rect.left + (Number.parseFloat(style.borderLeftWidth) || 0) + (Number.parseFloat(style.paddingLeft) || 0) + textWidth - input.scrollLeft,
                y: rect.top + Math.max(0, (rect.height - lineHeight) / 2),
                height: Math.min(lineHeight, rect.height),
              };
            } else {
              const mirror = document.createElement("div");
              const marker = document.createElement("span");
              const properties = [
                "boxSizing", "width", "borderLeftWidth", "borderRightWidth", "borderTopWidth", "borderBottomWidth",
                "paddingLeft", "paddingRight", "paddingTop", "paddingBottom", "fontFamily", "fontSize", "fontStyle",
                "fontWeight", "letterSpacing", "lineHeight", "textTransform", "textIndent", "wordSpacing", "tabSize",
              ] as const;
              mirror.style.position = "fixed";
              mirror.style.left = "-10000px";
              mirror.style.top = "0";
              mirror.style.visibility = "hidden";
              mirror.style.whiteSpace = "pre-wrap";
              mirror.style.overflowWrap = "break-word";
              for (const property of properties) mirror.style.setProperty(property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`), style[property]);
              mirror.style.width = `${rect.width}px`;
              mirror.textContent = textarea!.value.slice(0, selectionStart);
              marker.textContent = "\u200b";
              mirror.append(marker);
              document.body.append(mirror);
              const mirrorRect = mirror.getBoundingClientRect();
              const markerRect = marker.getBoundingClientRect();
              caret = {
                x: rect.left + markerRect.left - mirrorRect.left - textarea!.scrollLeft,
                y: rect.top + markerRect.top - mirrorRect.top - textarea!.scrollTop,
                height: markerRect.height || lineHeight,
              };
              mirror.remove();
            }
          }

          if (caret) {
            caret.x = Math.max(0, Math.min(window.innerWidth, caret.x));
            caret.y = Math.max(0, Math.min(window.innerHeight, caret.y));
            caret.height = Math.max(10, Math.min(80, caret.height || 16));
          }
          return { editable: true as const, caret };
        }),
      ]);
      state.title = title;
      state.focus = focus;
    } catch {
      state.title = state.url === "about:blank" ? "新标签页" : state.url;
    }
    return state;
  }

  private async touch(managed: ManagedPage): Promise<BrowserPageState> {
    managed.revision += 1;
    managed.updatedAt = new Date().toISOString();
    const state = await this.pageState(managed);
    // Reading title/focus yields. The page can close during that read; a late
    // update must never resurrect its tab after browser.closed was emitted.
    if (!managed.page.isClosed()) this.emit({ type: "browser.updated", page: state });
    return state;
  }

  private serialize<T>(managed: ManagedPage, operation: () => Promise<T>): Promise<T> {
    const result = managed.operationTail.then(operation, operation);
    managed.operationTail = result.then(() => undefined, () => undefined);
    return result;
  }

  private async createWorkspace(cwd: string, key = cwd): Promise<WorkspaceBrowser> {
    const executablePath = resolveBrowserExecutable();
    if (!executablePath) {
      throw new Error("No supported Chrome, Edge, or Chromium installation was found. Set PI_WEB_BROWSER_EXECUTABLE to the browser executable path.");
    }
    const profilePath = join(getAgentDir(), "browser", "profiles", profileName(key));
    mkdirSync(profilePath, { recursive: true });
    const context = await chromium.launchPersistentContext(profilePath, {
      executablePath,
      headless: process.env.PI_WEB_BROWSER_HEADLESS !== "false",
      viewport: { width: 1280, height: 800 },
      acceptDownloads: false,
      serviceWorkers: key !== cwd ? "block" : "allow",
      ...(key !== cwd ? { args: ["--remote-debugging-port=0", "--remote-debugging-address=127.0.0.1"] } : {}),
    });
    let cdpUrl: string | undefined;
    if (key !== cwd) {
      const [port, endpoint] = readFileSync(join(profilePath, "DevToolsActivePort"), "utf8").trim().split("\n");
      cdpUrl = `ws://127.0.0.1:${port}${endpoint}`;
      // Prevent even page scripts/redirects from addressing the Syntropic app.
      await context.route("**/*", (route) => new URL(route.request().url()).port === "30141"
        ? route.abort("blockedbyclient") : route.continue());
      await context.routeWebSocket(/:30141(?:\/|$)/, (socket) => socket.close());
    }
    const workspace: WorkspaceBrowser = {
      cwd, key, cdpUrl,
      context,
      pages: new Map(),
      taskPages: new Map(),
      idleTimer: null,
    };
    context.on("close", () => {
      if (workspace.idleTimer) clearTimeout(workspace.idleTimer);
      if (this.workspaces.get(key) === workspace) this.workspaces.delete(key);
      for (const page of workspace.pages.values()) {
        this.emit({ type: "browser.closed", pageId: page.pageId, cwd });
      }
    });
    this.workspaces.set(key, workspace);
    return workspace;
  }

  private async workspace(cwd: string): Promise<WorkspaceBrowser> {
    const existing = this.workspaces.get(cwd);
    if (existing) return existing;
    const inflight = this.starting.get(cwd);
    if (inflight) return inflight;
    const starting = this.createWorkspace(cwd).finally(() => this.starting.delete(cwd));
    this.starting.set(cwd, starting);
    return starting;
  }

  private registerPage(workspace: WorkspaceBrowser, page: Page, taskSessionId: string | null): ManagedPage {
    if (workspace.idleTimer) {
      clearTimeout(workspace.idleTimer);
      workspace.idleTimer = null;
    }
    const managed: ManagedPage = {
      pageId: randomUUID(),
      taskSessionId,
      cwd: workspace.cwd,
      page,
      revision: 0,
      loading: false,
      controller: "shared",
      updatedAt: new Date().toISOString(),
      operationTail: Promise.resolve(),
    };
    workspace.pages.set(managed.pageId, managed);
    if (taskSessionId) workspace.taskPages.set(taskSessionId, managed.pageId);
    page.on("request", (request) => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
        managed.loading = true;
        void this.touch(managed);
      }
    });
    const settle = () => {
      managed.loading = false;
      void this.touch(managed);
    };
    page.on("domcontentloaded", settle);
    page.on("load", settle);
    page.on("close", () => {
      workspace.pages.delete(managed.pageId);
      if (taskSessionId && workspace.taskPages.get(taskSessionId) === managed.pageId) {
        workspace.taskPages.delete(taskSessionId);
      }
      this.emit({ type: "browser.closed", pageId: managed.pageId, cwd: workspace.cwd });
      if (workspace.pages.size === 0) {
        workspace.idleTimer = setTimeout(() => {
          workspace.idleTimer = null;
          if (workspace.pages.size === 0) void workspace.context.close().catch(() => { /* browser already exited */ });
        }, 30_000);
      }
    });
    return managed;
  }

  private findPage(pageId: string, cwd?: string): ManagedPage {
    for (const workspace of this.workspaces.values()) {
      const page = workspace.pages.get(pageId);
      if (page) {
        if (cwd && page.cwd !== cwd) throw new Error("Browser page belongs to another workspace");
        return page;
      }
    }
    throw new Error(`Browser page not found: ${pageId}`);
  }

  async open(options: {
    cwd: string;
    taskSessionId?: string | null;
    url?: string;
    foreground?: boolean;
  }): Promise<BrowserPageState> {
    const workspace = await this.workspace(options.cwd);
    const taskSessionId = options.taskSessionId ?? null;
    const existingId = taskSessionId ? workspace.taskPages.get(taskSessionId) : undefined;
    let managed = existingId ? workspace.pages.get(existingId) : undefined;
    if (!managed || managed.page.isClosed()) {
      const startupPage = workspace.pages.size === 0
        ? workspace.context.pages().find((page) => !page.isClosed() && page.url() === "about:blank")
        : undefined;
      const page = startupPage ?? await workspace.context.newPage();
      managed = this.registerPage(workspace, page, taskSessionId);
    }
    if (options.url || managed.page.url() === "about:blank") {
      await managed.page.goto(normalizeBrowserUrl(options.url), { waitUntil: "domcontentloaded" });
    }
    const state = await this.touch(managed);
    this.emit({ type: "browser.opened", page: state, foreground: options.foreground !== false });
    return state;
  }

  async list(cwd?: string): Promise<BrowserPageState[]> {
    const pages = [...this.workspaces.values()]
      .filter((workspace) => !cwd || workspace.cwd === cwd)
      .flatMap((workspace) => [...workspace.pages.values()]);
    const states = await Promise.all(pages.map((page) => this.pageState(page)));
    return states.filter((_state, index) => !pages[index].page.isClosed());
  }

  private assertHumanInput(managed: ManagedPage): void {
    if (managed.controller === "agent") throw new Error("AI 正在操作此页面，请先停止任务；人工浏览请新建标签页。");
  }

  async openTaskPage(cwd: string, parentSessionId: string, taskId: string): Promise<{
    pageId: string; cdpUrl: string; targetId: string; page: Page;
  }> {
    const workspace = await this.createWorkspace(cwd, `task:${taskId}:${cwd}`);
    const page = workspace.context.pages()[0] ?? await workspace.context.newPage();
    const managed = this.registerPage(workspace, page, parentSessionId);
    managed.controller = "agent";
    // The execution has one page. Popups cannot acquire control or become a
    // fallback target. A task requiring another window must fail explicitly.
    workspace.context.on("page", (popup) => {
      if (popup !== page) void popup.close().catch(() => {});
    });
    const cdp = await workspace.context.newCDPSession(page);
    const { targetInfo } = await cdp.send("Target.getTargetInfo");
    await cdp.detach();
    const state = await this.touch(managed);
    this.emit({ type: "browser.opened", page: state, foreground: true });
    return { pageId: managed.pageId, cdpUrl: workspace.cdpUrl!, targetId: targetInfo.targetId, page };
  }

  async taskChanged(task: BrowserTaskState): Promise<void> {
    this.emit({ type: "browser.task", task });
    if (!task.pageId) return;
    try {
      const managed = this.findPage(task.pageId);
      managed.task = task;
      managed.controller = ["starting", "running", "stopping"].includes(task.status) ? "agent" : "shared";
      await this.touch(managed);
    } catch { /* A closed task remains visible in the task event/result. */ }
  }

  async refreshTaskPage(pageId: string): Promise<void> {
    await this.touch(this.findPage(pageId));
  }

  async navigate(pageId: string, input: { url?: string; action?: "back" | "forward" | "reload" }, cwd?: string): Promise<BrowserPageState> {
    const managed = this.findPage(pageId, cwd);
    return this.serialize(managed, async () => {
      this.assertHumanInput(managed);
      if (input.url) await managed.page.goto(normalizeBrowserUrl(input.url), { waitUntil: "domcontentloaded" });
      else if (input.action === "back") await managed.page.goBack({ waitUntil: "domcontentloaded" });
      else if (input.action === "forward") await managed.page.goForward({ waitUntil: "domcontentloaded" });
      else await managed.page.reload({ waitUntil: "domcontentloaded" });
      return this.touch(managed);
    });
  }

  async screenshot(pageId: string, cwd?: string): Promise<Buffer> {
    const managed = this.findPage(pageId, cwd);
    return this.serialize(managed, () => managed.page.screenshot({ type: "jpeg", quality: 82, animations: "disabled" }));
  }

  async resize(pageId: string, width: number, height: number): Promise<BrowserPageState> {
    const managed = this.findPage(pageId);
    const next = {
      width: Math.max(360, Math.min(1920, Math.round(width))),
      height: Math.max(240, Math.min(1200, Math.round(height))),
    };
    return this.serialize(managed, async () => {
      if (managed.controller === "agent") return this.pageState(managed);
      const current = managed.page.viewportSize();
      if (!current || current.width !== next.width || current.height !== next.height) {
        await managed.page.setViewportSize(next);
      }
      return this.touch(managed);
    });
  }

  async snapshot(pageId: string, cwd?: string): Promise<{ state: BrowserPageState; text: string }> {
    const managed = this.findPage(pageId, cwd);
    return this.serialize(managed, async () => {
      const data = await managed.page.evaluate(({ maxText, maxElements }) => {
      document.querySelectorAll("[data-agent-os-ref]").forEach((element) => element.removeAttribute("data-agent-os-ref"));
      const selectors = "a,button,input,textarea,select,[role=button],[role=link],[role=checkbox],[role=menuitem],[tabindex]";
      const elements = [...document.querySelectorAll<HTMLElement>(selectors)]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
        })
        .slice(0, maxElements)
        .map((element, index) => {
          const ref = `e${index + 1}`;
          element.setAttribute("data-agent-os-ref", ref);
          const role = element.getAttribute("role") || element.tagName.toLowerCase();
          const label = element.getAttribute("aria-label")
            || element.getAttribute("placeholder")
            || (element instanceof HTMLInputElement ? element.value : "")
            || element.innerText
            || element.getAttribute("title")
            || "";
          return { ref, role, label: label.replace(/\s+/g, " ").trim().slice(0, 180) };
        });
      return {
        bodyText: (document.body?.innerText ?? "").replace(/\n{3,}/g, "\n\n").slice(0, maxText),
        elements,
      };
    }, { maxText: MAX_SNAPSHOT_TEXT, maxElements: MAX_SNAPSHOT_ELEMENTS });
      const state = await this.touch(managed);
      const elements = data.elements.map((element) => `[${element.ref}] ${element.role}${element.label ? ` "${element.label}"` : ""}`);
      return {
        state,
        text: [
          `Page: ${state.title || "Untitled"}`,
          `URL: ${state.url}`,
          `Revision: ${state.revision}`,
          "",
          "Interactive elements:",
          elements.join("\n") || "(none)",
          "",
          "Visible text:",
          data.bodyText || "(none)",
        ].join("\n"),
      };
    });
  }

  async act(pageId: string, expectedRevision: number | undefined, input: BrowserAction, cwd?: string): Promise<BrowserPageState> {
    const managed = this.findPage(pageId, cwd);
    return this.serialize(managed, async () => {
      this.assertHumanInput(managed);
      if (expectedRevision !== undefined && expectedRevision !== managed.revision) {
        throw new Error(`The page changed (expected revision ${expectedRevision}, current ${managed.revision}). Take a new snapshot before acting.`);
      }
      await this.performAction(managed, input);
      await managed.page.waitForTimeout(120);
      return this.touch(managed);
    });
  }

  private async performAction(managed: ManagedPage, input: BrowserAction): Promise<void> {
    if (input.action === "scroll") {
      await managed.page.mouse.wheel(input.deltaX ?? 0, input.deltaY);
    } else if (input.action === "coordinate_click") {
      await managed.page.mouse.click(input.x, input.y);
    } else if (input.action === "insert_text") {
      await managed.page.keyboard.insertText(input.text);
    } else {
      const normalizedRef = input.ref?.replace(/[^a-zA-Z0-9_-]/g, "");
      if (input.action !== "press" && !normalizedRef) throw new Error(`Browser ${input.action} requires an element ref from browser_snapshot`);
      const locator = normalizedRef ? managed.page.locator(`[data-agent-os-ref="${normalizedRef}"]`) : null;
      if (input.action === "click") await locator!.click();
      else if (input.action === "type") await locator!.fill(input.text);
      else if (input.action === "select") await locator!.selectOption(input.value);
      else if (input.action === "press") {
        if (locator) await locator.press(input.key);
        else await managed.page.keyboard.press(input.key);
      }
    }
  }

  async userInput(pageId: string, input: BrowserAction): Promise<BrowserPageState> {
    const managed = this.findPage(pageId);
    return this.serialize(managed, async () => {
      this.assertHumanInput(managed);
      await this.performAction(managed, input);
      return this.touch(managed);
    });
  }

  async close(pageId: string): Promise<void> {
    await this.findPage(pageId).page.close();
  }
}

export function getBrowserManager(): BrowserManager {
  globalThis.__piBrowserManager ??= new BrowserManager();
  return globalThis.__piBrowserManager;
}
