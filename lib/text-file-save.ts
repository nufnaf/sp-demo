import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function getTextFileRevision(contents: string | Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}

/** Replace a text file atomically while preserving its existing mode. */
export function writeTextFileAtomicSync(filePath: string, contents: string, mode: number): void {
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(directory, `.${path.basename(filePath)}-${randomUUID()}.tmp`);
  let completed = false;

  try {
    fs.writeFileSync(temporaryPath, contents, {
      encoding: "utf8",
      flag: "wx",
      mode: mode & 0o777,
      flush: true,
    });
    fs.renameSync(temporaryPath, filePath);
    completed = true;
  } finally {
    if (!completed) {
      try { fs.unlinkSync(temporaryPath); } catch { /* best-effort cleanup */ }
    }
  }
}
