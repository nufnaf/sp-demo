import assert from "node:assert/strict";
import test from "node:test";

const { createTurnTracker } = await import("./turn-detector.ts");

test("reports newly finalized utterances once and the live partial", () => {
  const tracker = createTurnTracker();
  assert.deepEqual(tracker.update({ text: "帮我", utterances: [{ text: "帮我", definite: false }] }), {
    committed: [], partial: "帮我", hasUtterances: true,
  });
  assert.deepEqual(tracker.update({ text: "帮我整理会议纪要", utterances: [{ text: "帮我整理会议纪要", definite: true }] }), {
    committed: ["帮我整理会议纪要"], partial: "", hasUtterances: true,
  });
  assert.deepEqual(tracker.update({
    text: "帮我整理会议纪要 然后",
    utterances: [{ text: "帮我整理会议纪要", definite: true }, { text: "然后", definite: false }],
  }), { committed: [], partial: "然后", hasUtterances: true });
});

test("does not replay a finalized utterance even if the recognizer drops it later", () => {
  const tracker = createTurnTracker();
  tracker.update({ utterances: [{ text: "第一句", definite: true, start_time: 0 }] });
  assert.deepEqual(tracker.update({ utterances: [{ text: "第二句", definite: true, start_time: 1200 }] }).committed, ["第二句"]);
  assert.deepEqual(tracker.update({ utterances: [{ text: "第一句", definite: true, start_time: 0 }, { text: "第二句", definite: true, start_time: 1200 }] }).committed, []);
});

test("falls back to accumulated text when no utterances are provided", () => {
  const tracker = createTurnTracker();
  assert.deepEqual(tracker.update({ text: "你好" }), { committed: [], partial: "你好", hasUtterances: false });
  tracker.markCommitted("你好");
  assert.deepEqual(tracker.update({ text: "你好 再见" }).partial, "再见");
  assert.deepEqual(tracker.update(null), { committed: [], partial: "", hasUtterances: false });
});
