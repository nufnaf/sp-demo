import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const hook = await readFile(new URL("./useJarvis.ts", import.meta.url), "utf8");
const engine = await readFile(new URL("../lib/voice/voice-engine.ts", import.meta.url), "utf8");

test("speech text never falls back to an older reply while a turn is running", () => {
  // Between a tool call and the next message there is no streaming text; an
  // older reply resurfacing here was voiced again as if it were new.
  assert.match(hook, /const speechText = streamingText \?\? \(running \? "" : lastReply\);/);
  assert.match(hook, /case "agent_start":[\s\S]*?setLastReply\(""\);/);
});

test("the voice engine treats a resurfacing finished reply as history", () => {
  assert.match(engine, /finishedSources\.includes\(text\)/);
  assert.match(engine, /this\.rememberSource\(this\.speechSource\);/);
});
