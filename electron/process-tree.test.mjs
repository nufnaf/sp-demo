import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { OwnedProcessTree } from './process-tree.mjs';

test('reaps owned detached descendants; an unrelated process remains alive', async () => {
  const unrelated = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore' });
  const child = spawn(process.execPath, ['-e', `
    const {spawn}=require('node:child_process');
    const c=spawn(process.execPath,['-e','process.on("SIGTERM",()=>{});setInterval(()=>{},1000)'], {detached:true,stdio:'ignore'});
    console.log(c.pid); setInterval(()=>{},1000);
  `], { detached: true, stdio: ['ignore', 'pipe', 'ignore'] });
  const tree = new OwnedProcessTree(child.pid);
  try {
    const [data] = await once(child.stdout, 'data');
    const descendant = Number(String(data).trim());
    await delay(100);
    await tree.capture();
    await tree.stop();
    await delay(100);
    for (const pid of [child.pid, descendant]) assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
    assert.doesNotThrow(() => process.kill(unrelated.pid, 0));
    await tree.stop(); // idempotent
  } finally {
    unrelated.kill('SIGKILL');
    await tree.stop();
  }
});
