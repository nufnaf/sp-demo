import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const component = await readFile(new URL("./VoiceActivityIndicator.tsx", import.meta.url), "utf8");
const hook = await readFile(new URL("../hooks/useRealtimeVoice.ts", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("voice input provides immediate status and a live microphone level meter", () => {
  assert.match(component, /role="status"/);
  assert.match(component, /voice-activity__meter/);
  assert.match(hook, /audioChunk\.slice\(44\)/);
  assert.match(hook, /setVoiceLevel\(smoothed\)/);
});

test("voice motion follows accessibility preferences", () => {
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media \(prefers-reduced-transparency: reduce\)/);
  assert.match(styles, /@media \(prefers-contrast: more\)/);
});
