import assert from "node:assert/strict";
import test from "node:test";

async function loadSubject() {
  return import("./text.ts");
}

test("normalizes markdown for speech without reading code or URLs", async () => {
  const { normalizeTextForSpeech } = await loadSubject();
  const result = normalizeTextForSpeech("## 完成\n- 查看 [文件](https://example.com)\n```ts\nconst secret = 1\n```");
  assert.equal(result, "完成 查看 文件 代码内容已显示在页面中。");
});

test("recognizes only explicit abort commands", async () => {
  const { isVoiceAbortCommand } = await loadSubject();
  assert.equal(isVoiceAbortCommand("停止任务。"), true);
  assert.equal(isVoiceAbortCommand("停止服务以后检查日志"), false);
});
