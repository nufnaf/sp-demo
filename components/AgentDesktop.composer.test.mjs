import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const desktop = await readFile(new URL("./AgentDesktop.tsx", import.meta.url), "utf8");
const desktopCss = await readFile(new URL("./AgentDesktop.css", import.meta.url), "utf8");
const jarvisHook = await readFile(new URL("../hooks/useJarvis.ts", import.meta.url), "utf8");

test("restored Jarvis history does not appear as a fresh desktop reply", () => {
  assert.match(jarvisHook, /setLatestReplyTurnId\(pushTurn\(\{ role: "assistant", text \}\)\)/);
  assert.doesNotMatch(jarvisHook, /setLatestReplyTurnId\([^)]*lastAssistant/);
  assert.match(desktop, /\}, \[jarvis\.latestReplyTurnId\]\);/);
});

test("the desktop composer stays compact and swaps live voice for send when text exists", () => {
  assert.doesNotMatch(desktop, /composerFocused|className=\"attach\"/);
  assert.match(desktop, /\{prompt\.trim\(\) \? \([\s\S]*?className="send"[\s\S]*?: \([\s\S]*?className="voice realtime"/);
  assert.doesNotMatch(desktopCss, /agent-os-ai-surface\.expanded/);
  assert.doesNotMatch(desktopCss, /agent-os-ai-surface:not\(\.expanded\)/);
});

test("dictation returns stopped speech to the composer and only sends from the send control", () => {
  assert.match(desktop, /<div className="agent-os-dictation"[\s\S]*?<button className="jarvis-toggle"[\s\S]*?<BrandMark compact\/>/);
  assert.match(desktop, /dictationCompletionRef = useRef<"draft" \| "send">\("draft"\)/);
  assert.match(desktop, /dictationCompletionRef\.current === "draft"[\s\S]*?setPrompt\(completeText\)/);
  assert.match(desktop, /aria-label="停止听写并返回输入框"[\s\S]*?dictationCompletionRef\.current = "draft"; dictation\.stop\(\)/);
  assert.match(desktop, /aria-label="发送语音转录"[\s\S]*?dictationCompletionRef\.current = "send"; dictation\.stop\(\)/);
  assert.doesNotMatch(desktop, /agent-os-dictation__stop[^\n]*dictation\.cancel/);
  assert.doesNotMatch(desktop, /说吧，说完点右边发送|正在准备…|正在整理…|agent-os-dictation__cancel/);
  assert.match(desktopCss, /agent-os-dictation__stop > span[^}]*width: 9px;[^}]*height: 9px;[^}]*border-radius: 2px/);
  assert.match(desktopCss, /agent-os-dictation__wave > i[^}]*background: rgba\(43,53,59,\.5\)/);
  assert.doesNotMatch(desktopCss, /agent-os-dictation__(?:dot|wave)[^}]*#ff453a/);
});
