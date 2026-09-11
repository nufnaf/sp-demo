import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { access, mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

let compilation;
async function prepareInputFocus() {
  if (process.env.SYNTROPIC_INPUT_FOCUS_HELPER) return process.env.SYNTROPIC_INPUT_FOCUS_HELPER;
  if (process.env.SYNTROPIC_PACKAGED === '1') throw new Error('窗口焦点组件缺失，请重新安装应用。');
  compilation ??= (async () => {
    const source = fileURLToPath(new URL('./input-focus.swift', import.meta.url));
    const hash = createHash('sha256').update(await readFile(source)).digest('hex').slice(0, 16);
    const output = fileURLToPath(new URL(`../../build/computer-use/input-focus-${process.arch}-${hash}`, import.meta.url));
    try { await access(output); return output; } catch { /* first development run */ }
    await mkdir(dirname(output), { recursive: true });
    await new Promise((resolve, reject) => {
      const child = spawn('/usr/bin/xcrun', ['swiftc', '-parse-as-library', source, '-o', output], { stdio: ['ignore', 'ignore', 'pipe'] });
      let diagnostic = '';
      child.stderr.on('data', data => { diagnostic = (diagnostic + data).slice(-4000); });
      child.once('error', reject);
      child.once('exit', code => code === 0 ? resolve() : reject(new Error(`窗口焦点组件编译失败：${diagnostic}`)));
    });
    return output;
  })().catch(error => { compilation = undefined; throw error; });
  return compilation;
}

/** Borrow native focus for exactly one background coordinate click. */
export async function acquireInputFocus(target) {
  return startInputFocus(await prepareInputFocus(), target);
}

export function startInputFocus(binary, target) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, [String(target.pid), String(target.windowId)], { stdio: ['pipe', 'pipe', 'ignore'] });
    const lines = createInterface({ input: child.stdout });
    let ready = false, guarded = false, released, releasePromise;
    let finish;
    const completion = new Promise(resolve => { finish = resolve; });
    const unavailable = () => new Error('暂时无法保护当前窗口的操作焦点，请回到一个应用窗口后重试。');
    const timeout = setTimeout(() => { child.stdin.end(); reject(unavailable()); }, 4000);
    child.stdin.on('error', () => {}); // Worker/host teardown still resolves via close.
    child.once('error', () => reject(unavailable()));
    child.once('close', code => {
      clearTimeout(timeout); lines.close();
      if (!ready) reject(unavailable());
      finish(!guarded || (code === 0 && released) ? null : new Error('窗口焦点未能恢复，已停止后续电脑操作。'));
    });
    lines.on('line', line => {
      let item;
      try { item = JSON.parse(line); } catch { child.stdin.end(); reject(unavailable()); return; }
      if (item.event === 'error') { child.stdin.end(); const error = unavailable(); error.code = item.code; reject(error); }
      else if (item.event === 'released') released = item.result;
      else if (item.event === 'ready' && !ready) {
        ready = true; guarded = item.guarded === true; clearTimeout(timeout);
        resolve({ release() {
          releasePromise ??= (async () => {
            child.stdin.end('release\n');
            const timeout = setTimeout(() => child.kill('SIGTERM'), 3000);
            try { const error = await completion; if (error) throw error; return released ?? 'not_borrowed'; }
            finally { clearTimeout(timeout); }
          })();
          return releasePromise;
        } });
      }
    });
  });
}
