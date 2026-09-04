/**
 * Binary framing for Doubao's bidirectional TTS WebSocket API.
 *
 * Frame: 4-byte header, then a big-endian uint32 event number, then for
 * session-scoped events a length-prefixed session id, then a length-prefixed
 * payload (JSON for control events, raw audio for TTSResponse).
 */

export const CLIENT_EVENT = {
  StartConnection: 1,
  FinishConnection: 2,
  StartSession: 100,
  FinishSession: 102,
  TaskRequest: 200,
} as const;

export const SERVER_EVENT = {
  ConnectionStarted: 50,
  ConnectionFailed: 51,
  ConnectionFinished: 52,
  SessionStarted: 150,
  SessionCanceled: 151,
  SessionFinished: 152,
  SessionFailed: 153,
  TTSSentenceStart: 350,
  TTSSentenceEnd: 351,
  TTSResponse: 352,
} as const;

const MESSAGE_TYPE = { clientFull: 1, serverFull: 9, serverAudio: 11, serverError: 15 } as const;
const FLAG_WITH_EVENT = 4;
const SERIALIZATION_JSON = 1;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface ServerFrame {
  kind: "event" | "error" | "unknown";
  event: number;
  sessionId: string;
  audio: ArrayBuffer | null;
  payload: Record<string, unknown> | null;
  errorCode: number;
  errorMessage: string;
}

const CONNECTION_EVENTS = new Set<number>([
  SERVER_EVENT.ConnectionStarted,
  SERVER_EVENT.ConnectionFailed,
  SERVER_EVENT.ConnectionFinished,
]);

export function encodeClientEvent(event: number, options: { sessionId?: string; payload?: unknown } = {}): ArrayBuffer {
  const payloadBytes = encoder.encode(options.payload === undefined ? "{}" : JSON.stringify(options.payload));
  const sessionBytes = options.sessionId ? encoder.encode(options.sessionId) : null;
  const length = 4 + 4 + (sessionBytes ? 4 + sessionBytes.byteLength : 0) + 4 + payloadBytes.byteLength;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  view.setUint8(0, (1 << 4) | 1);
  view.setUint8(1, (MESSAGE_TYPE.clientFull << 4) | FLAG_WITH_EVENT);
  view.setUint8(2, (SERIALIZATION_JSON << 4) | 0);
  view.setUint8(3, 0);
  let offset = 4;
  view.setUint32(offset, event);
  offset += 4;
  if (sessionBytes) {
    view.setUint32(offset, sessionBytes.byteLength);
    offset += 4;
    bytes.set(sessionBytes, offset);
    offset += sessionBytes.byteLength;
  }
  view.setUint32(offset, payloadBytes.byteLength);
  offset += 4;
  bytes.set(payloadBytes, offset);
  return buffer;
}

function parseJson(bytes: ArrayBuffer): Record<string, unknown> | null {
  try {
    const value = JSON.parse(decoder.decode(bytes)) as unknown;
    return value && typeof value === "object" ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export function decodeServerFrame(buffer: ArrayBuffer): ServerFrame {
  const view = new DataView(buffer);
  const frame: ServerFrame = { kind: "unknown", event: 0, sessionId: "", audio: null, payload: null, errorCode: 0, errorMessage: "" };
  if (buffer.byteLength < 4) return frame;
  const headerSize = (view.getUint8(0) & 0x0f) * 4;
  const messageType = view.getUint8(1) >> 4;
  const flags = view.getUint8(1) & 0x0f;
  let offset = headerSize;

  const readBlock = (): ArrayBuffer => {
    if (offset + 4 > buffer.byteLength) return new ArrayBuffer(0);
    const size = view.getUint32(offset);
    offset += 4;
    const block = buffer.slice(offset, Math.min(buffer.byteLength, offset + size));
    offset += size;
    return block;
  };

  if (messageType === MESSAGE_TYPE.serverError) {
    frame.kind = "error";
    frame.errorCode = offset + 4 <= buffer.byteLength ? view.getUint32(offset) : 0;
    offset += 4;
    const payload = parseJson(readBlock());
    frame.errorMessage = typeof payload?.message === "string" ? payload.message : "Doubao speech synthesis failed";
    if (typeof payload?.status_code === "number") frame.errorCode = payload.status_code;
    return frame;
  }
  if ((messageType !== MESSAGE_TYPE.serverFull && messageType !== MESSAGE_TYPE.serverAudio) || flags !== FLAG_WITH_EVENT) {
    return frame;
  }
  frame.kind = "event";
  frame.event = view.getUint32(offset);
  offset += 4;
  // Connection-level events carry a connect id, session events carry the session id.
  const id = decoder.decode(readBlock());
  if (!CONNECTION_EVENTS.has(frame.event)) frame.sessionId = id;
  const body = readBlock();
  if (messageType === MESSAGE_TYPE.serverAudio) {
    frame.audio = body;
  } else {
    frame.payload = parseJson(body);
  }
  return frame;
}
