import { createConnection } from 'node:net';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdir, readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const identity = createHash('sha256').update(import.meta.url).digest('hex').slice(0, 12);
export const captureDirectory = join(tmpdir(), `syntropic-capture-${process.getuid()}-${identity}`);
export const captureSocket = join(captureDirectory, 'host.sock');
export const capturePidFile = join(captureDirectory, 'host.pid');

function connect() {
  return new Promise((resolve, reject) => {
    const socket = createConnection(captureSocket);
    socket.once('connect', () => { socket.off('error', reject); resolve(socket); });
    socket.once('error', reject);
  });
}

async function connectHost() {
  await mkdir(captureDirectory, { recursive: true, mode: 0o700 });
  try { return await connect(); } catch { /* start the shared observation host */ }
  // A crashed host can leave its Unix socket behind. Remove only a socket
  // whose recorded owner is confirmed dead; never detach a live host.
  try {
    const pid = Number(await readFile(capturePidFile, 'utf8'));
    if (Number.isInteger(pid) && pid > 0) {
      try { process.kill(pid, 0); }
      catch (error) { if (error.code === 'ESRCH') await unlink(captureSocket).catch(() => {}); }
    }
  } catch { /* first start */ }
  const child = spawn(process.execPath, [fileURLToPath(new URL('./capture-host.mjs', import.meta.url))], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, detached: true, stdio: 'ignore',
  });
  let startupError;
  child.on('error', error => { startupError = error; });
  child.unref();
  for (let attempt = 0; attempt < 60; attempt++) {
    if (startupError) throw startupError;
    try { return await connect(); } catch { await delay(100); }
  }
  throw new Error('无法启动飞书画面服务。');
}

/** One host owns capture across the Electron viewer and Node task processes. */
export async function acquireWindowCapture(target) {
  const socket = await connectHost();
  let latest;
  let failure;
  let lastAlive = Date.now();
  let released;
  const releaseDone = new Promise(resolve => { released = resolve; });
  const fail = () => { failure ??= new Error('飞书画面连接已结束，请重新连接。'); latest = null; };
  socket.on('error', fail);
  socket.on('close', () => { fail(); released(); });
  const lines = createInterface({ input: socket });
  lines.on('line', line => {
    try {
      const event = JSON.parse(line);
      if (event.event === 'frame') { latest = event.frame; lastAlive = Date.now(); }
      else if (event.event === 'alive') lastAlive = Date.now();
      else if (event.event === 'error') fail();
      else if (event.event === 'released') released();
    } catch { fail(); socket.destroy(); }
  });
  socket.write(JSON.stringify({ pid: target.pid, windowId: String(target.windowId), bounds: target.bounds }) + '\n');
  let closing;
  const close = () => {
    closing ??= (async () => {
      fail();
      if (!socket.destroyed) socket.write('{"event":"release"}\n');
      let timedOut = false;
      const timeout = setTimeout(() => { timedOut = true; socket.destroy(); released(); }, 5000);
      await releaseDone;
      clearTimeout(timeout); lines.close(); socket.destroy();
      // A new source must not start before the old native stream has stopped.
      if (timedOut) throw new Error('旧画面尚未确认释放，请稍后重新连接。');
    })();
    return closing;
  };
  const frame = async bounds => {
    const deadline = Date.now() + 15000;
    while (true) {
      if (failure) throw failure;
      if (Date.now() - lastAlive > (latest ? 3000 : 16000)) throw new Error('飞书画面暂时无响应，请重新连接。');
      const matches = !bounds || (latest?.windowBounds && ['x', 'y', 'width', 'height'].every(key => latest.windowBounds[key] === bounds[key]));
      if (latest && matches) return latest;
      if (Date.now() > deadline) throw new Error('等待飞书画面超时，请重新连接。');
      await delay(50);
    }
  };
  try { await frame(target.bounds); return { frame, close }; }
  catch (error) { await close(); throw error; }
}
