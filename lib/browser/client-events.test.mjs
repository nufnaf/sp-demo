import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
const { subscribeBrowserEvents } = await createJiti(import.meta.url).import('./client-events.ts');

test('desktop and browser share a connection without closing each other or losing reconnect events', async () => {
  const previous = globalThis.EventSource;
  const sources = [];
  globalThis.EventSource = class extends EventTarget {
    static OPEN = 1;
    readyState = 0;
    closed = false;
    constructor(url) { super(); this.url = url; sources.push(this); }
    close() { this.closed = true; }
  };
  const received = [];
  let opens = 0;
  let closeDesktop, closeBrowser, closeNext;
  try {
    closeDesktop = subscribeBrowserEvents({ message: e => received.push(['desktop', e.data]), open: () => opens++ });
    closeBrowser = subscribeBrowserEvents({ message: e => received.push(['browser', e.data]) });
    assert.equal(sources.length, 1);
    sources[0].readyState = 1;
    sources[0].onopen();
    sources[0].dispatchEvent(new MessageEvent('browser', { data: 'page-opened' }));
    assert.deepEqual(received, [['desktop', 'page-opened'], ['browser', 'page-opened']]);
    closeBrowser();
    assert.equal(sources[0].closed, false);
    sources[0].onopen();
    assert.equal(opens, 2, 'the desktop still reconciles after reconnecting');
    closeNext = subscribeBrowserEvents({ message() {}, open: () => opens++ });
    await Promise.resolve();
    assert.equal(opens, 3, 'late subscribers observe an already open stream');
    closeDesktop(); closeNext();
    assert.equal(sources[0].closed, true);
    closeNext = subscribeBrowserEvents({ message() {} });
    assert.equal(sources.length, 2);
  } finally {
    closeDesktop?.(); closeBrowser?.(); closeNext?.();
    globalThis.EventSource = previous;
  }
});
