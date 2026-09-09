import { join, resolve, dirname, basename } from "node:path";
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
  const root = presentationRoot();
  return Boolean(cwd && root && (resolve(cwd) === join(root, "workspace") || dirname(resolve(cwd)) === join(root, "workspaces")));
}
/** App-owned workspaces use Luna; ordinary Web/Pi workspaces keep their defaults. */
export function presentationModelDefaults(cwd?: string) {
  return isPresentationCwd(cwd)
    ? { provider: "openai-codex", modelId: "gpt-5.6-luna", thinkingLevel: "low" as const }
    : undefined;
}
export function applicationDataDir(): string {
  return presentationRoot() ? join(presentationRoot()!, "application") : getAgentDir();
}
export function presentationSessionDir(cwd?: string): string | undefined {
  return isPresentationCwd(cwd) ? join(presentationRoot()!, "sessions", resolve(cwd!) === presentationCwd() ? "recruiting" : basename(cwd!)) : undefined;
}
