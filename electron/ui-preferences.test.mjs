import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import electron from 'electron';
import { createUiPreferencesStore, registerUiPreferences } from './ui-preferences.mjs';
import { DEFAULT_UI_PREFERENCES } from './ui-preferences-schema.mjs';

const exec = promisify(execFile);
test('preferences survive a new store, validate values and serialize writes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'syntropic-preferences-'));
  try {
    const store = createUiPreferencesStore(directory);
    assert.deepEqual(await store.read(), DEFAULT_UI_PREFERENCES);
    await Promise.all([store.write({ desktopSpacesEnabled: true, previewWidthScale: 2 }), store.write({ desktopSpacesEnabled: false, previewWidthScale: 1.75, unrelated: 'discard' })]);
    assert.deepEqual(await createUiPreferencesStore(directory).read(), { desktopSpacesEnabled: false, previewWidthScale: 1.75 });
    assert.deepEqual(JSON.parse(await readFile(join(directory, 'ui-preferences.json'), 'utf8')), { desktopSpacesEnabled: false, previewWidthScale: 1.75 });
    assert.deepEqual(await store.write({ desktopSpacesEnabled: 'true', previewWidthScale: Infinity }), DEFAULT_UI_PREFERENCES);
    await writeFile(join(directory, 'ui-preferences.json'), '{bad');
    assert.deepEqual(await store.read(), DEFAULT_UI_PREFERENCES);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('only the trusted main frame can read or write preferences', async () => {
  const handlers = new Map();
  const contents = { mainFrame: { url: 'http://127.0.0.1:30141/' } };
  let writes = 0;
  registerUiPreferences({ handle: (name, handler) => handlers.set(name, handler) }, { read: () => DEFAULT_UI_PREFERENCES, write: () => { writes++; } }, () => ({ webContents: contents }), url => url.startsWith('http://127.0.0.1:30141/'));
  const event = { sender: contents, senderFrame: contents.mainFrame };
  for (const handler of handlers.values()) {
    assert.throws(() => handler({ ...event, sender: {} }), /Untrusted/);
    assert.throws(() => handler({ ...event, senderFrame: { url: contents.mainFrame.url } }), /Untrusted/);
  }
  assert.deepEqual(await handlers.get('desktop:ui-preferences:get')(event), DEFAULT_UI_PREFERENCES);
  await handlers.get('desktop:ui-preferences:set')(event, {}); assert.equal(writes, 1);
});

test('real Electron preload persists across process restart and fresh temporary sessions', { timeout: 60000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'syntropic-preferences-electron-'));
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  try {
    for (const action of ['write', 'read']) {
      const { stdout } = await exec(electron, ['scripts/fixtures/ui-preferences-harness.mjs', directory, action], { env, timeout: 25000 });
      assert.match(stdout, /PREFERENCES_OK/);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
