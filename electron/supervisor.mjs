import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LocalService } from './service.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let service;
let starting;
let stopping = false;
const send = (message) => { if (process.connected) process.send(message); };
const status = (title, detail, retry = false) => send({ type: 'status', status: { title, detail, retry } });
async function start() {
  if (starting || stopping) return;
  starting = (async () => {
    if (service?.ready && !service.failure) {
      send({ type: 'ready', owned: service.owned }); return;
    }
    await service?.stop();
    if (stopping) return;
    service = new LocalService({
      root,
      onStatus: (title, detail) => status(title, detail),
      onFailure: (detail) => status('本机后台已停止', detail, true),
    });
    try { const result = await service.start(); send({ type: 'ready', ...result }); }
    catch (error) {
      await service.stop();
      if (!stopping) status('无法启动工作台', error.message, true);
    }
  })().finally(() => { starting = undefined; });
  await starting;
}
async function stop() {
  if (stopping) return;
  stopping = true;
  await service?.stop();
  process.exit(0);
}
process.on('message', (message) => {
  if (message.type === 'start') void start();
  if (message.type === 'stop') void stop();
});
process.on('disconnect', () => { void stop(); });
process.on('SIGINT', () => { void stop(); });
process.on('SIGTERM', () => { void stop(); });
