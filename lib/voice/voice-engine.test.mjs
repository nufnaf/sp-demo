import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

// ---- Browser globals the engine touches, mocked just enough.
globalThis.window = globalThis;
Object.defineProperty(globalThis, "navigator", { value: { vibrate() {} }, configurable: true });
globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({
    token: "t", expiresAt: Date.now() + 300_000, appId: "a",
    asr: { endpoint: "wss://asr", resourceId: "r" },
    tts: { endpoint: "wss://tts", resourceId: "r", speaker: "s", sampleRate: 16_000 },
  }),
});
class AudioNodeMock { connect() {} disconnect() {} }
class SourceMock extends AudioNodeMock { start() { setTimeout(() => this.onended?.(), 20); } stop() {} }
globalThis.AudioContext = class {
  state = "running"; currentTime = 0;
  createGain() { return new AudioNodeMock(); }
  createAnalyser() { const node = new AudioNodeMock(); node.fftSize = 256; node.getByteTimeDomainData = (buffer) => buffer.fill(128); return node; }
  get destination() { return new AudioNodeMock(); }
  createBuffer(_channels, length, rate) { return { duration: length / rate, getChannelData: () => new Float32Array(length) }; }
  createBufferSource() { return new SourceMock(); }
  async resume() {}
  async close() {}
};

const jiti = createJiti(import.meta.url, {
  alias: { "byted-ailab-speech-sdk": new URL("./__mocks__/speech-sdk.mjs", import.meta.url).pathname },
  tsconfigPaths: true,
});
const protocol = await jiti.import("./tts-protocol.ts");
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function serverFrame(messageType, event, id, body) {
  const idBytes = encoder.encode(id);
  const buffer = new ArrayBuffer(16 + idBytes.byteLength + body.byteLength);
  const view = new DataView(buffer);
  view.setUint8(0, 0x11); view.setUint8(1, (messageType << 4) | 4); view.setUint8(2, 0x10);
  view.setUint32(4, event); view.setUint32(8, idBytes.byteLength);
  new Uint8Array(buffer, 12).set(idBytes);
  view.setUint32(12 + idBytes.byteLength, body.byteLength);
  new Uint8Array(buffer, 16 + idBytes.byteLength).set(new Uint8Array(body));
  return buffer;
}
function decodeClientFrame(buffer) {
  const view = new DataView(buffer);
  let offset = 4;
  const event = view.getUint32(offset); offset += 4;
  let sessionId = "";
  if ([100, 102, 200].includes(event)) {
    const size = view.getUint32(offset); offset += 4;
    sessionId = decoder.decode(buffer.slice(offset, offset + size)); offset += size;
  }
  const size = view.getUint32(offset); offset += 4;
  return { event, sessionId, payload: JSON.parse(decoder.decode(buffer.slice(offset, offset + size)) || "{}") };
}

/** A Doubao TTS server that answers the protocol and records every sentence. */
const spoken = [];
globalThis.WebSocket = class {
  constructor() { this.readyState = 0; setTimeout(() => { this.readyState = 1; this.onopen?.(); }, 2); }
  send(data) {
    const frame = decodeClientFrame(data);
    const reply = (type, event, id, body) => setTimeout(() => this.onmessage?.({ data: serverFrame(type, event, id, body) }), 2);
    const empty = encoder.encode("{}").buffer;
    if (frame.event === protocol.CLIENT_EVENT.StartConnection) reply(9, protocol.SERVER_EVENT.ConnectionStarted, "c", empty);
    if (frame.event === protocol.CLIENT_EVENT.StartSession) reply(9, protocol.SERVER_EVENT.SessionStarted, frame.sessionId, empty);
    if (frame.event === protocol.CLIENT_EVENT.TaskRequest) { spoken.push(frame.payload.req_params.text); reply(11, protocol.SERVER_EVENT.TTSResponse, frame.sessionId, new Uint8Array(1600).buffer); }
    if (frame.event === protocol.CLIENT_EVENT.FinishSession) reply(9, protocol.SERVER_EVENT.SessionFinished, frame.sessionId, empty);
    if (frame.event === protocol.CLIENT_EVENT.FinishConnection) reply(9, protocol.SERVER_EVENT.ConnectionFinished, "c", empty);
  }
  close() { this.readyState = 3; setTimeout(() => this.onclose?.(), 1); }
};

const sdk = await jiti.import("./__mocks__/speech-sdk.mjs");
const { getVoiceEngine } = await jiti.import("./voice-engine.ts");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeDriver(engine) {
  const calls = [];
  const driver = {
    id: "desk", priority: 20, agentRunning: false, speechText: "",
    onPrompt: (text) => calls.push(["prompt", text]),
    onSteer: (text) => calls.push(["steer", text]),
    onInterrupt: (text) => calls.push(["interrupt", text]),
    onAbort: () => calls.push(["abort"]),
  };
  engine.registerDriver(driver);
  const update = (patch) => engine.updateDriver("desk", patch);
  const reply = async (chunks) => {
    update({ agentRunning: true }); update({ speechText: "" });
    await sleep(5);
    for (const chunk of chunks) { update({ speechText: chunk }); await sleep(5); }
    update({ agentRunning: false }); update({ speechText: chunks[chunks.length - 1] });
    await sleep(120);
  };
  return { driver, calls, update, reply };
}

async function say(asr, text, startTime) {
  asr.emit({ text, utterances: [{ text: text.slice(0, 2), definite: false, start_time: startTime }] });
  await sleep(20);
  asr.emit({ text, utterances: [{ text, definite: true, start_time: startTime, end_time: startTime + 900 }] });
}

test("a spoken turn is sent to the driver and the reply is voiced sentence by sentence", async () => {
  const engine = getVoiceEngine();
  const { calls, reply } = makeDriver(engine);
  await engine.start();
  await sleep(30);
  const asr = sdk.asrClients.at(-1);
  assert.equal(asr.recording, true);

  await say(asr, "现在几点了？", 0);
  await sleep(1_100);
  assert.deepEqual(calls, [["prompt", "现在几点了？"]]);
  assert.equal(engine.getSnapshot().state, "thinking");

  spoken.length = 0;
  await reply(["现在", "现在是下午四点。", "现在是下午四点。要提醒你什么吗？"]);
  assert.deepEqual(spoken, ["现在是下午四点。", "要提醒你什么吗？"]);
  engine.stop();
});

test("talking over a thinking assistant does not mute later replies", async () => {
  const engine = getVoiceEngine();
  const { calls, update, reply } = makeDriver(engine);
  await engine.start();
  await sleep(30);
  const asr = sdk.asrClients.at(-1);

  // Jarvis is busy with no text yet when the user speaks.
  update({ agentRunning: true }); update({ speechText: "" });
  await say(asr, "换个话题吧。", 5_000);
  await sleep(2_300);
  assert.deepEqual(calls.at(-1), ["steer", "换个话题吧。"]);

  // The desktop aborts and re-prompts; the new reply must be spoken.
  update({ agentRunning: false }); update({ speechText: "" });
  spoken.length = 0;
  await reply(["好啊，", "好啊，聊点什么呢？"]);
  assert.deepEqual(spoken, ["好啊，聊点什么呢？"]);
  engine.stop();
});
