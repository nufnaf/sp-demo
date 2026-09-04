"use client";

import type { DoubaoVoiceSession, VoiceSnapshot, VoiceState } from "./types";
import { isVoiceAbortCommand } from "./text";
import { createSpeechSegmenter, type SpeechSegmenter } from "./speech-segmenter";
import { createTurnTracker, type TurnTracker } from "./turn-detector";
import { PcmPlayer } from "./pcm-player";
import { TtsSpeaker } from "./tts-speaker";
import { createSpokenTextWindow, looksLikeEcho } from "./echo";
import { turnWaitFor } from "./turn-policy";

type AsrClient = ReturnType<typeof import("byted-ailab-speech-sdk")["LabASR"]>;

export interface VoiceDriver {
  id: string;
  /** Higher wins when several surfaces are mounted at once. */
  priority: number;
  agentRunning: boolean;
  /** Assistant text to narrate; grows while the agent streams. */
  speechText: string;
  onPrompt(text: string): void;
  onSteer(text: string): void;
  /** The user talked over the assistant's speech; the old answer is void. */
  onInterrupt?(text: string): void;
  onAbort(): void;
}

type Listener = () => void;

/** Utterances finalized within this window are merged into one turn; a person
 * pausing between two sentences should not become two requests. */
const TURN_MERGE_MS = 900;
/** An utterance that reads as unfinished gets this long for its continuation. */
const TURN_MERGE_INCOMPLETE_MS = 2_000;
/** Never hold a turn longer than this once the recognizer finalized it. */
const TURN_MAX_HOLD_MS = 4_500;
/** Microphone level above which the user is taken to be still talking. */
const STILL_TALKING_LEVEL = 0.15;
const STILL_TALKING_RECHECK_MS = 400;
/** Without utterance boundaries, commit once the partial stays unchanged this long. */
const TEXT_STABLE_MS = 1_100;
/** Ignore single-character partials while speaking so noise cannot interrupt playback. */
const BARGE_IN_MIN_CHARS = 2;
/** Give up on "thinking" if no agent ever reports running. */
const REPLY_TIMEOUT_MS = 20_000;
const MAX_ASR_RETRIES = 3;
const TERMINATOR_RE = /[。！？!?；;…]["”’)）』」]*$/;

async function fetchVoiceSession(): Promise<DoubaoVoiceSession> {
  const response = await fetch("/api/voice/session", { method: "POST", headers: { Accept: "application/json" } });
  const body = await response.json().catch(() => ({})) as DoubaoVoiceSession & { error?: string };
  if (!response.ok) throw new Error(body.error || `Voice service returned HTTP ${response.status}`);
  return body;
}

function authenticatedUrl(endpoint: string, session: DoubaoVoiceSession, resourceId: string): string {
  const url = new URL(endpoint);
  url.searchParams.set("api_resource_id", resourceId);
  url.searchParams.set("api_app_key", session.appId);
  url.searchParams.set("api_access_key", `Jwt; ${session.token}`);
  url.searchParams.set("api_connect_id", crypto.randomUUID());
  return url.toString();
}

function micLevel(chunk: Blob): Promise<number> {
  return chunk.slice(44).arrayBuffer().then((buffer) => {
    if (buffer.byteLength < 2) return 0;
    const samples = new Int16Array(buffer.slice(0, buffer.byteLength - (buffer.byteLength % 2)));
    let sum = 0;
    let count = 0;
    for (let index = 0; index < samples.length; index += 8) {
      const sample = samples[index] / 32_768;
      sum += sample * sample;
      count += 1;
    }
    return count ? Math.min(1, Math.sqrt(sum / count) * 8) : 0;
  });
}

/**
 * Always-on voice conversation shared by every surface in the app. The
 * microphone stays open, the user's finished utterances go to the highest
 * priority driver, the driver's streamed reply is spoken sentence by sentence,
 * and talking over the assistant cuts playback immediately.
 */
export class VoiceEngine {
  private snapshot: VoiceSnapshot = { state: "off", transcript: "", caption: "", error: null, level: 0 };
  private readonly listeners = new Set<Listener>();
  private readonly drivers = new Map<string, VoiceDriver>();
  private driverId: string | null = null;

  private active = false;
  private session: DoubaoVoiceSession | null = null;
  private sessionPromise: Promise<DoubaoVoiceSession> | null = null;
  private sdk: typeof import("byted-ailab-speech-sdk") | null = null;

  private asr: AsrClient | null = null;
  private asrGeneration = 0;
  private asrRetries = 0;
  private asrConnected = false;
  private tracker: TurnTracker = createTurnTracker();
  private pendingTurn: string[] = [];
  private pendingSince = 0;
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private stableTimer: ReturnType<typeof setTimeout> | null = null;
  private userSpeaking = false;

  private readonly player = new PcmPlayer();
  private speaker: TtsSpeaker | null = null;
  private speakerToken = "";
  private reconnectPending = false;
  private segmenter: SpeechSegmenter = createSpeechSegmenter();
  private mutedUntilNextTurn = false;
  private awaitingReply = false;
  private readonly spokenWindow = createSpokenTextWindow();
  private lastSpeechEndedAt = 0;
  private wasSpeaking = false;
  /** Sentences held back while the user was talking. */
  private deferred: string[] = [];
  private interruptedByUser = false;
  /** Last text fed to the segmenter, to notice when a new message starts. */
  private speechSource = "";
  /** Full texts already voiced or skipped; seeing one again means it is old, not new. */
  private readonly finishedSources: string[] = [];
  /** After the user spoke mid-turn, stay quiet until the assistant starts a new message. */
  private holdUntilNewMessage = false;
  private replyTimer: ReturnType<typeof setTimeout> | null = null;
  private levelTimer: ReturnType<typeof setInterval> | null = null;
  private micLevelValue = 0;

  // ---------------------------------------------------------------- store

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  getSnapshot(): VoiceSnapshot {
    return this.snapshot;
  }

  private patch(update: Partial<VoiceSnapshot>): void {
    const next = { ...this.snapshot, ...update };
    if (
      next.state === this.snapshot.state
      && next.transcript === this.snapshot.transcript
      && next.caption === this.snapshot.caption
      && next.error === this.snapshot.error
      && next.level === this.snapshot.level
    ) return;
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }

  private computeState(): VoiceState {
    if (!this.active) return "off";
    if (this.snapshot.error) return "error";
    if (!this.asrConnected) return "connecting";
    if (this.isSpeaking()) return "speaking";
    if (this.userSpeaking || this.pendingTurn.length) return "hearing";
    const driver = this.driver;
    if (this.awaitingReply || driver?.agentRunning) return "thinking";
    return "listening";
  }

  private refresh(): void {
    const speaking = this.isSpeaking();
    if (this.wasSpeaking && !speaking) {
      this.lastSpeechEndedAt = Date.now();
      this.spokenWindow.touch();
    }
    this.wasSpeaking = speaking;
    this.patch({ state: this.computeState() });
  }

  /**
   * Recognized text that mostly repeats what Jarvis is saying right now is
   * echo, not the user. Only applied while audio is actually playing: right
   * after a question the user naturally reuses its words, and that is speech.
   */
  private isEcho(text: string): boolean {
    if (!this.isSpeaking()) return false;
    return looksLikeEcho(text, this.spokenWindow.text(Date.now(), true));
  }

  private isSpeaking(): boolean {
    return this.player.isPlaying || Boolean(this.speaker?.busy);
  }

  // -------------------------------------------------------------- drivers

  private get driver(): VoiceDriver | null {
    return this.driverId ? this.drivers.get(this.driverId) ?? null : null;
  }

  registerDriver(driver: VoiceDriver): void {
    this.drivers.set(driver.id, driver);
    this.electDriver();
  }

  updateDriver(id: string, update: Partial<Omit<VoiceDriver, "id">>): void {
    const current = this.drivers.get(id);
    if (!current) return;
    const wasRunning = current.agentRunning;
    Object.assign(current, update);
    if (id !== this.driverId) return;
    if (update.speechText !== undefined) this.feedSpeech(update.speechText);
    if (wasRunning !== current.agentRunning) this.handleRunningChange(current.agentRunning);
    this.refresh();
  }

  unregisterDriver(id: string): void {
    this.drivers.delete(id);
    if (this.driverId === id) {
      this.driverId = null;
      this.electDriver();
    }
  }

  /** Mark the driver's current text as already seen so nothing on screen is replayed. */
  private primeSpeech(text: string): void {
    this.segmenter.reset();
    this.segmenter.push(text);
    this.segmenter.flush();
    this.speechSource = text;
    this.rememberSource(text);
  }

  private electDriver(): void {
    let best: VoiceDriver | null = null;
    for (const driver of this.drivers.values()) {
      if (!best || driver.priority > best.priority) best = driver;
    }
    const nextId = best?.id ?? null;
    if (nextId === this.driverId) return;
    this.driverId = nextId;
    // A surface change should not replay text that is already on screen.
    this.primeSpeech(best?.speechText ?? "");
    if (best?.agentRunning) this.clearReplyTimer();
    this.refresh();
  }

  // ------------------------------------------------------------ lifecycle

  /** Call from a user gesture so audio output is allowed to start. */
  async start(): Promise<void> {
    if (this.active) return;
    this.active = true;
    this.asrRetries = 0;
    this.reconnectPending = false;
    this.mutedUntilNextTurn = false;
    this.player.unlock();
    this.player.onDrain = () => {
      if (!this.speaker?.busy) this.patch({ caption: "" });
      this.refresh();
    };
    this.patch({ error: null, transcript: "", caption: "", level: 0, state: "connecting" });
    try {
      const session = await this.getSession();
      if (!this.active) return;
      this.player.sampleRate = session.tts.sampleRate;
      this.primeSpeech(this.driver?.speechText ?? "");
      await this.openAsr();
      this.startLevelLoop();
    } catch (cause) {
      this.fail(cause instanceof Error ? cause.message : String(cause));
    }
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.asrGeneration += 1;
    this.closeAsr();
    this.stopSpeech();
    this.speaker?.dispose();
    this.speaker = null;
    this.pendingTurn = [];
    this.userSpeaking = false;
    this.awaitingReply = false;
    this.clearTurnTimers();
    this.clearReplyTimer();
    this.stopLevelLoop();
    this.patch({ state: "off", transcript: "", caption: "", error: null, level: 0 });
  }

  toggle(): void {
    if (this.active) this.stop();
    else void this.start();
  }

  get isActive(): boolean {
    return this.active;
  }

  /**
   * The user sent input through another channel (typing). Treat it like a
   * spoken turn: stop reading the old reply and only voice what comes next.
   */
  noteUserInput(): void {
    if (!this.active) return;
    this.pendingTurn = [];
    this.userSpeaking = false;
    this.clearTurnTimers();
    this.mutedUntilNextTurn = false;
    this.interruptedByUser = false;
    this.deferred = [];
    this.stopSpeech();
    const driver = this.driver;
    this.primeSpeech(driver?.speechText ?? "");
    this.holdUntilNewMessage = Boolean(driver?.agentRunning);
    this.awaitingReply = true;
    this.armReplyTimer();
    this.patch({ transcript: "" });
    this.refresh();
  }

  /** Cut playback; the assistant stays quiet until the user's next turn. */
  interrupt(): void {
    if (!this.isSpeaking()) return;
    this.stopSpeech();
    this.mutedUntilNextTurn = true;
    this.interruptedByUser = true;
    this.deferred = [];
    this.refresh();
  }

  private fail(message: string): void {
    this.closeAsr();
    this.stopSpeech();
    this.patch({ error: message, state: this.active ? "error" : "off", caption: "", transcript: "" });
  }

  private async getSession(): Promise<DoubaoVoiceSession> {
    const cached = this.session;
    if (cached && cached.expiresAt - 30_000 > Date.now()) return cached;
    this.sessionPromise ??= fetchVoiceSession().then((session) => {
      this.session = session;
      return session;
    }).finally(() => { this.sessionPromise = null; });
    return this.sessionPromise;
  }

  private async getSdk() {
    this.sdk ??= await import("byted-ailab-speech-sdk");
    return this.sdk;
  }

  // ------------------------------------------------------------------ ASR

  private async openAsr(): Promise<void> {
    const generation = ++this.asrGeneration;
    const [session, sdk] = await Promise.all([this.getSession(), this.getSdk()]);
    if (!this.active || generation !== this.asrGeneration) return;
    this.tracker = createTurnTracker();
    this.asrConnected = false;
    const client = sdk.LabASR({
      onStart: () => {
        if (generation !== this.asrGeneration) return;
        this.asrConnected = true;
        this.asrRetries = 0;
        this.patch({ error: null });
        this.refresh();
      },
      onMessage: (_text, full) => {
        if (generation !== this.asrGeneration) return;
        const result = full && typeof full === "object" ? (full as { result?: unknown }).result : null;
        this.handleAsrResult(result && typeof result === "object" ? result as Parameters<TurnTracker["update"]>[0] : null);
      },
      onClose: () => {
        if (generation !== this.asrGeneration || !this.active) return;
        this.asrConnected = false;
        this.refresh();
        this.scheduleAsrReconnect();
      },
      onError: () => {
        if (generation !== this.asrGeneration || !this.active) return;
        this.asrConnected = false;
        this.scheduleAsrReconnect();
      },
    });
    this.asr = client;
    client.connect({
      url: authenticatedUrl(session.asr.endpoint, session, session.asr.resourceId),
      config: {
        user: { uid: "pi-web" },
        audio: { format: "pcm", rate: 16_000, bits: 16, channel: 1 },
        request: {
          model_name: "bigmodel",
          show_utterances: true,
          result_type: "full",
          enable_itn: true,
          enable_punc: true,
          end_window_size: 900,
        },
      },
    });
    try {
      await client.startRecord(
        { timeSlice: 200, numberOfAudioChannels: 1, desiredSampRate: 16_000, disableLogs: true },
        (chunk) => {
          if (generation !== this.asrGeneration) return;
          void micLevel(chunk).then((level) => {
            this.micLevelValue = this.micLevelValue * 0.55 + level * 0.45;
          }).catch(() => {});
        },
      );
    } catch (cause) {
      if (generation !== this.asrGeneration) return;
      this.fail(cause instanceof Error && cause.name === "NotAllowedError"
        ? "Microphone access was denied"
        : cause instanceof Error ? cause.message : String(cause));
      return;
    }
    if (generation !== this.asrGeneration) client.stopRecord();
  }

  private closeAsr(): void {
    this.asr?.stopRecord();
    this.asr = null;
    this.asrConnected = false;
  }

  private scheduleAsrReconnect(): void {
    if (this.reconnectPending) return;
    this.reconnectPending = true;
    this.closeAsr();
    if (this.asrRetries >= MAX_ASR_RETRIES) {
      this.reconnectPending = false;
      this.fail("Lost the connection to Doubao speech recognition");
      return;
    }
    const delay = 300 * 2 ** this.asrRetries;
    this.asrRetries += 1;
    const generation = this.asrGeneration;
    setTimeout(() => {
      this.reconnectPending = false;
      if (!this.active || generation !== this.asrGeneration) return;
      void this.openAsr().catch((cause) => this.fail(cause instanceof Error ? cause.message : String(cause)));
    }, delay);
  }

  private handleAsrResult(result: Parameters<TurnTracker["update"]>[0]): void {
    const update = this.tracker.update(result);
    let partial = update.partial;
    if (partial && this.isEcho(partial)) partial = "";
    const committed = update.committed.filter((text) => !this.isEcho(text));
    if (partial) {
      this.userSpeaking = true;
      this.patch({ transcript: [...this.pendingTurn, partial].join("") });
      if (this.isSpeaking() && partial.length >= BARGE_IN_MIN_CHARS) this.interrupt();
      // The user is still talking: wait for this utterance before sending the turn.
      if (this.turnTimer) clearTimeout(this.turnTimer);
      this.turnTimer = null;
      if (!update.hasUtterances) {
        this.clearStableTimer();
        this.stableTimer = setTimeout(() => {
          this.stableTimer = null;
          this.tracker.markCommitted(partial);
          this.pendingTurn.push(partial);
          this.commitTurn();
        }, TEXT_STABLE_MS);
      }
    } else if (!committed.length) {
      this.userSpeaking = false;
      if (!this.pendingTurn.length && this.deferred.length) this.speakSentences(this.deferred.splice(0));
    }
    if (committed.length) {
      this.userSpeaking = false;
      // A confirmed utterance during playback is the user talking over us, however short.
      if (this.isSpeaking()) this.interrupt();
      if (!this.pendingTurn.length) this.pendingSince = Date.now();
      this.pendingTurn.push(...committed);
      this.patch({ transcript: this.pendingTurn.join("") });
      this.armTurnTimer(turnWaitFor(this.pendingTurn.join(""), {
        completeMs: TURN_MERGE_MS,
        incompleteMs: TURN_MERGE_INCOMPLETE_MS,
      }));
    }
    this.refresh();
  }

  /** Commit after `delay`, unless the microphone says the user is still talking. */
  private armTurnTimer(delay: number): void {
    this.clearTurnTimers();
    this.turnTimer = setTimeout(() => {
      this.turnTimer = null;
      const heldFor = Date.now() - this.pendingSince;
      if (this.micLevelValue > STILL_TALKING_LEVEL && heldFor < TURN_MAX_HOLD_MS) {
        this.armTurnTimer(STILL_TALKING_RECHECK_MS);
        return;
      }
      this.commitTurn();
    }, delay);
  }

  private commitTurn(): void {
    const text = this.pendingTurn.join("").trim();
    this.pendingTurn = [];
    this.userSpeaking = false;
    this.patch({ transcript: "" });
    if (!text) {
      this.refresh();
      return;
    }
    const driver = this.driver;
    if (!driver) {
      this.refresh();
      return;
    }
    this.mutedUntilNextTurn = false;
    this.deferred = [];
    const interrupted = this.interruptedByUser;
    this.interruptedByUser = false;
    this.stopSpeech();
    if (driver.agentRunning && isVoiceAbortCommand(text)) {
      driver.onAbort();
      this.awaitingReply = false;
      this.refresh();
      return;
    }
    // Whatever was generated before the user spoke is old news: only text that
    // arrives from here on is a reply to what they just said. If the assistant
    // is mid-message, even its remaining sentences are stale.
    this.primeSpeech(driver.speechText);
    this.speechSource = driver.speechText;
    this.holdUntilNewMessage = driver.agentRunning;
    this.awaitingReply = true;
    this.armReplyTimer();
    if (!driver.agentRunning) driver.onPrompt(text);
    else if (interrupted && driver.onInterrupt) driver.onInterrupt(text);
    else driver.onSteer(text);
    // Tokens live five minutes; refresh before the reply needs a TTS session.
    void this.getSession().then(() => {
      if (this.active && this.awaitingReply) this.prewarmTts();
    }).catch(() => {});
    this.refresh();
  }

  private clearTurnTimers(): void {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
    this.clearStableTimer();
  }

  private clearStableTimer(): void {
    if (this.stableTimer) clearTimeout(this.stableTimer);
    this.stableTimer = null;
  }

  private armReplyTimer(): void {
    this.clearReplyTimer();
    this.replyTimer = setTimeout(() => {
      this.replyTimer = null;
      if (!this.driver?.agentRunning) {
        this.awaitingReply = false;
        this.refresh();
      }
    }, REPLY_TIMEOUT_MS);
  }

  private clearReplyTimer(): void {
    if (this.replyTimer) clearTimeout(this.replyTimer);
    this.replyTimer = null;
  }

  // --------------------------------------------------------------- speech

  private handleRunningChange(running: boolean): void {
    if (running) {
      this.clearReplyTimer();
      return;
    }
    // The turn ended: speak whatever is left and let the TTS session drain.
    this.awaitingReply = false;
    const driver = this.driver;
    if (driver) this.feedSpeech(driver.speechText);
    else this.finishSpeech();
  }

  private rememberSource(text: string): void {
    if (!text || this.finishedSources.includes(text)) return;
    this.finishedSources.push(text);
    if (this.finishedSources.length > 8) this.finishedSources.shift();
  }

  private feedSpeech(text: string): void {
    if (!this.active) return;
    const extendsCurrent = text.startsWith(this.speechSource);
    if (!extendsCurrent) {
      // Switching away from a message: whatever it said is now history.
      this.rememberSource(this.speechSource);
      if (this.holdUntilNewMessage) this.holdUntilNewMessage = false;
      if (this.finishedSources.includes(text)) {
        // An old reply resurfacing (e.g. the UI falling back to it) is not new speech.
        this.primeSpeech(text);
        return;
      }
    }
    this.speechSource = text;
    const sentences = this.segmenter.push(text);
    if (!this.holdUntilNewMessage) this.speakSentences(sentences);
    if (!this.driver?.agentRunning) this.finishSpeech();
  }

  /** Speak whatever tail is still pending once the agent stops streaming. */
  private finishSpeech(): void {
    const tail = this.segmenter.flush();
    if (!this.holdUntilNewMessage) this.speakSentences(tail);
    this.speaker?.endTurn();
  }

  private speakSentences(sentences: string[]): void {
    if (!this.active || !sentences.length || this.mutedUntilNextTurn) return;
    // Like a person, do not start talking over someone who is mid-sentence.
    if (this.userSpeaking || this.pendingTurn.length) {
      this.deferred.push(...sentences);
      return;
    }
    const speaker = this.ensureSpeaker();
    if (!speaker) return;
    for (const sentence of sentences) {
      // The server only synthesizes up to a sentence terminator.
      const spoken = TERMINATOR_RE.test(sentence) ? sentence : `${sentence}。`;
      this.spokenWindow.add(spoken);
      speaker.speak(spoken);
    }
    this.refresh();
  }

  private prewarmTts(): void {
    this.ensureSpeaker()?.prewarm();
  }

  private ensureSpeaker(): TtsSpeaker | null {
    const session = this.session;
    if (!session) return null;
    if (this.speaker && this.speakerToken !== session.token && !this.speaker.speaking) {
      // The short-lived token was refreshed; reconnect with the new one.
      this.speaker.dispose();
      this.speaker = null;
    }
    if (this.speaker) return this.speaker;
    const speaker = new TtsSpeaker({
      url: authenticatedUrl(session.tts.endpoint, session, session.tts.resourceId),
      speaker: session.tts.speaker,
      sampleRate: session.tts.sampleRate,
    }, {
      onAudio: (pcm) => {
        if (this.speaker !== speaker) return;
        this.player.enqueue(pcm);
        this.refresh();
      },
      onSentenceStart: (text) => {
        if (this.speaker !== speaker) return;
        this.patch({ caption: text });
        this.refresh();
      },
      onIdle: () => {
        if (this.speaker !== speaker) return;
        if (!this.player.isPlaying) this.patch({ caption: "" });
        this.refresh();
      },
      onError: (message) => {
        if (this.speaker !== speaker) return;
        this.patch({ error: message });
        this.refresh();
      },
    });
    this.speaker = speaker;
    this.speakerToken = session.token;
    return speaker;
  }

  private stopSpeech(): void {
    this.speaker?.cancel();
    this.player.stop();
    this.patch({ caption: "" });
  }

  // ---------------------------------------------------------------- level

  private startLevelLoop(): void {
    this.stopLevelLoop();
    this.levelTimer = setInterval(() => {
      const speaking = this.isSpeaking();
      const level = speaking ? this.player.level() : this.micLevelValue;
      this.patch({ level: Math.round(level * 100) / 100 });
    }, 80);
  }

  private stopLevelLoop(): void {
    if (this.levelTimer) clearInterval(this.levelTimer);
    this.levelTimer = null;
    this.micLevelValue = 0;
  }
}

declare global {
  var __piWebVoiceEngine: VoiceEngine | undefined;
}

export function getVoiceEngine(): VoiceEngine {
  globalThis.__piWebVoiceEngine ??= new VoiceEngine();
  return globalThis.__piWebVoiceEngine;
}
