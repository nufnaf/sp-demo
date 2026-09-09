export type BrowserStartupPhase =
  | "prepared-browser-wait" | "profile-prepare" | "chromium-launch" | "context-connect"
  | "page-register" | "target-identify" | "initial-page-state"
  | "viewport-wait" | "viewport-seal"
  | "executor-spawn" | "executor-ready" | "executor-connect" | "target-pin";

export interface BrowserStartupTiming {
  phase: BrowserStartupPhase;
  offsetMs: number;
  durationMs: number;
  status: "completed" | "failed";
  outcome?: "ready" | "timeout";
}

/** Local measurements only: no URLs, credentials, prompts or per-step events. */
export class BrowserStartupTimer {
  readonly entries: BrowserStartupTiming[] = [];
  private readonly origin = performance.now();

  start(phase: BrowserStartupPhase) {
    const since = performance.now();
    return (status: BrowserStartupTiming["status"], outcome?: BrowserStartupTiming["outcome"]) => {
      this.entries.push({
        phase, offsetMs: Math.round(since - this.origin),
        durationMs: Math.round(performance.now() - since), status,
        ...(outcome ? { outcome } : {}),
      });
    };
  }
}

export async function measureStartup<T>(timer: BrowserStartupTimer | undefined, phase: BrowserStartupPhase, operation: () => T | Promise<T>): Promise<T> {
  const finish = timer?.start(phase);
  try {
    const result = await operation();
    finish?.("completed");
    return result;
  } catch (error) {
    finish?.("failed");
    throw error;
  }
}
