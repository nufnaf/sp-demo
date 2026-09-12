import { fork, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import type { CalendarEventDraft } from "../feishu-calendar";
import type { ComputerFrame, ComputerState } from "./types";
import { readDemoModel } from "../demo-model";

export function computerAvailable() { return process.platform === "darwin" && process.env.SYNTROPIC_COMPUTER_USE === "1"; }
class ComputerRuntime {
  private child?: ChildProcess;
  private emitter = new EventEmitter();
  private viewers = 0;
  private idle?: ReturnType<typeof setTimeout>;
  private pending?: { id: string; beforeSubmit: () => Promise<void>; resolve: () => void; reject: (error: Error) => void };
  private state: ComputerState = { available: computerAvailable(), phase: "idle", detail: "连接飞书，查看工作进展", steps: 0 };
  snapshot() { return { ...this.state, available: computerAvailable() }; }
  private update(patch: Partial<ComputerState>) { this.state = { ...this.state, ...patch }; this.emitter.emit("status", this.snapshot()); }
  private scheduleIdle() {
    clearTimeout(this.idle);
    if (!this.pending && !this.viewers && this.state.phase !== "verifying") this.idle = setTimeout(() => { if (this.child?.connected) this.child.disconnect(); }, 3000);
  }
  private ensureWorker() {
    if (!computerAvailable()) throw new Error("请在 macOS 版 Syntropic 中使用电脑操作。");
    clearTimeout(this.idle);
    if (this.child?.connected) return this.child;
    const model = readDemoModel();
    const child = fork(join(process.env.SYNTROPIC_APP_ROOT || process.cwd(), "electron/computer-use/worker.mjs"), [], {
      execPath: process.execPath, execArgv: [], stdio: ["ignore", "ignore", "ignore", "ipc"],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined,
        SYNTROPIC_COMPUTER_PROVIDER: process.env.SYNTROPIC_COMPUTER_PROVIDER || model.provider,
        SYNTROPIC_COMPUTER_MODEL: process.env.SYNTROPIC_COMPUTER_MODEL || model.modelId,
        SYNTROPIC_COMPUTER_THINKING: process.env.SYNTROPIC_COMPUTER_THINKING || model.thinkingLevel },
    });
    this.child = child;
    child.on("message", async (raw: unknown) => {
      if (child !== this.child || !raw || typeof raw !== "object") return;
      const message = raw as { type: string; id?: string; error?: string; patch?: Partial<ComputerState>; frame?: ComputerFrame };
      if (message.type === "status" && message.patch) this.update(message.patch);
      if (message.type === "frame" && message.frame) this.emitter.emit("frame", message.frame);
      const current = this.pending;
      if (message.type === "before-submit" && current && current.id === message.id) {
        try { await current.beforeSubmit(); if (child.connected && current === this.pending) child.send({ type: "submit-ready" }); }
        catch { if (child.connected && current === this.pending) child.send({ type: "submit-refused" }); }
      }
      if (message.type === "result" && current && current.id === message.id) {
        const pending = current; this.pending = undefined;
        if (message.error) pending.reject(new Error(message.error)); else pending.resolve();
        this.scheduleIdle();
      }
    });
    const disconnected = () => {
      if (child !== this.child) return;
      this.child = undefined;
      if (this.pending) { this.pending.reject(new Error("电脑操作已中断，请检查飞书中的会议后重试。")); this.pending = undefined; }
      if (["running", "pausing", "paused", "verifying"].includes(this.state.phase)) this.update({ phase: "failed", detail: "电脑操作已中断，请检查飞书。" });
      this.emitter.emit("frame", { error: "画面连接已结束" });
    };
    child.once("error", disconnected); child.once("exit", disconnected);
    if (this.viewers) child.send({ type: "view", enabled: true });
    return child;
  }
  subscribeStatus(callback: (state: ComputerState) => void) {
    this.emitter.on("status", callback); callback(this.snapshot());
    return () => { this.emitter.off("status", callback); };
  }
  subscribeFrames(callback: (frame: ComputerFrame) => void) {
    this.emitter.on("frame", callback); this.viewers++;
    try { const existing = !!this.child?.connected; const child = this.ensureWorker(); if (existing && this.viewers === 1) child.send({ type: "view", enabled: true }); }
    catch (error) { this.emitter.off("frame", callback); this.viewers--; throw error; }
    let released = false;
    return () => {
      if (released) return; released = true;
      this.emitter.off("frame", callback); this.viewers--;
      if (!this.viewers && this.child?.connected) this.child.send({ type: "view", enabled: false });
      this.scheduleIdle();
    };
  }
  control(action: "pause" | "resume" | "stop" | "reconnect") {
    if (this.child?.connected) this.child.send({ type: action });
  }
  run(id: string, draft: CalendarEventDraft, calendarName: string, beforeSubmit: () => Promise<void>) {
    if (this.pending || this.state.phase === "verifying") throw new Error("请先完成当前电脑操作。");
    const child = this.ensureWorker();
    this.update({ taskId: id, interactionStarted: false, title: draft.title, phase: "running", detail: "正在准备飞书会议", steps: 0, error: null });
    return new Promise<void>((resolve, reject) => { this.pending = { id, beforeSubmit, resolve, reject }; child.send({ type: "run", id, draft, calendarName }); });
  }
  warmup() {
    if (!computerAvailable()) return;
    const child = this.ensureWorker();
    if (child.connected) child.send({ type: "warmup" });
  }
  verified(error?: string) {
    const stopped = Boolean(error && this.state.phase === "stopped");
    this.update({ phase: error ? stopped ? "stopped" : "failed" : "completed", detail: error || "会议已保存，日历已同步", error: error ?? null });
    if (!stopped && this.child?.connected) this.child.send({ type: error ? "verification-failed" : "verified", error });
    this.scheduleIdle();
  }
}
declare global { var __syntropicComputerRuntime: ComputerRuntime | undefined }
export function computerRuntime() { return globalThis.__syntropicComputerRuntime ??= new ComputerRuntime(); }
