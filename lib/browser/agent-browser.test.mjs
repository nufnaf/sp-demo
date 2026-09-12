import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";
const jiti = createJiti(import.meta.url);
const { browserCommand, assertTaskUrl } = await jiti.import("./agent-browser.ts");

test("model input cannot select a browser, execute code, or inject CLI flags", () => {
  for (const action of ["tab_switch", "launch", "eval", "read", "close", "network", "upload", "bash"]) {
    assert.throws(() => browserCommand({ action }), /允许范围/);
  }
  for (const ref of ["body", "#secret", "@e1 --cdp 9222", "e1; echo test", "[data-id=1]"]) {
    assert.throws(() => browserCommand({ action: "click", ref }), /引用/);
  }
  assert.deepEqual(browserCommand({ action: "fill", ref: "e3", value: "a; $(echo b)", cdpUrl: "ws://other", tabId: "other" }), {
    action: "fill", selector: "@e3", value: "a; $(echo b)",
  });
});

test("task navigation rejects privileged URLs and every workbench hostname on its port", () => {
  for (const url of ["file:///tmp/test", "javascript:alert(1)", "http://localhost:30141/", "http://127.0.0.1:30141/api/agent/new", "http://other.test:30141/", "https://user:password@example.com/"]) {
    assert.throws(() => assertTaskUrl(url));
  }
  assert.equal(assertTaskUrl("http://127.0.0.1:30142"), "http://127.0.0.1:30142/");
});
