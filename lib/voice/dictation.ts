"use client";

import { ASR_RECORD_OPTIONS, asrRequestConfig, authenticatedUrl, getSpeechSdk, getVoiceSession, micLevel } from "./doubao-client";
import { createTurnTracker, type TurnTracker } from "./turn-detector";

type AsrClient = ReturnType<Awaited<ReturnType<typeof getSpeechSdk>>["LabASR"]>;

export type DictationState = "idle" | "connecting" | "recording" | "finishing" | "error";

export interface DictationCallbacks {
  onState(state: DictationState): void;
  /** Everything recognized so far, finalized text followed by the live partial. */
  onTranscript(text: string): void;
  onLevel(level: number): void;
  /** The recording ended, by the user or after a pause; `text` is what to send. */
  onResult(text: string): void;
  onError(message: string): void;
}

/** How long to wait for the recognizer to finalize after the user taps stop. */
const FINISH_GRACE_MS = 900;

/**
 * Push-to-talk dictation: record until the user taps stop, then hand the text
 * over to be sent as a message. Pauses never end the recording; people think
 * while they dictate.
 */
export class DictationRecorder {
  private client: AsrClient | null = null;
  private tracker: TurnTracker = createTurnTracker();
  private committed: string[] = [];
  private partial = "";
  private generation = 0;
  private finishTimer: ReturnType<typeof setTimeout> | null = null;
  private state: DictationState = "idle";

  constructor(private readonly callbacks: DictationCallbacks) {}

  get isActive(): boolean {
    return this.state === "connecting" || this.state === "recording" || this.state === "finishing";
  }

  private setState(state: DictationState): void {
    this.state = state;
    this.callbacks.onState(state);
  }

  async start(): Promise<void> {
    if (this.isActive) return;
    const generation = ++this.generation;
    this.tracker = createTurnTracker();
    this.committed = [];
    this.partial = "";
    this.setState("connecting");
    this.callbacks.onTranscript("");
    try {
      const [session, sdk] = await Promise.all([getVoiceSession(), getSpeechSdk()]);
      if (generation !== this.generation) return;
      const client = sdk.LabASR({
        onStart: () => {
          if (generation === this.generation) this.setState("recording");
        },
        onMessage: (_text, full) => {
          if (generation !== this.generation) return;
          const result = full && typeof full === "object" ? (full as { result?: unknown }).result : null;
          this.handleResult(result && typeof result === "object" ? result as Parameters<TurnTracker["update"]>[0] : null);
        },
        onError: () => {
          if (generation !== this.generation) return;
          this.fail("Unable to connect to Doubao speech recognition");
        },
        onClose: () => {
          if (generation !== this.generation) return;
          if (this.state === "finishing") this.deliver();
        },
      });
      this.client = client;
      client.connect({
        url: authenticatedUrl(session.asr.endpoint, session, session.asr.resourceId),
        config: asrRequestConfig(800),
      });
      await client.startRecord(ASR_RECORD_OPTIONS, (chunk) => {
        if (generation !== this.generation) return;
        void micLevel(chunk).then((level) => this.callbacks.onLevel(level)).catch(() => {});
      });
      if (generation !== this.generation) client.stopRecord();
    } catch (cause) {
      if (generation !== this.generation) return;
      this.fail(cause instanceof Error && cause.name === "NotAllowedError"
        ? "Microphone access was denied"
        : cause instanceof Error ? cause.message : String(cause));
    }
  }

  /** Stop recording; the text is delivered once the recognizer finalizes. */
  stop(): void {
    if (!this.isActive || this.state === "finishing") return;
    this.setState("finishing");
    // Let the recorder flush its current frame so the last word is not cut.
    this.finishTimer = setTimeout(() => {
      this.finishTimer = null;
      this.client?.stopRecord();
      this.client = null;
      // If the socket does not close promptly, deliver what we have.
      this.finishTimer = setTimeout(() => {
        this.finishTimer = null;
        this.deliver();
      }, FINISH_GRACE_MS);
    }, 240);
  }

  cancel(): void {
    this.generation += 1;
    if (this.finishTimer) clearTimeout(this.finishTimer);
    this.finishTimer = null;
    this.client?.stopRecord();
    this.client = null;
    this.committed = [];
    this.partial = "";
    this.callbacks.onTranscript("");
    this.callbacks.onLevel(0);
    this.setState("idle");
  }

  private handleResult(result: Parameters<TurnTracker["update"]>[0]): void {
    const update = this.tracker.update(result);
    if (update.committed.length) this.committed.push(...update.committed);
    this.partial = update.partial;
    this.callbacks.onTranscript([...this.committed, this.partial].join(""));
  }

  private deliver(): void {
    if (this.state !== "finishing") return;
    if (this.finishTimer) clearTimeout(this.finishTimer);
    this.finishTimer = null;
    this.generation += 1;
    this.client = null;
    const text = [...this.committed, this.partial].join("").trim();
    this.committed = [];
    this.partial = "";
    this.callbacks.onLevel(0);
    this.setState("idle");
    this.callbacks.onTranscript("");
    if (text) this.callbacks.onResult(text);
  }

  private fail(message: string): void {
    this.client?.stopRecord();
    this.client = null;
    this.callbacks.onLevel(0);
    this.setState("error");
    this.callbacks.onError(message);
  }
}
