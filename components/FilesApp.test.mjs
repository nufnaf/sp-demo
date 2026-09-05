import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const desktop = await readFile(new URL("./AgentDesktop.tsx", import.meta.url), "utf8");
const filesApp = await readFile(new URL("./FilesApp.tsx", import.meta.url), "utf8");
const rpcManager = await readFile(new URL("../lib/rpc-manager.ts", import.meta.url), "utf8");

test("Agent OS exposes the workspace Files system app", () => {
  assert.match(desktop, /id: "system:files", name: "文件"/);
  assert.match(desktop, /<FilesApp key=\{activeCwd\}/);
  assert.match(filesApp, /<FileExplorer/);
  assert.match(filesApp, /new EditorView/);
});

test("the agent runtime registers the files app bridge", () => {
  assert.match(rpcManager, /createFilesAppExtension\(\)/);
});

test("file search is always visible and view controls belong to the active file", () => {
  assert.match(filesApp, /fileSearchOpen\s*\/>/);
  assert.match(filesApp, /className="agent-file-detail-toolbar"/);
  assert.match(filesApp, /aria-label="文件显示方式"/);
  assert.doesNotMatch(filesApp, />Diff</);
  assert.doesNotMatch(filesApp, />保存</);
});

test("the active file renders a workspace-relative breadcrumb", () => {
  assert.match(filesApp, /function FileBreadcrumb/);
  assert.match(filesApp, /aria-label="文件路径"/);
  assert.match(filesApp, /getFileName\(cwd\), \.\.\.pathParts/);
});
