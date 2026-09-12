import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createAppLocationGuard } from './app-location.mjs';

test('a background process cannot recreate its window after its bundle moves', t => {
  const root = mkdtempSync(join(tmpdir(), 'syntropic-move-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const original = join(root, 'unpacked', 'Syntropic.app');
  const installed = join(root, 'Applications', 'Syntropic.app');
  const resources = join(original, 'Contents', 'Resources');
  mkdirSync(resources, { recursive: true });
  mkdirSync(join(root, 'Applications'));
  let exits = 0;
  let windows = 0;
  const available = createAppLocationGuard(resources, () => { exits++; });
  const activate = () => { if (available()) windows++; };
  activate();
  activate(); // closing/reopening in place remains supported
  assert.equal(windows, 2);
  assert.equal(exits, 0);
  renameSync(original, installed);
  activate();
  activate(); // repeated activation while exiting must not show more dialogs
  assert.equal(windows, 2);
  assert.equal(exits, 1);
  assert.equal(createAppLocationGuard(join(installed, 'Contents', 'Resources'), () => assert.fail())(), true);
});

test('development mode does not depend on a packaged resource directory', () => {
  assert.equal(createAppLocationGuard(undefined, () => assert.fail())(), true);
});
