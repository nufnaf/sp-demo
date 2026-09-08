import { presentationCwd, applicationDataDir } from "./presentation-runtime";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { writePrivateFileAtomicSync } from "./atomic-file";

export interface ManagedWorkspace {
  cwd: string;
  name: string;
  managed: true;
  createdAt: string;
}

interface WorkspaceRegistry {
  version: 1;
  workspaces: ManagedWorkspace[];
}

const MANAGED_DIRECTORY_PATTERN = /^pi-cwd-\d{8}(?:-\d{6}(?:-\d+)?)?$/;

export function getWorkspaceRegistryPath(agentDir = applicationDataDir()): string {
  return join(agentDir, "workspaces.json");
}

function defaultName(cwd: string): string {
  return basename(cwd) || cwd;
}

function readRegistry(registryPath = getWorkspaceRegistryPath()): WorkspaceRegistry {
  if (!existsSync(registryPath)) return { version: 1, workspaces: [] };
  try {
    const parsed = JSON.parse(readFileSync(registryPath, "utf8")) as Partial<WorkspaceRegistry>;
    if (!Array.isArray(parsed.workspaces)) return { version: 1, workspaces: [] };
    return {
      version: 1,
      workspaces: parsed.workspaces.filter((item): item is ManagedWorkspace => (
        Boolean(item)
        && typeof item.cwd === "string"
        && typeof item.name === "string"
        && typeof item.createdAt === "string"
        && item.managed === true
      )),
    };
  } catch {
    return { version: 1, workspaces: [] };
  }
}

function writeRegistry(registry: WorkspaceRegistry, registryPath = getWorkspaceRegistryPath()): void {
  mkdirSync(dirname(registryPath), { recursive: true });
  writePrivateFileAtomicSync(registryPath, JSON.stringify(registry, null, 2));
}

export function isManagedWorkspacePath(cwd: string, home = homedir()): boolean {
  const resolved = resolve(cwd);
  return dirname(resolved) === resolve(home) && MANAGED_DIRECTORY_PATTERN.test(basename(resolved));
}

export function listManagedWorkspaces(
  home = homedir(),
  registryPath = getWorkspaceRegistryPath(),
): ManagedWorkspace[] {
  const demo = presentationCwd();
  if (demo) return [{ cwd: demo, name: "招聘工作台", managed: true, createdAt: new Date(0).toISOString() }];
  const registry = readRegistry(registryPath);
  const byCwd = new Map(
    registry.workspaces
      .filter((workspace) => isManagedWorkspacePath(workspace.cwd, home) && existsSync(workspace.cwd))
      .map((workspace) => [resolve(workspace.cwd), { ...workspace, cwd: resolve(workspace.cwd) }]),
  );

  // Older Pi Web workspaces predate the registry. Keep them available and
  // deletable without requiring a migration step.
  try {
    for (const entry of readdirSync(home, { withFileTypes: true })) {
      if (!entry.isDirectory() || !MANAGED_DIRECTORY_PATTERN.test(entry.name)) continue;
      const cwd = join(home, entry.name);
      if (!byCwd.has(cwd)) {
        byCwd.set(cwd, { cwd, name: entry.name, managed: true, createdAt: new Date(0).toISOString() });
      }
    }
  } catch {
    // An unreadable home directory simply yields the persisted valid entries.
  }
  return [...byCwd.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createManagedWorkspace(
  requestedName?: string,
  home = homedir(),
  registryPath = getWorkspaceRegistryPath(),
  now = new Date(),
): ManagedWorkspace {
  const demo = presentationCwd();
  if (demo) return { cwd: demo, name: "招聘工作台", managed: true, createdAt: new Date(0).toISOString() };
  const stamp = now.toISOString().replace(/[-:]/g, "").slice(0, 15).replace("T", "-");
  let suffix = 0;
  let cwd = join(home, `pi-cwd-${stamp}`);
  while (existsSync(cwd)) {
    suffix += 1;
    cwd = join(home, `pi-cwd-${stamp}-${suffix}`);
  }
  mkdirSync(cwd, { recursive: false });

  const name = requestedName?.trim().slice(0, 80) || defaultName(cwd);
  const workspace: ManagedWorkspace = { cwd, name, managed: true, createdAt: now.toISOString() };
  const registry = readRegistry(registryPath);
  writeRegistry({ version: 1, workspaces: [workspace, ...registry.workspaces] }, registryPath);
  return workspace;
}

export function forgetManagedWorkspace(cwd: string, registryPath = getWorkspaceRegistryPath()): void {
  const target = resolve(cwd);
  const registry = readRegistry(registryPath);
  writeRegistry({
    version: 1,
    workspaces: registry.workspaces.filter((workspace) => resolve(workspace.cwd) !== target),
  }, registryPath);
}
