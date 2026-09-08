import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { applicationDataDir } from "./presentation-runtime";
import { writePrivateFileAtomicSync } from "./atomic-file";

interface StoredRegistry {
  version: 1;
  /** Active Jarvis session per working directory. */
  sessions: Record<string, string>;
  /** Every Jarvis session ever created, so old ones stay hidden from task lists. */
  known: string[];
}

export function getJarvisRegistryPath(agentDir = applicationDataDir()): string {
  return join(agentDir, "pi-web", "jarvis.json");
}

function readRegistry(path: string): StoredRegistry {
  if (!existsSync(path)) return { version: 1, sessions: {}, known: [] };
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<StoredRegistry>;
    if (parsed?.version === 1 && parsed.sessions && typeof parsed.sessions === "object") {
      const sessions = { ...parsed.sessions };
      const known = new Set<string>(Array.isArray(parsed.known) ? parsed.known.filter((id): id is string => typeof id === "string") : []);
      for (const id of Object.values(sessions)) known.add(id);
      return { version: 1, sessions, known: [...known] };
    }
  } catch {
    // A corrupt registry only loses the mapping; a new Jarvis session is created.
  }
  return { version: 1, sessions: {}, known: [] };
}

/** The Jarvis session remembered for a working directory, if any. */
export function readJarvisSessionId(cwd: string, path = getJarvisRegistryPath()): string | null {
  const id = readRegistry(path).sessions[cwd];
  return typeof id === "string" && id ? id : null;
}

export function writeJarvisSessionId(cwd: string, sessionId: string | null, path = getJarvisRegistryPath()): void {
  const registry = readRegistry(path);
  if (sessionId) {
    registry.sessions[cwd] = sessionId;
    if (!registry.known.includes(sessionId)) registry.known.push(sessionId);
  } else {
    delete registry.sessions[cwd];
  }
  mkdirSync(dirname(path), { recursive: true });
  writePrivateFileAtomicSync(path, `${JSON.stringify(registry, null, 2)}\n`);
}

/** Ids of every Jarvis session, current and past. */
export function listKnownJarvisSessionIds(path = getJarvisRegistryPath()): Set<string> {
  return new Set(readRegistry(path).known);
}
