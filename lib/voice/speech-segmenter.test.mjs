import assert from "node:assert/strict";
import test from "node:test";

import { createJiti } from "jiti";

const { createSpeechSegmenter } = await createJiti(import.meta.url).import("./speech-segmenter.ts");

test("emits sentences as streamed text grows and flushes the tail", () => {
  const segmenter = createSpeechSegmenter();
  assert.deepEqual(segmenter.push("好的，我来看"), []);
  assert.deepEqual(segmenter.push("好的，我来看一下。首先"), ["好的，我来看一下。"]);
  assert.deepEqual(segmenter.push("好的，我来看一下。首先读取配置文件"), []);
  assert.deepEqual(segmenter.flush(), ["首先读取配置文件"]);
  assert.deepEqual(segmenter.flush(), []);
});

test("keeps decimals and waits for a possible fence before speaking", () => {
  const segmenter = createSpeechSegmenter();
  assert.deepEqual(segmenter.push("Version 1.5 is ready. Next ``"), ["Version 1.5 is ready."]);
  assert.deepEqual(segmenter.push("Version 1.5 is ready. Next ```ts\nconst x = 1;\n"), ["Next"]);
  assert.deepEqual(segmenter.push("Version 1.5 is ready. Next ```ts\nconst x = 1;\n```\n完成。"), [
    "代码内容已显示在页面中。",
    "完成。",
  ]);
});

test("a text that does not extend the previous one starts a new source", () => {
  const segmenter = createSpeechSegmenter();
  segmenter.push("我先检查日志");
  assert.deepEqual(segmenter.push("日志显示一切正常。"), ["我先检查日志", "日志显示一切正常。"]);
  assert.deepEqual(segmenter.push(""), []);
});

test("stops after the spoken budget with a single notice", () => {
  const segmenter = createSpeechSegmenter({ maxChars: 10, overflowNotice: "更多内容请查看页面。" });
  assert.deepEqual(segmenter.push("一二三四五六。七八九十。十一十二。"), ["一二三四五六。", "更多内容请查看页面。"]);
  assert.deepEqual(segmenter.flush(), []);
});

test("strips markdown so lists and links read naturally", () => {
  const segmenter = createSpeechSegmenter();
  assert.deepEqual(segmenter.push("## 结论\n- 查看 [文档](https://example.com)\n"), ["结论", "查看 文档"]);
});
