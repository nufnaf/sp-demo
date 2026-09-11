import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EventEmitter } from 'node:events';
import { createStartupRecorder, registerStartupTiming } from './startup-timing.mjs';

test('startup log preserves launch timing and pre-log stages on disk', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'startup-log-'));
  try {
    let now = 100;
    const recorder = createStartupRecorder({ now: () => now, launchId: 'test-launch' });
    now = 140; recorder.mark('electron.ready');
    recorder.configure(directory, 'test-build');
    now = 360; recorder.mark('splash.hidden');
    recorder.mark('secret token');
    const records = (await readFile(join(directory, 'startup.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.deepEqual(records.map(r => [r.stage, r.elapsedMs, r.buildId]), [['electron.ready', 40, 'test-build'], ['splash.hidden', 260, 'test-build']]);
    assert.ok(records.every(r => r.launchId === 'test-launch'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('renderer timing accepts only fixed stages from the current main workbench frame', () => {
  const ipc = new EventEmitter(), marks = [];
  const contents = { mainFrame: { url: 'https://workbench.test/' } };
  const event = { sender: contents, senderFrame: contents.mainFrame };
  registerStartupTiming(ipc, () => ({ webContents: contents }), url => url === 'https://workbench.test/', name => marks.push(name));
  ipc.emit('desktop:startup-mark', event, 'frame.ready');
  ipc.emit('desktop:startup-mark', { ...event, sender: {} }, 'frame.ready');
  ipc.emit('desktop:startup-mark', { ...event, senderFrame: { url: contents.mainFrame.url } }, 'frame.ready');
  ipc.emit('desktop:startup-mark', event, 'credentials.value');
  ipc.emit('desktop:startup-mark', event, { name: 'frame.ready', secret: 'invalid' });
  assert.deepEqual(marks, ['renderer.frame.ready']);
});
