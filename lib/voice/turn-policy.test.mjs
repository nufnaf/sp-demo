import assert from "node:assert/strict";
import test from "node:test";

const { looksCompleteUtterance, turnWaitFor } = await import("./turn-policy.ts");

test("short or dangling fragments read as unfinished", () => {
  assert.equal(looksCompleteUtterance("帮我。"), false);
  assert.equal(looksCompleteUtterance("再帮我。"), false);
  assert.equal(looksCompleteUtterance("帮我查一下北京的"), false);
  assert.equal(looksCompleteUtterance("我想让你把这个。"), false);
  assert.equal(looksCompleteUtterance("是的"), false);
});

test("finished sentences read as complete", () => {
  assert.equal(looksCompleteUtterance("再帮我查询一下上海的天气。"), true);
  assert.equal(looksCompleteUtterance("把这个网页换成亮色的。"), true);
  assert.equal(looksCompleteUtterance("现在干到哪了？"), true);
});

test("unfinished utterances wait longer", () => {
  const options = { completeMs: 900, incompleteMs: 2000 };
  assert.equal(turnWaitFor("帮我。", options), 2000);
  assert.equal(turnWaitFor("现在干到哪了？", options), 900);
});
