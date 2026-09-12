import { createServer } from 'node:net';
import { chmod, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { acquireLocalWindowCapture } from './window-stream.mjs';
import { captureSocket, capturePidFile } from './capture-connection.mjs';

// Exactly one persistent SCStream per window across development processes.
// Clients lease observation only; this socket cannot issue app input.
const peers = new Set();
let idle;
const server = createServer(socket => {
  peers.add(socket); clearTimeout(idle);
  let capture;
  let opening;
  let requested = false;
  let closed = false;
  let timer;
  let lastSequence = -1;
  const lines = createInterface({ input: socket });
  const finish = async () => {
    if (closed) return;
    closed = true; clearTimeout(timer); lines.close();
    if (capture) await capture.close();
    else await opening?.then(lease => lease.close(), () => {});
    if (!socket.destroyed && !socket.writableEnded) socket.end('{"event":"released"}\n');
    peers.delete(socket);
    if (!peers.size) idle = setTimeout(() => server.close(), 1000);
  };
  const publish = async () => {
    if (closed) return;
    try {
      const frame = await capture.frame();
      if (closed) return;
      // One bounded transport buffer; slow viewers drop intermediate frames.
      if (!socket.writableNeedDrain) {
        socket.write(JSON.stringify(frame.sequence !== lastSequence ? { event: 'frame', frame } : { event: 'alive' }) + '\n');
        lastSequence = frame.sequence;
      }
      timer = setTimeout(() => void publish(), 200);
    } catch {
      if (!closed) socket.end(JSON.stringify({ event: 'error' }) + '\n');
      void finish();
    }
  };
  lines.on('line', async line => {
    if (requested || line.length > 2048) { void finish(); return; }
    requested = true;
    try {
      const target = JSON.parse(line);
      if (!Number.isInteger(target.pid) || target.pid < 1 || !/^\d{1,10}$/.test(target.windowId)
        || !target.bounds || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(target.bounds[key]))) throw new Error('invalid target');
      opening = acquireLocalWindowCapture(target);
      const lease = await opening;
      if (closed) { await lease.close(); return; }
      capture = lease;
      void publish();
    } catch { void finish(); }
  });
  socket.on('error', () => void finish());
  socket.on('close', () => void finish());
  // Drop clients that connect without selecting a target.
  timer = setTimeout(() => { if (!requested) void finish(); }, 10000);
});
server.on('error', error => { process.exitCode = error.code === 'EADDRINUSE' ? 0 : 1; });
server.listen(captureSocket, async () => {
  await chmod(captureSocket, 0o600);
  await writeFile(capturePidFile, String(process.pid), { mode: 0o600 });
});
