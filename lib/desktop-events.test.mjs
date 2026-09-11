import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url);
const { subscribeDesktopEvents } = await jiti.import('./desktop-events-client.ts');
const { desktopEventsStream } = await jiti.import('./desktop-events-stream.ts');

test('all desktop channels share one source; closing video releases frames without stopping status', async () => {
  const original = globalThis.EventSource, sources = [], received = [];
  globalThis.EventSource = class extends EventTarget {
    static OPEN = 1; readyState = 1; closed = false;
    constructor(url) { super(); this.url = url; sources.push(this); assert.equal(sources.filter(s => !s.closed).length, 1); }
    close() { this.closed = true; }
  };
  const releases = [];
  try {
    for (const channel of ['browser', 'file', 'computer-status']) releases.push(subscribeDesktopEvents(channel, { message: e => received.push([channel, e.data]) }));
    assert.equal(sources.length, 1);
    const hide = subscribeDesktopEvents('computer-frame', { message: e => received.push(['frame', e.data]) });
    releases.push(hide);
    assert.equal(sources.length, 2); assert.match(sources[1].url, /frames=1/);
    sources[0].dispatchEvent(new MessageEvent('browser', { data: 'stale' }));
    sources[1].dispatchEvent(new MessageEvent('computer-status', { data: 'running' }));
    sources[1].dispatchEvent(new MessageEvent('computer-frame', { data: 'jpeg' }));
    assert.deepEqual(received, [['computer-status', 'running'], ['frame', 'jpeg']]);
    hide(); hide();
    assert.equal(sources.length, 3); assert.doesNotMatch(sources[2].url, /frames/);
    sources[2].dispatchEvent(new MessageEvent('browser', { data: 'published' }));
    assert.deepEqual(received.at(-1), ['browser', 'published']);
    let opened = 0;
    const late = subscribeDesktopEvents('file', { message() {}, open: () => opened++ });
    releases.push(late); late();
    await Promise.resolve(); assert.equal(opened, 0);
  } finally { releases.forEach(fn => fn()); globalThis.EventSource = original; }
  assert.ok(sources.every(s => s.closed));
});

function fixture() {
  const callbacks = {}, released = [];
  const source = key => send => { callbacks[key] = send; if (key === 'status') send({ phase: 'idle' }); return () => released.push(key); };
  return { callbacks, released, sources: { browser: source('browser'), file: source('file'), status: source('status'), frames: source('frames'), snapshot: () => ({ phase: 'running' }) } };
}
for (const mode of ['cancel', 'abort']) test(`multiplexed stream preserves state under frame backpressure and releases all leases on ${mode}`, async () => {
  const f = fixture(), abort = new AbortController();
  const stream = desktopEventsStream(abort.signal, f.sources), reader = stream.getReader();
  f.callbacks.frames({ dataUrl: 'drop-this-frame' });
  f.callbacks.browser({ type: 'browser.task', status: 'completed' });
  const decoder = new TextDecoder(); let text = '';
  for (let i = 0; i < 4; i++) text += decoder.decode((await reader.read()).value);
  assert.match(text, /browser.ready/); assert.match(text, /file.ready/); assert.match(text, /computer-status/); assert.match(text, /completed/);
  assert.doesNotMatch(text, /drop-this-frame/);
  const next = reader.read(); f.callbacks.frames({ dataUrl: 'fresh-frame' });
  assert.match(decoder.decode((await next).value), /fresh-frame/);
  if (mode === 'cancel') await reader.cancel(); else abort.abort();
  abort.abort(); assert.deepEqual(f.released.sort(), ['browser', 'file', 'frames', 'status']);
});
test('status-only and already aborted streams never acquire a video lease', async () => {
  const f = fixture(), abort = new AbortController();
  const reader = desktopEventsStream(abort.signal, { ...f.sources, frames: undefined }).getReader();
  assert.equal(f.callbacks.frames, undefined); await reader.cancel();
  const g = fixture(); abort.abort();
  assert.equal((await desktopEventsStream(abort.signal, g.sources).getReader().read()).done, true);
  assert.deepEqual(g.callbacks, {});
});
test('failed subscription releases earlier sources', async () => {
  const f = fixture();
  const reader = desktopEventsStream(new AbortController().signal, { ...f.sources, frames() { throw new Error('unavailable'); } }).getReader();
  while (!(await reader.read()).done) {}
  assert.deepEqual(f.released.sort(), ['browser', 'file', 'status']);
});
