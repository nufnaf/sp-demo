import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const {
  BROWSER_MUTATING_TOOL_NAMES,
  BROWSER_READ_TOOL_NAMES,
  createBrowserExtension,
} = await jiti.import("./extension.ts");
const { normalizeBrowserUrl } = await jiti.import("./manager.ts");

test("browser extension exposes the compact Agent browser tool set", async () => {
  const tools = new Map();
  await createBrowserExtension().factory({
    registerTool(tool) { tools.set(tool.name, tool); },
  });

  assert.deepEqual([...tools.keys()], [
    "browser_open",
    "browser_tabs",
    "browser_navigate",
    "browser_snapshot",
    "browser_act",
    "browser_screenshot",
  ]);
  assert.deepEqual([...BROWSER_MUTATING_TOOL_NAMES], ["browser_act"]);
  assert.ok(BROWSER_READ_TOOL_NAMES.includes("browser_navigate"));
  assert.match(tools.get("browser_open").promptGuidelines.join(" "), /refs expire/);
  assert.match(tools.get("browser_open").promptGuidelines.join(" "), /untrusted data/);
});

test("browser navigation accepts web addresses and rejects privileged schemes", () => {
  assert.equal(normalizeBrowserUrl(), "about:blank");
  assert.equal(normalizeBrowserUrl("example.com/path"), "https://example.com/path");
  assert.equal(normalizeBrowserUrl("http://127.0.0.1:30141"), "http://127.0.0.1:30141/");
  assert.equal(normalizeBrowserUrl("苹果设计"), "https://www.google.com/search?q=%E8%8B%B9%E6%9E%9C%E8%AE%BE%E8%AE%A1");
  assert.throws(() => normalizeBrowserUrl("file:///etc/passwd"), /only supports http and https/);
  assert.throws(() => normalizeBrowserUrl("javascript:alert(1)"), /only supports http and https/);
  assert.throws(() => normalizeBrowserUrl("about:config"), /Only about:blank/);
});

test("browser pages default to shared control and serialize human and Agent operations", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("./manager.ts", import.meta.url), "utf8"));
  assert.match(source, /controller: "shared"/);
  assert.match(source, /operationTail: Promise<void>/);
  assert.match(source, /return this\.serialize\(managed/);
  assert.doesNotMatch(source, /user currently controls|Take control of the browser/);
  assert.match(source, /keyboard\.insertText\(input\.text\)/);
});
