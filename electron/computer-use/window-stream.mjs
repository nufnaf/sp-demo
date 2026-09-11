import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdir, readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const source = fileURLToPath(new URL('./window-stream.swift', import.meta.url));
let compilation;
const streams = new Map();
let transition = Promise.resolve();
function changeLeases(operation) {
  const result = transition.then(operation);
  transition = result.catch(() => {});
  return result;
}

export function prepareWindowCapture() {
  // Development entry only. Installed builds must provide the signed helper;
  // never invoke a compiler from the installed product.
  if (process.env.SYNTROPIC_WINDOW_CAPTURE_HELPER) return Promise.resolve(process.env.SYNTROPIC_WINDOW_CAPTURE_HELPER);
  compilation ??= (async () => {
    const hash = createHash('sha256').update(await readFile(source)).digest('hex').slice(0, 16);
    const output = fileURLToPath(new URL(`../../build/computer-use/window-stream-${process.arch}-${hash}`, import.meta.url));
    try { await access(output); return output; } catch { /* first development run */ }
    await mkdir(dirname(output), { recursive: true });
    await new Promise((resolve, reject) => {
      const compiler = spawn('/usr/bin/xcrun', ['swiftc', '-parse-as-library', source, '-o', output], { stdio: ['ignore', 'ignore', 'pipe'] });
      let diagnostic = '';
      compiler.stderr.on('data', data => { diagnostic = (diagnostic + data).slice(-8000); });
      compiler.on('error', reject);
      compiler.on('exit', code => code === 0 ? resolve() : reject(new Error(`采集组件编译失败：${diagnostic}`)));
    });
    return output;
  })().catch(error => { compilation = undefined; throw error; });
  return compilation;
}

class WindowStream {
  constructor(binary, target) {
    this.target = target;
    this.waiters = new Set();
    this.lastAlive = Date.now();
    this.child = spawn(binary, [String(target.pid), String(target.windowId)], { stdio: ['pipe', 'pipe', 'ignore'] });
    this.done = new Promise(resolve => { this.child.once('close', resolve); });
    this.child.on('error', () => this.fail('capture_start_failed'));
    this.child.stdin.on('error', () => this.fail('capture_connection_closed'));
    this.child.once('close', () => this.fail('capture_closed'));
    const lines = createInterface({ input: this.child.stdout });
    lines.on('line', line => {
      try {
        const item = JSON.parse(line);
        if (item.event === 'error' || item.event === 'stopped') this.fail(item.code ?? 'capture_stopped');
        else if (item.event === 'alive') this.lastAlive = Date.now();
        else if (item.event === 'geometry') { this.bounds = item; this.latest = null; }
        else if (item.event === 'frame' && !this.failure) {
          if (!Number.isInteger(item.width) || !Number.isInteger(item.height) || item.width < 1 || item.height < 1
            || item.width > 1440 || item.height > 1440 || typeof item.data !== 'string' || item.data.length > 8_000_000) {
            this.fail('capture_invalid_frame'); return;
          }
          this.latest = { image: { mimeType: 'image/jpeg', dataBase64: item.data }, width: item.width,
            height: item.height, sequence: item.sequence, receivedAt: item.receivedAt };
          for (const wake of this.waiters) wake();
        }
      } catch { this.fail('capture_invalid_response'); }
    });
  }
  fail(code) {
    this.failure ??= new Error(`飞书画面已暂停（${code}），请检查窗口后重新连接。`);
    this.latest = null;
    for (const wake of this.waiters) wake();
  }
  async frame(bounds) {
    const deadline = Date.now() + 10000;
    while (true) {
      if (this.failure) throw this.failure;
      if (Date.now() - this.lastAlive > 3000) { this.fail('capture_unresponsive'); throw this.failure; }
      const matches = !bounds || (this.bounds && ['x', 'y', 'width', 'height'].every(key => this.bounds[key] === bounds[key]));
      if (this.latest && matches) return { ...this.latest, windowBounds: this.bounds };
      if (Date.now() >= deadline) throw new Error('暂时无法获取飞书的新画面，请重新连接。');
      await new Promise(resolve => {
        const wake = () => { clearTimeout(timer); this.waiters.delete(wake); resolve(); };
        const timer = setTimeout(wake, 200);
        this.waiters.add(wake);
      });
    }
  }
  close() {
    if (this.closing) return this.closing;
    this.fail('capture_closed');
    this.child.stdin.end('stop\n');
    const timeout = setTimeout(() => this.child.kill('SIGTERM'), 3000);
    this.closing = this.done.finally(() => clearTimeout(timeout));
    return this.closing;
  }
}

/** Task and viewer share capture, but retain independent AX sessions. */
export async function acquireLocalWindowCapture(target) {
  const key = `${target.pid}:${target.windowId}`;
  const entry = await changeLeases(() => {
    let current = streams.get(key);
    if (!current) {
      if (streams.size) throw new Error('请先断开上一个飞书窗口，再连接新的窗口。');
      current = { users: 0, ready: prepareWindowCapture().then(binary => new WindowStream(binary, target)) };
      streams.set(key, current);
    }
    current.users++;
    return current;
  });
  let releasing;
  const release = () => {
    releasing ??= changeLeases(async () => {
      if (--entry.users === 0) {
        // Keep ownership until native stop finishes, including when another
        // process requests a different window during this release.
        try { await entry.ready.then(stream => stream.close(), () => {}); }
        finally { if (streams.get(key) === entry) streams.delete(key); }
      }
    });
    return releasing;
  };
  try {
    const stream = await entry.ready;
    await stream.frame(target.bounds);
    return { frame: bounds => stream.frame(bounds), close: release };
  } catch (error) { await release(); throw error; }
}
