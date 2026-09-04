import assert from "node:assert/strict";
import test from "node:test";

const { encodeClientEvent, decodeServerFrame, SERVER_EVENT, CLIENT_EVENT } = await import("./tts-protocol.ts");

test("encodes a session event with header, event, session id, and payload", () => {
  const frame = encodeClientEvent(CLIENT_EVENT.TaskRequest, { sessionId: "abc", payload: { a: 1 } });
  const view = new DataView(frame);
  assert.equal(view.getUint8(0), 0x11);
  assert.equal(view.getUint8(1), 0x14);
  assert.equal(view.getUint8(2), 0x10);
  assert.equal(view.getUint32(4), 200);
  assert.equal(view.getUint32(8), 3);
  assert.equal(new TextDecoder().decode(frame.slice(12, 15)), "abc");
  assert.equal(view.getUint32(15), 7);
  assert.equal(new TextDecoder().decode(frame.slice(19)), "{\"a\":1}");
});

function serverFrame(messageType, event, id, body) {
  const idBytes = new TextEncoder().encode(id);
  const buffer = new ArrayBuffer(4 + 4 + 4 + idBytes.byteLength + 4 + body.byteLength);
  const view = new DataView(buffer);
  view.setUint8(0, 0x11);
  view.setUint8(1, (messageType << 4) | 4);
  view.setUint8(2, 0x10);
  view.setUint32(4, event);
  view.setUint32(8, idBytes.byteLength);
  new Uint8Array(buffer, 12).set(idBytes);
  view.setUint32(12 + idBytes.byteLength, body.byteLength);
  new Uint8Array(buffer, 16 + idBytes.byteLength).set(new Uint8Array(body));
  return buffer;
}

test("decodes audio and control frames", () => {
  const audio = serverFrame(11, SERVER_EVENT.TTSResponse, "sess", new Uint8Array([1, 2, 3]).buffer);
  const decoded = decodeServerFrame(audio);
  assert.equal(decoded.kind, "event");
  assert.equal(decoded.event, SERVER_EVENT.TTSResponse);
  assert.equal(decoded.sessionId, "sess");
  assert.deepEqual([...new Uint8Array(decoded.audio)], [1, 2, 3]);

  const failed = serverFrame(9, SERVER_EVENT.SessionFailed, "sess", new TextEncoder().encode("{\"status_code\":45000000,\"message\":\"bad\"}").buffer);
  const decodedFailed = decodeServerFrame(failed);
  assert.equal(decodedFailed.payload.message, "bad");

  const started = serverFrame(9, SERVER_EVENT.ConnectionStarted, "connect-id", new TextEncoder().encode("{}").buffer);
  assert.equal(decodeServerFrame(started).sessionId, "");
});
