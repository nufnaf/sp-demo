import { join, resolve, dirname, basename } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { readDemoModel } from "./demo-model";

// Disposable application data is scoped to each run. The launcher also isolates
// SDK settings/auth for preconfigured packages; legacy OAuth keeps the Pi directory.
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
/** App-owned workspaces share the demo model; ordinary Web/Pi defaults are separate. */
export function presentationModelDefaults(cwd?: string) {
  return isPresentationCwd(cwd)
    ? readDemoModel()
    : undefined;
}
export function applicationDataDir(): string {
  return presentationRoot() ? join(presentationRoot()!, "application") : getAgentDir();
}
export function presentationSessionDir(cwd?: string): string | undefined {
  return isPresentationCwd(cwd) ? join(presentationRoot()!, "sessions", resolve(cwd!) === presentationCwd() ? "recruiting" : basename(cwd!)) : undefined;
}
