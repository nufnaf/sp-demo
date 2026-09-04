import assert from "node:assert/strict";
import test from "node:test";

const { echoOverlap, looksLikeEcho, createSpokenTextWindow } = await import("./echo.ts");

test("fragments of what was just spoken count as echo", () => {
  const spoken = "派出去了，正在把那个网页改成亮色主题，改好我告诉你。";
  assert.equal(looksLikeEcho("这个网页改成亮色", spoken), true);
  assert.equal(looksLikeEcho("改好我告诉你。", spoken), true);
  assert.equal(looksLikeEcho("网页", spoken), true);
});

test("new requests are not mistaken for echo", () => {
  const spoken = "派出去了，正在把那个网页改成亮色主题，改好我告诉你。";
  assert.equal(looksLikeEcho("帮我查一下北京今天的天气", spoken), false);
  assert.equal(looksLikeEcho("停止", spoken), false);
  assert.ok(echoOverlap("把这个网页换成深色的并且加个标题", spoken) < 0.6);
});

test("answers that reuse the question's words are not echo at the threshold", () => {
  const spoken = "你是想问天气吗？如果是的话，告诉我你想知道哪个城市的天气，我帮你去查。";
  assert.equal(looksLikeEcho("帮我查一下北京的天气", spoken), false);
  assert.equal(looksLikeEcho("北京的天气", spoken), false);
});

test("spoken window expires after speech ends but not while speaking", () => {
  const window = createSpokenTextWindow(100, 1000);
  window.add("第一句。", 0);
  assert.equal(window.text(500, true), "第一句。");
  assert.equal(window.text(5000, true), "第一句。");
  window.touch(5000);
  assert.equal(window.text(5500, false), "第一句。");
  assert.equal(window.text(6500, false), "");
});
