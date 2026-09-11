export type ComputerPhase = "idle" | "running" | "pausing" | "paused" | "verifying" | "completed" | "failed" | "stopped";
export interface ComputerState {
  available: boolean; interactionStarted?: boolean; taskId?: string; title?: string; phase: ComputerPhase; detail: string; steps: number;
  target?: { windowId: string; title: string } | null; error?: string | null;
}
export interface ComputerFrame { dataUrl?: string; windowId?: string; sequence?: number; receivedAt?: number; error?: string }
