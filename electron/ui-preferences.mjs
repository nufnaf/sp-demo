import { readFile, mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { normalizeUiPreferences } from './ui-preferences-schema.mjs';

export function createUiPreferencesStore(directory) {
  const path = join(directory, 'ui-preferences.json');
  let pending = Promise.resolve();
  return {
    async read() {
      await pending;
      try { return normalizeUiPreferences(JSON.parse(await readFile(path, 'utf8'))); }
      catch (error) {
        if (error.code === 'ENOENT' || error instanceof SyntaxError) return normalizeUiPreferences(null);
        throw error;
      }
    },
    write(value) {
      const preferences = normalizeUiPreferences(value);
      const write = pending.then(async () => {
        await mkdir(directory, { recursive: true });
        const temp = `${path}.${randomUUID()}.tmp`;
        try {
          await writeFile(temp, JSON.stringify(preferences) + '\n', { mode: 0o600 });
          await rename(temp, path);
        } finally { await rm(temp, { force: true }); }
        return preferences;
      });
      pending = write.then(() => {}, () => {});
      return write;
    },
    flush: () => pending,
  };
}

export function registerUiPreferences(ipcMain, store, getWindow, isAppUrl) {
  const check = event => {
    const contents = getWindow()?.webContents;
    if (!contents || event.sender !== contents || event.senderFrame !== contents.mainFrame
      || !isAppUrl(event.senderFrame.url) || new URL(event.senderFrame.url).pathname !== '/') throw new Error('Untrusted preferences request');
  };
  ipcMain.handle('desktop:ui-preferences:get', event => { check(event); return store.read(); });
  ipcMain.handle('desktop:ui-preferences:set', (event, value) => { check(event); return store.write(value); });
}
