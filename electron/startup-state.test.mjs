import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStartupState } from './startup-state.mjs';

test('completion survives a new process store and malformed records require preparation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'syntropic-startup-state-'));
  try {
    const first = createStartupState(directory);
    assert.deepEqual(first.read(), {});
    first.write({ captureVerified: true, complete: true });
    const next = createStartupState(directory);
    assert.deepEqual(next.read(), { captureVerified: true, complete: true });
    await writeFile(join(directory, 'startup-state.json'), '{bad');
    assert.deepEqual(next.read(), {});
    await writeFile(join(directory, 'startup-state.json'), 'null');
    assert.deepEqual(next.read(), {});
    await writeFile(join(directory, 'startup-state.json'), JSON.stringify({ version: 0, complete: true }));
    assert.deepEqual(next.read(), {});
  } finally { await rm(directory, { recursive: true, force: true }); }
});
