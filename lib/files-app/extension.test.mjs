import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { createFilesAppExtension } = await jiti.import("./extension.ts");
const { subscribeToFileEvents } = await jiti.import("./events.ts");

async function loadTool() {
  let registered;
  await createFilesAppExtension().factory({ registerTool(tool) { registered = tool; } });
  return registered;
}

test("file_open reveals a workspace file through the shared UI event", async () => {
  const tool = await loadTool();
  const received = [];
  const unsubscribe = subscribeToFileEvents((event) => received.push(event));
  try {
    const cwd = process.cwd();
    const response = await tool.execute("call", { path: "package.json", line: 4 }, undefined, undefined, { cwd });
    assert.equal(response.isError, undefined);
    assert.deepEqual(received, [{
      type: "file.open",
      cwd,
      filePath: path.join(cwd, "package.json"),
      line: 4,
      foreground: true,
    }]);
  } finally {
    unsubscribe();
  }
});

test("file_open rejects files outside the workspace", async () => {
  const tool = await loadTool();
  const response = await tool.execute("call", { path: "/etc/hosts" }, undefined, undefined, { cwd: process.cwd() });
  assert.equal(response.isError, true);
  assert.match(response.content[0].text, /outside the current workspace/);
});
