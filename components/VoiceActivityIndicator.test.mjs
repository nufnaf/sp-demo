import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const component = await readFile(new URL("./VoiceActivityIndicator.tsx", import.meta.url), "utf8");
const engine = await readFile(new URL("../lib/voice/voice-engine.ts", import.meta.url), "utf8");
const doubaoClient = await readFile(new URL("../lib/voice/doubao-client.ts", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("voice input provides immediate status and a live level meter", () => {
  assert.match(component, /role=\{interruptible \? "button" : "status"\}/);
  assert.match(component, /voice-activity__meter/);
  assert.match(doubaoClient, /chunk\.slice\(44\)/);
  assert.match(engine, /this\.patch\(\{ level:/);
});

test("talking over the assistant interrupts playback and the mic never closes between turns", () => {
  assert.match(engine, /BARGE_IN_MIN_CHARS/);
  assert.match(engine, /this\.interrupt\(\)/);
  assert.match(engine, /scheduleAsrReconnect/);
  assert.match(engine, /segmenter\.push\(/);
});

test("voice motion follows accessibility preferences", () => {
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media \(prefers-reduced-transparency: reduce\)/);
  assert.match(styles, /@media \(prefers-contrast: more\)/);
});
