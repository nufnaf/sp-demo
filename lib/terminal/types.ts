export type TerminalStatus = "running" | "exited";

export interface TerminalSessionState {
  terminalId: string;
  cwd: string;
  title: string;
  shell: string;
  cols: number;
  rows: number;
  status: TerminalStatus;
  exitCode: number | null;
  createdAt: string;
  updatedAt: string;
}

export type TerminalSessionEvent =
  | { type: "terminal.replay"; terminalId: string; data: string; sequence: number; truncated: boolean }
  | { type: "terminal.output"; terminalId: string; data: string; sequence: number }
  | { type: "terminal.updated"; terminal: TerminalSessionState }
  | { type: "terminal.closed"; terminalId: string; cwd: string };
