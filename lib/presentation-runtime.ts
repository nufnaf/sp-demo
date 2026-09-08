import { join, resolve } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

// Only disposable application data moves. SDK settings and ModelRuntime retain
// their original agent directory and credential refresh/locking behavior.
export function presentationRoot(): string | undefined {
  return process.env.SYNTROPIC_PRESENTATION_ROOT || undefined;
}
export function presentationCwd(): string | undefined {
  const root = presentationRoot();
  return root ? join(root, "workspace") : undefined;
}
export function isPresentationCwd(cwd?: string): boolean {
  return Boolean(cwd && presentationCwd() && resolve(cwd) === resolve(presentationCwd()!));
}
export function applicationDataDir(): string {
  return presentationRoot() ? join(presentationRoot()!, "application") : getAgentDir();
}
export function presentationSessionDir(cwd?: string): string | undefined {
  return isPresentationCwd(cwd) ? join(presentationRoot()!, "sessions", "recruiting") : undefined;
}
