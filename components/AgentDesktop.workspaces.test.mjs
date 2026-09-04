import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./AgentDesktop.tsx", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/workspaces/route.ts", import.meta.url), "utf8");

test("desktop scopes tasks, counts, and artifact extraction to the active workspace", () => {
  assert.match(source, /sessions\.filter\(\(session\) => \([\s\S]*?session\.cwd === activeCwd[\s\S]*?session\.id !== jarvisSessionId/);
  assert.match(source, /workspaceSessions\.filter\(\(session\) => !isInsightTaskSession\(session\)\)/);
  assert.match(source, /Promise\.all\(workspaceSessions\.map/);
  assert.match(source, /const runningCount = workspaceSessions\.filter/);
});

test("workspace switching clears task and artifact window state", () => {
  assert.match(source, /const switchWorkspace = useCallback[\s\S]*?setTaskSessionId\(null\)[\s\S]*?setOpenArtifacts\(\[\]\)/);
});

test("initial session hydration establishes a baseline instead of opening historical artifacts", () => {
  assert.match(source, /workspaceSessions\.length === 0[\s\S]*?knownArtifactIdsRef\.current = null/);
  assert.match(source, /if \(knownIds\) \{[\s\S]*?setOpenArtifacts/);
});

test("workspace manager uses real workspace statistics and only managed cards expose deletion", () => {
  assert.match(source, /const workspaceStats = useMemo/);
  assert.match(source, /className="agent-os-workspace-grid"/);
  assert.match(source, /workspace\.managed && <button className="delete"/);
  assert.match(route, /if \(!isManagedWorkspacePath\(cwd\)\)/);
  assert.match(route, /getRunningRpcSessionIds\(\)/);
});

test("new workspace interaction follows the solo demo and creates a named workspace immediately", () => {
  assert.match(source, /const name = `新工作台 \$\{nextNumber\}`/);
  assert.match(source, /onClick=\{\(\) => void createWorkspace\(\)\}/);
  assert.match(source, /aria-label="新建工作台"/);
  assert.doesNotMatch(source, /window\.prompt\("给新工作台命名"/);
});

test("arbitrary session directories do not become phantom workspace cards", () => {
  const workspaceBlock = source.slice(source.indexOf("const workspaces = useMemo"), source.indexOf("const workspaceStats = useMemo"));
  assert.doesNotMatch(workspaceBlock, /for \(const session of sessions\)/);
});
