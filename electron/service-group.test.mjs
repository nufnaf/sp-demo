import assert from 'node:assert/strict';
import test from 'node:test';
import { ServiceGroup } from './service-group.mjs';

test('does not report ready until both services are ready', async () => {
  let release;
  let ready = false;
  const group = new ServiceGroup([
    { start: async () => ({ owned: true }), stop: async () => {} },
    { start: () => new Promise((resolve) => { release = resolve; }), stop: async () => {} },
  ]);
  const started = group.start().then((result) => { ready = true; return result; });
  await Promise.resolve();
  assert.equal(ready, false);
  assert.equal(group.start(), group.start());
  release({ owned: false });
  assert.deepEqual(await started, { owned: true });
});

test('one startup failure cancels the other startup and waits for cleanup', async () => {
  let cancel;
  let stops = 0;
  const group = new ServiceGroup([
    { start: () => new Promise((_resolve, reject) => { cancel = reject; }), stop: async () => { stops++; cancel(new Error('cancelled')); } },
    { start: async () => { throw new Error('recruiting unavailable'); }, stop: async () => { stops++; } },
  ]);
  await assert.rejects(group.start(), /recruiting unavailable/);
  assert.equal(stops, 2);
});
