import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { getTextFileRevision, writeTextFileAtomicSync } from "./text-file-save.ts";

test("text revisions change with file contents", () => {
  assert.equal(getTextFileRevision("same"), getTextFileRevision(Buffer.from("same")));
  assert.notEqual(getTextFileRevision("before"), getTextFileRevision("after"));
});

test("atomic text saves replace contents and preserve mode", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pi-web-text-save-"));
  const filePath = path.join(directory, "sample.ts");
  try {
    fs.writeFileSync(filePath, "before\n", { mode: 0o640 });
    const mode = fs.statSync(filePath).mode;
    writeTextFileAtomicSync(filePath, "after\n", mode);
    assert.equal(fs.readFileSync(filePath, "utf8"), "after\n");
    assert.equal(fs.statSync(filePath).mode & 0o777, mode & 0o777);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
