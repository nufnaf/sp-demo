import { join } from "node:path";
import { createHash } from "node:crypto";

/** Only the Electron presentation process sets this; ordinary Web/Pi stays unchanged. */
export function presentationRoot(): string | undefined {
  return process.env.SYNTROPIC_PRESENTATION_ROOT || undefined;
}

export function presentationSessionsRoot(): string | undefined {
  const root = presentationRoot();
  return root ? join(root, "sessions") : undefined;
}

export function presentationSessionDirectory(cwd: string): string | undefined {
  const root = presentationSessionsRoot();
  return root ? join(root, createHash("sha256").update(cwd).digest("hex")) : undefined;
}

export function presentationStatePath(name: string): string | undefined {
  const root = presentationRoot();
  return root ? join(root, name) : undefined;
}
