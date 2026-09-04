import { CLIENT_EVENT, decodeServerFrame, encodeClientEvent, SERVER_EVENT } from "./tts-protocol";

export interface TtsSpeakerConfig {
  url: string;
  speaker: string;
  sampleRate: number;
}

export interface TtsSpeakerCallbacks {
  onAudio(pcm: ArrayBuffer): void;
  /** A sentence was handed to the synthesizer; its audio follows shortly. */
  onSentenceStart(text: string): void;
  /** The current turn's speech has been fully delivered or dropped. */
  onIdle(): void;
  onError(message: string): void;
}

type ConnectionState = "closed" | "connecting" | "ready";

interface TurnSession {
  id: string;
  ready: boolean;
  finishRequested: boolean;
}

function randomId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

/**
 * Streams one assistant turn through a single Doubao bidirectional TTS session
 * on a persistent connection. Sentences are appended as they arrive so the
 * voice keeps one consistent timbre and prosody across the whole turn; the
 * server synthesizes each sentence as soon as its terminator arrives.
 */
export class TtsSpeaker {
  private socket: WebSocket | null = null;
  private connection: ConnectionState = "closed";
  private session: TurnSession | null = null;
  private readonly queue: string[] = [];
  private endAfterFlush = false;
  private lastTextAt = 0;
  private lastAudioAt = 0;
  private disposed = false;

  constructor(private readonly config: TtsSpeakerConfig, private readonly callbacks: TtsSpeakerCallbacks) {}

  /** Text has been sent whose audio has not started arriving yet. */
  get busy(): boolean {
    return this.queue.length > 0 || (this.session !== null && this.lastTextAt > this.lastAudioAt);
  }

  get speaking(): boolean {
    return this.session !== null || this.queue.length > 0;
  }

  prewarm(): void {
    if (this.connection === "closed") this.connect();
  }

  speak(text: string): void {
    if (this.disposed) return;
    this.queue.push(text);
    this.endAfterFlush = false;
    this.pump();
  }

  /** No more sentences will follow for this turn. */
  endTurn(): void {
    if (!this.session && !this.queue.length) return;
    this.endAfterFlush = true;
    this.pump();
  }

  /** Drop everything queued or in flight; closing the socket is the only way
   * to stop audio the server is still producing. */
  cancel(): void {
    const hadWork = this.speaking;
    this.queue.length = 0;
    this.session = null;
    this.endAfterFlush = false;
    this.closeSocket();
    if (hadWork) this.callbacks.onIdle();
  }

  dispose(): void {
    this.disposed = true;
    this.queue.length = 0;
    this.session = null;
    this.closeSocket();
  }

  private connect(): void {
    if (this.disposed) return;
    this.closeSocket();
    this.connection = "connecting";
    const socket = new WebSocket(this.config.url);
    socket.binaryType = "arraybuffer";
    this.socket = socket;
    socket.onopen = () => {
      if (this.socket === socket) socket.send(encodeClientEvent(CLIENT_EVENT.StartConnection));
    };
    socket.onmessage = (event: MessageEvent<ArrayBuffer | string>) => {
      if (this.socket !== socket || !(event.data instanceof ArrayBuffer)) return;
      this.handleFrame(event.data);
    };
    socket.onerror = () => {
      if (this.socket === socket) this.callbacks.onError("Unable to connect to Doubao speech synthesis");
    };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.connection = "closed";
      const hadWork = this.speaking;
      this.queue.length = 0;
      this.session = null;
      this.endAfterFlush = false;
      if (hadWork) {
        this.callbacks.onError("Doubao speech synthesis dropped the connection");
        this.callbacks.onIdle();
      }
    };
  }

  private closeSocket(): void {
    const socket = this.socket;
    this.socket = null;
    this.connection = "closed";
    if (!socket) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    try { socket.close(); } catch { /* already closed */ }
  }

  private payload(text?: string) {
    return {
      user: { uid: "pi-web" },
      namespace: "BidirectionalTTS",
      req_params: {
        ...(text === undefined ? {} : { text }),
        speaker: this.config.speaker,
        audio_params: { format: "pcm", sample_rate: this.config.sampleRate },
        additions: JSON.stringify({ disable_markdown_filter: false, enable_latex_tn: true }),
      },
    };
  }

  private pump(): void {
    if (this.disposed) return;
    if (this.connection === "closed") {
      this.connect();
      return;
    }
    if (this.connection !== "ready") return;
    if (!this.session) {
      if (!this.queue.length) return;
      this.session = { id: randomId(), ready: false, finishRequested: false };
      this.socket?.send(encodeClientEvent(CLIENT_EVENT.StartSession, { sessionId: this.session.id, payload: this.payload() }));
      return;
    }
    if (!this.session.ready || this.session.finishRequested) return;
    for (const text of this.queue.splice(0)) {
      this.lastTextAt = Date.now();
      this.callbacks.onSentenceStart(text);
      this.socket?.send(encodeClientEvent(CLIENT_EVENT.TaskRequest, { sessionId: this.session.id, payload: this.payload(text) }));
    }
    if (this.endAfterFlush) {
      this.session.finishRequested = true;
      this.socket?.send(encodeClientEvent(CLIENT_EVENT.FinishSession, { sessionId: this.session.id }));
    }
  }

  private handleFrame(buffer: ArrayBuffer): void {
    const frame = decodeServerFrame(buffer);
    if (frame.kind === "error") {
      this.callbacks.onError(frame.errorMessage);
      this.cancel();
      return;
    }
    if (frame.kind !== "event") return;
    const session = this.session;
    switch (frame.event) {
      case SERVER_EVENT.ConnectionStarted:
        this.connection = "ready";
        this.pump();
        break;
      case SERVER_EVENT.ConnectionFailed: {
        const message = typeof frame.payload?.message === "string" ? frame.payload.message : "Doubao speech synthesis refused the connection";
        this.callbacks.onError(message);
        this.cancel();
        break;
      }
      case SERVER_EVENT.SessionStarted:
        if (!session || frame.sessionId !== session.id) break;
        session.ready = true;
        this.pump();
        break;
      case SERVER_EVENT.TTSResponse:
        if (!session || frame.sessionId !== session.id || !frame.audio?.byteLength) break;
        this.lastAudioAt = Date.now();
        this.callbacks.onAudio(frame.audio);
        break;
      case SERVER_EVENT.SessionFinished:
        if (!session || frame.sessionId !== session.id) break;
        this.session = null;
        this.endAfterFlush = false;
        this.lastAudioAt = Date.now();
        if (this.queue.length) this.pump();
        else this.callbacks.onIdle();
        break;
      case SERVER_EVENT.SessionFailed:
      case SERVER_EVENT.SessionCanceled: {
        if (!session || frame.sessionId !== session.id) break;
        const message = typeof frame.payload?.message === "string" ? frame.payload.message : "Doubao speech synthesis failed";
        this.callbacks.onError(message);
        this.session = null;
        this.endAfterFlush = false;
        if (this.queue.length) this.pump();
        else this.callbacks.onIdle();
        break;
      }
      default:
        break;
    }
  }
}
