import { execFile } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { execPath } from "process";

const execFileAsync = promisify(execFile);

/**
 * Locate `npx-cli.js` shipped with the running Node.js installation.
 *
 * On Windows the `npx` on PATH is actually `npx.cmd`, which Node.js (since
 * 20.12 due to CVE-2024-27980) refuses to spawn from `execFile`/`spawn`
 * without `shell: true`. Going through a shell reintroduces quoting bugs for
 * user-supplied args. Instead we find the real `npx-cli.js` and invoke it
 * directly via the current `node` binary, which works identically on every
 * platform and needs no shell.
 */
function findNpmBin(script: "npm-cli.js" | "npx-cli.js"): string | null {
  const nodeDir = dirname(execPath);
  const candidates = [
    // Windows MSI installer layout: node.exe and node_modules share a dir
    join(nodeDir, "node_modules", "npm", "bin", script),
    // Unix layout: .../bin/node + .../lib/node_modules/npm/bin/npx-cli.js
    join(nodeDir, "..", "lib", "node_modules", "npm", "bin", script),
  ];
  for (const p of candidates) {
    try {
      if (existsSync(p)) return p;
    } catch {
      // ignore
    }
  }
  return null;
}

export interface RunNpxOptions {
  timeout?: number;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface RunNpxResult {
  stdout: string;
  stderr: string;
}

/**
 * Cross-platform wrapper for invoking `npx <args>` without ever using a
 * shell, so user-controlled arguments are never interpreted as shell syntax.
 */
export async function runNpx(args: string[], opts: RunNpxOptions = {}): Promise<RunNpxResult> {
  const npxCli = findNpmBin("npx-cli.js");
  const { command, commandArgs } = npxCli
    ? { command: execPath, commandArgs: [npxCli, ...args] }
    : { command: "npx", commandArgs: args };
  return execFileAsync(command, commandArgs, {
    timeout: opts.timeout,
    cwd: opts.cwd,
    env: opts.env,
  });
}

/** Run npm itself through its JavaScript entry point for the same quoting guarantees as runNpx. */
export async function runNpm(args: string[], opts: RunNpxOptions = {}): Promise<RunNpxResult> {
  const npmCli = findNpmBin("npm-cli.js");
  const { command, commandArgs } = npmCli
    ? { command: execPath, commandArgs: [npmCli, ...args] }
    : { command: process.platform === "win32" ? "npm.cmd" : "npm", commandArgs: args };
  return execFileAsync(command, commandArgs, {
    timeout: opts.timeout,
    cwd: opts.cwd,
    env: opts.env,
    shell: process.platform === "win32" && !npmCli,
  });
}
