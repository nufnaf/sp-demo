import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPresentationRun, cleanPresentationRun } from './presentation.mjs';
test('a fresh run never resumes generated artifacts, while cleanup only touches its owned run', async () => {
  const root = await mkdtemp(join(tmpdir(), 'syntropic-presentation-test-'));
  try {
    await writeFile(join(root, 'credential-sentinel'), 'keep');
    const first = await createPresentationRun(root); await writeFile(join(first.root, 'workspace', 'jd.html'), 'run one');
    const second = await createPresentationRun(root); assert.notEqual(first.id, second.id);
    await assert.rejects(access(join(second.root, 'workspace', 'jd.html')));
    await cleanPresentationRun(second); assert.equal(await readFile(join(first.root, 'workspace', 'jd.html'), 'utf8'), 'run one');
    await cleanPresentationRun(first); assert.equal(await readFile(join(root, 'credential-sentinel'), 'utf8'), 'keep');
  } finally { await rm(root, { recursive: true, force: true }); }
});
