import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { interopDefault: true });
const {
  createManagedWorkspace,
  forgetManagedWorkspace,
  isManagedWorkspacePath,
  listManagedWorkspaces,
} = await jiti.import("./workspaces.ts");

test("managed workspaces persist independently even before they have sessions", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "pi-web-workspaces-"));
  const home = join(root, "home");
  const registry = join(root, "agent", "workspaces.json");
  mkdirSync(home, { recursive: true });
  t.after(() => rm(root, { recursive: true, force: true }));

  const first = createManagedWorkspace("产品研发", home, registry, new Date("2026-09-04T01:02:03.000Z"));
  const second = createManagedWorkspace("市场洞察", home, registry, new Date("2026-09-04T01:02:04.000Z"));

  assert.equal(existsSync(first.cwd), true);
  assert.equal(existsSync(second.cwd), true);
  assert.deepEqual(listManagedWorkspaces(home, registry).map(({ name }) => name), ["市场洞察", "产品研发"]);
});

test("legacy daily workspaces are discovered and can be forgotten without deleting others", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "pi-web-workspaces-"));
  const home = join(root, "home");
  const registry = join(root, "agent", "workspaces.json");
  mkdirSync(join(home, "pi-cwd-20260901"), { recursive: true });
  mkdirSync(join(home, "ordinary-project"), { recursive: true });
  t.after(() => rm(root, { recursive: true, force: true }));

  const created = createManagedWorkspace("临时", home, registry, new Date("2026-09-04T01:02:03.000Z"));
  forgetManagedWorkspace(created.cwd, registry);
  const listed = listManagedWorkspaces(home, registry);

  assert.deepEqual(listed.map(({ name }) => name), ["pi-cwd-20260901", "pi-cwd-20260904-010203"]);
  assert.equal(isManagedWorkspacePath(join(home, "pi-cwd-20260901"), home), true);
  assert.equal(isManagedWorkspacePath(join(home, "ordinary-project"), home), false);
  assert.equal(isManagedWorkspacePath(join(home, "nested", "pi-cwd-20260901"), home), false);
});
