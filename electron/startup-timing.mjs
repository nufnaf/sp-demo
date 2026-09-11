import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

/** Only fixed stage names go to disk; never record API responses or credentials. */
export function createStartupRecorder({ now = () => performance.now(), launchId = randomUUID() } = {}) {
  const startedAt = now();
  const pending = [];
  let file;
  let buildId;
  const write = record => {
    try { appendFileSync(file, JSON.stringify({ ...record, buildId }) + '\n', { mode: 0o600 }); }
    catch { /* Diagnostics must not interrupt startup. */ }
  };
  return {
    configure(directory, id) {
      try {
        mkdirSync(directory, { recursive: true });
        file = join(directory, 'startup.jsonl');
        try { if (statSync(file).size > 2_000_000) renameSync(file, `${file}.previous`); } catch { /* No previous log. */ }
        buildId = id;
        for (const record of pending.splice(0)) write(record);
      } catch { file = undefined; }
    },
    mark(name) {
      if (typeof name !== 'string' || !/^[a-z][a-z0-9.-]{0,79}$/.test(name)) return;
      const record = { launchId, pid: process.pid, time: new Date().toISOString(), stage: name, elapsedMs: Math.round(now() - startedAt) };
      if (file) write(record); else if (pending.length < 1000) pending.push(record);
      return record.elapsedMs;
    },
  };
}
const recorder = createStartupRecorder();
export const startupMark = recorder.mark;
export const configureStartupLog = recorder.configure;
const rendererStages = new Set(['feishu.check.start', 'feishu.check.end', 'feishu.check.error', 'permissions.check.start', 'permissions.check.end', 'permissions.check.error', 'calendar.prepare.start', 'calendar.prepare.end', 'calendar.prepare.error', 'assets.wait.start', 'assets.wait.end', 'frame.ready']);
export function registerStartupTiming(ipc, getWindow, isWorkbenchUrl, mark = startupMark) {
  ipc.on('desktop:startup-mark', (event, name) => {
    const contents = getWindow()?.webContents;
    if (contents && event.sender === contents && event.senderFrame === contents.mainFrame && isWorkbenchUrl(event.senderFrame.url) && rendererStages.has(name)) mark(`renderer.${name}`);
  });
}
