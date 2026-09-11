import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startInputFocus } from './input-focus.mjs';

test('focus helper handshake, no-op, EOF release, and premature exit', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'syntropic-focus-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const script = join(directory, 'helper.cjs');
  await writeFile(script, `
    const mode = process.argv[2];
    const send = value => console.log(JSON.stringify(value));
    if (mode === 'refuse') { send({event:'error',code:'focus_unavailable'}); process.exit(1); }
    send({event:'ready',guarded:mode !== 'foreground'});
    if (mode === 'crash') process.exit(1);
    if (mode === 'foreground') process.exit(0);
    process.stdin.resume();
    process.stdin.on('end', () => { send({event:'released',result:'restored'}); process.exit(0); });
  `);
  const start = mode => startInputFocus(process.execPath, { pid: script, windowId: mode });
  const lease = await start('background');
  const first = lease.release();
  assert.equal(first, lease.release());
  assert.equal(await first, 'restored');
  assert.equal(await (await start('foreground')).release(), 'not_borrowed');
  await assert.rejects(start('refuse'), error => error.code === 'focus_unavailable');
  await assert.rejects((await start('crash')).release(), /窗口焦点未能恢复/);
});
