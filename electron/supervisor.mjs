import { cleanPresentationRun } from './presentation.mjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LocalService } from './service.mjs';
import { ServiceGroup } from './service-group.mjs';
import { preparePresentationCalendar } from './prepare-presentation.mjs';
const root = process.env.SYNTROPIC_APP_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '..');
let service;
let starting;
let stopping = false;
const send = (message) => { if (process.connected) process.send(message); };
const status = (title, detail, retry = false) => send({ type: 'status', status: { phase: retry ? 'error' : 'starting', title, detail, retry } });
async function start() {
  if (starting || stopping) return;
  starting = (async () => {
    await service?.stop();
    if (stopping) return;
    const production = process.env.SYNTROPIC_PACKAGED === '1';
    const callbacks = {
      onStatus: (title, detail) => status(title, detail),
      onFailure: (detail) => status('本机服务已停止', detail, true),
    };
    try {
      const recruitingOrigin = new URL(process.env.SYNTROPIC_RECRUITING_URL?.trim() || 'http://127.0.0.1:30143').origin;
      service = new ServiceGroup([
        new LocalService({ root, production, ...callbacks }),
        ...(recruitingOrigin === 'http://127.0.0.1:30143' ? [new LocalService({
          root: resolve(root, 'apps/recruiting'), kind: 'recruiting', production,
          origin: 'http://127.0.0.1:30143', ...callbacks,
          env: { ...process.env, PORT: '30143', PUBLIC_ORIGIN: 'http://127.0.0.1:30143', DATABASE_URL: '', VERCEL: '' },
        })] : []),
      ]);
      const result = await service.start();
      if (!stopping) await preparePresentationCalendar({ onStatus: callbacks.onStatus });
      if (!stopping) send({ type: 'ready', ...result });
    }
    catch (error) {
      await service?.stop();
      if (!stopping) status('无法启动工作台', error.message, true);
    }
  })().finally(() => { starting = undefined; });
  await starting;
}
async function stop() {
  if (stopping) return;
  stopping = true;
  try {
    await service?.stop();
    if (process.env.SYNTROPIC_PRESENTATION_ROOT) await cleanPresentationRun({ root: process.env.SYNTROPIC_PRESENTATION_ROOT });
    process.exit(0);
  } catch { process.exit(1); }
}
process.on('message', (message) => {
  if (message.type === 'start') void start();
  if (message.type === 'stop') void stop();
});
process.on('disconnect', () => { void stop(); });
process.on('SIGINT', () => { void stop(); });
process.on('SIGTERM', () => { void stop(); });
