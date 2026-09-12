import { existsSync, writeFileSync } from "node:fs";
import type { SessionManager } from "@earendil-works/pi-coding-agent";

/** Pi normally waits for an assistant message before creating a session file.
 * An ID exposed to another request must already be resumable, even when empty.
 */
export function persistInitialSession(manager: SessionManager): void {
  const file = manager.getSessionFile();
  if (!file || existsSync(file)) return;
  const header = manager.getHeader();
  if (!header) throw new Error("Cannot persist a session without its header");
  writeFileSync(file, [header, ...manager.getEntries()].map(entry => JSON.stringify(entry)).join("\n") + "\n", {
    encoding: "utf8", flag: "wx", mode: 0o600,
  });
  // Reopen through the SDK so later entries append to this file. In particular,
  // the first assistant response must not try to create the file a second time.
  manager.setSessionFile(file);
}
