import { accessSync, chmodSync, constants, existsSync, realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { basename, dirname, join } from "node:path";
import * as pty from "node-pty";
import type { IDisposable, IPty } from "node-pty";
import type { TerminalSessionEvent, TerminalSessionState } from "./types";

const MAX_TERMINALS_PER_WORKSPACE = 8;
const MAX_REPLAY_BYTES = 2 * 1024 * 1024;

type TerminalListener = (event: TerminalSessionEvent) => void;

interface OutputChunk {
  data: string;
  bytes: number;
}

interface ManagedTerminal {
  state: TerminalSessionState;
  process: IPty;
  output: OutputChunk[];
  outputBytes: number;
  outputTruncated: boolean;
  sequence: number;
  listeners: Set<TerminalListener>;
  dataSubscription: IDisposable;
  exitSubscription: IDisposable;
}

declare global {
  var __piTerminalManager: TerminalManager | undefined;
}

function shellConfig(): { executable: string; args: string[] } {
  if (process.platform === "win32") {
    return { executable: "powershell.exe", args: ["-NoLogo"] };
  }
  const configured = process.env.SHELL?.trim();
  const executable = configured && configured.startsWith("/") && existsSync(configured)
    ? configured
    : existsSync("/bin/zsh") ? "/bin/zsh" : "/bin/bash";
  return { executable, args: ["-l"] };
}

function terminalEnvironment(): Record<string, string> {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
  return {
    ...environment,
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    TERM_PROGRAM: "pi-web",
  };
}

function ensurePtyHelperExecutable(): void {
  if (process.platform === "win32") return;
  const require = createRequire(import.meta.url);
  const helper = join(dirname(require.resolve("node-pty")), "..", "prebuilds", `${process.platform}-${process.arch}`, "spawn-helper");
  if (!existsSync(helper)) return;
  try {
    accessSync(helper, constants.X_OK);
  } catch {
    try {
      chmodSync(helper, statSync(helper).mode | 0o100);
    } catch (error) {
      throw new Error(`node-pty spawn helper is not executable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

function publicState(terminal: ManagedTerminal): TerminalSessionState {
  return { ...terminal.state };
}

export class TerminalManager {
  private readonly terminals = new Map<string, ManagedTerminal>();

  list(cwd: string): TerminalSessionState[] {
    const workspaceCwd = realpathSync(cwd);
    return [...this.terminals.values()]
      .filter((terminal) => terminal.state.cwd === workspaceCwd)
      .map(publicState)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  ensure(cwd: string, size: { cols?: number; rows?: number } = {}): TerminalSessionState {
    return this.list(realpathSync(cwd))[0] ?? this.create(cwd, size);
  }

  create(cwdInput: string, size: { cols?: number; rows?: number } = {}): TerminalSessionState {
    const cwd = realpathSync(cwdInput);
    if (!statSync(cwd).isDirectory()) throw new Error("Terminal cwd must be a directory");
    const existing = this.list(cwd);
    if (existing.length >= MAX_TERMINALS_PER_WORKSPACE) {
      throw new Error(`A workspace can have at most ${MAX_TERMINALS_PER_WORKSPACE} terminals`);
    }

    const terminalId = randomUUID();
    const shell = shellConfig();
    ensurePtyHelperExecutable();
    const now = new Date().toISOString();
    const state: TerminalSessionState = {
      terminalId,
      cwd,
      title: this.nextTitle(existing),
      shell: basename(shell.executable),
      cols: this.clampCols(size.cols),
      rows: this.clampRows(size.rows),
      status: "running",
      exitCode: null,
      createdAt: now,
      updatedAt: now,
    };
    const processHandle = pty.spawn(shell.executable, shell.args, {
      name: "xterm-256color",
      cols: state.cols,
      rows: state.rows,
      cwd,
      env: terminalEnvironment(),
    });
    const terminal = {
      state,
      process: processHandle,
      output: [],
      outputBytes: 0,
      outputTruncated: false,
      sequence: 0,
      listeners: new Set<TerminalListener>(),
      dataSubscription: null as unknown as IDisposable,
      exitSubscription: null as unknown as IDisposable,
    } satisfies ManagedTerminal;
    this.terminals.set(terminalId, terminal);
    this.bindProcess(terminal);
    return publicState(terminal);
  }

  private bindProcess(terminal: ManagedTerminal): void {
    const processHandle = terminal.process;
    terminal.dataSubscription = processHandle.onData((data) => {
      if (this.terminals.get(terminal.state.terminalId) !== terminal || terminal.process !== processHandle) return;
      terminal.sequence += 1;
      terminal.state.updatedAt = new Date().toISOString();
      this.appendOutput(terminal, data);
      this.emit(terminal, { type: "terminal.output", terminalId: terminal.state.terminalId, data, sequence: terminal.sequence });
    });
    terminal.exitSubscription = processHandle.onExit(({ exitCode }) => {
      if (this.terminals.get(terminal.state.terminalId) !== terminal || terminal.process !== processHandle) return;
      terminal.state.status = "exited";
      terminal.state.exitCode = exitCode;
      terminal.state.updatedAt = new Date().toISOString();
      this.emit(terminal, { type: "terminal.updated", terminal: publicState(terminal) });
    });
  }

  private appendOutput(terminal: ManagedTerminal, data: string): void {
    let chunk = data;
    let bytes = Buffer.byteLength(chunk);
    if (bytes > MAX_REPLAY_BYTES) {
      chunk = chunk.slice(-MAX_REPLAY_BYTES);
      bytes = Buffer.byteLength(chunk);
      terminal.output = [];
      terminal.outputBytes = 0;
      terminal.outputTruncated = true;
    }
    terminal.output.push({ data: chunk, bytes });
    terminal.outputBytes += bytes;
    while (terminal.outputBytes > MAX_REPLAY_BYTES && terminal.output.length > 1) {
      const removed = terminal.output.shift()!;
      terminal.outputBytes -= removed.bytes;
      terminal.outputTruncated = true;
    }
  }

  private emit(terminal: ManagedTerminal, event: TerminalSessionEvent): void {
    for (const listener of terminal.listeners) listener(event);
  }

  private find(terminalId: string, cwd: string): ManagedTerminal {
    const terminal = this.terminals.get(terminalId);
    if (!terminal || terminal.state.cwd !== cwd) throw new Error("Terminal not found in this workspace");
    return terminal;
  }

  state(terminalId: string, cwd: string): TerminalSessionState {
    return publicState(this.find(terminalId, cwd));
  }

  subscribe(terminalId: string, cwd: string, listener: TerminalListener): () => void {
    const terminal = this.find(terminalId, cwd);
    listener({
      type: "terminal.replay",
      terminalId,
      data: terminal.output.map((chunk) => chunk.data).join(""),
      sequence: terminal.sequence,
      truncated: terminal.outputTruncated,
    });
    listener({ type: "terminal.updated", terminal: publicState(terminal) });
    terminal.listeners.add(listener);
    return () => terminal.listeners.delete(listener);
  }

  write(terminalId: string, cwd: string, data: string): TerminalSessionState {
    const terminal = this.find(terminalId, cwd);
    if (terminal.state.status !== "running") throw new Error("Terminal has exited");
    terminal.process.write(data);
    return publicState(terminal);
  }

  resize(terminalId: string, cwd: string, cols?: number, rows?: number): TerminalSessionState {
    const terminal = this.find(terminalId, cwd);
    const nextCols = this.clampCols(cols);
    const nextRows = this.clampRows(rows);
    if (terminal.state.status === "running") terminal.process.resize(nextCols, nextRows);
    terminal.state.cols = nextCols;
    terminal.state.rows = nextRows;
    terminal.state.updatedAt = new Date().toISOString();
    return publicState(terminal);
  }

  restart(terminalId: string, cwd: string): TerminalSessionState {
    const terminal = this.find(terminalId, cwd);
    terminal.dataSubscription.dispose();
    terminal.exitSubscription.dispose();
    if (terminal.state.status === "running") terminal.process.kill();
    const shell = shellConfig();
    ensurePtyHelperExecutable();
    terminal.process = pty.spawn(shell.executable, shell.args, {
      name: "xterm-256color",
      cols: terminal.state.cols,
      rows: terminal.state.rows,
      cwd,
      env: terminalEnvironment(),
    });
    terminal.output = [];
    terminal.outputBytes = 0;
    terminal.outputTruncated = false;
    terminal.sequence = 0;
    terminal.state.shell = basename(shell.executable);
    terminal.state.status = "running";
    terminal.state.exitCode = null;
    terminal.state.updatedAt = new Date().toISOString();
    this.bindProcess(terminal);
    this.emit(terminal, { type: "terminal.replay", terminalId, data: "", sequence: 0, truncated: false });
    this.emit(terminal, { type: "terminal.updated", terminal: publicState(terminal) });
    return publicState(terminal);
  }

  close(terminalId: string, cwd: string): void {
    const terminal = this.find(terminalId, cwd);
    this.terminals.delete(terminalId);
    terminal.dataSubscription.dispose();
    terminal.exitSubscription.dispose();
    if (terminal.state.status === "running") terminal.process.kill();
    this.emit(terminal, { type: "terminal.closed", terminalId, cwd });
    terminal.listeners.clear();
  }

  private clampCols(value?: number): number {
    return Math.max(20, Math.min(400, Math.round(value ?? 100)));
  }

  private clampRows(value?: number): number {
    return Math.max(5, Math.min(200, Math.round(value ?? 30)));
  }

  private nextTitle(existing: TerminalSessionState[]): string {
    const titles = new Set(existing.map((terminal) => terminal.title));
    let index = 1;
    while (titles.has(`终端 ${index}`)) index += 1;
    return `终端 ${index}`;
  }
}

export function getTerminalManager(): TerminalManager {
  globalThis.__piTerminalManager ??= new TerminalManager();
  return globalThis.__piTerminalManager;
}
