import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { TerminalManager } = await jiti.import("./manager.ts");

test("terminal manager runs a real PTY and keeps workspace sessions isolated", { timeout: 10_000 }, async () => {
  const workspace = mkdtempSync(join(tmpdir(), "pi-web-terminal-test-"));
  const otherWorkspace = mkdtempSync(join(tmpdir(), "pi-web-terminal-other-"));
  const manager = new TerminalManager();
  let terminal;
  try {
    terminal = manager.create(workspace, { cols: 90, rows: 24 });
    assert.equal(terminal.status, "running");
    assert.equal(terminal.cols, 90);
    assert.equal(manager.list(workspace).length, 1);
    assert.equal(manager.list(otherWorkspace).length, 0);

    const output = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("PTY output timed out")), 5_000);
      const unsubscribe = manager.subscribe(terminal.terminalId, terminal.cwd, (event) => {
        if (event.type === "terminal.output" && event.data.includes("pi-web-terminal-marker")) {
          clearTimeout(timeout);
          unsubscribe();
          resolve(event.data);
        }
      });
    });
    manager.write(terminal.terminalId, terminal.cwd, "echo pi-web-terminal-marker\r");
    await output;

    const resized = manager.resize(terminal.terminalId, terminal.cwd, 120, 40);
    assert.equal(resized.cols, 120);
    assert.equal(resized.rows, 40);
    assert.throws(() => manager.state(terminal.terminalId, otherWorkspace), /not found/i);
  } finally {
    if (terminal) manager.close(terminal.terminalId, terminal.cwd);
    rmSync(workspace, { recursive: true, force: true });
    rmSync(otherWorkspace, { recursive: true, force: true });
  }
});
