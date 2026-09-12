import assert from 'node:assert/strict';
import test from 'node:test';
import { createSpaceThumbnailCapture } from './space-thumbnail.mjs';
import { isAppUrl } from './policy.mjs';

test('thumbnail capture rejects other renderers and child frames and serializes capture', async () => {
  let finish;
  const contents = { mainFrame: { url: 'http://127.0.0.1:30141/' }, capturePage: () => new Promise(resolve => { finish = resolve; }) };
  const win = { webContents: contents, isDestroyed: () => false, isVisible: () => true, isMinimized: () => false };
  const capture = createSpaceThumbnailCapture(() => win, isAppUrl);
  const event = { sender: contents, senderFrame: contents.mainFrame };
  assert.equal(await capture({ ...event, sender: {} }), null);
  assert.equal(await capture({ ...event, senderFrame: { url: contents.mainFrame.url } }), null);
  contents.mainFrame.url = 'https://example.com/';
  assert.equal(await capture(event), null);
  contents.mainFrame.url = 'http://127.0.0.1:30141/';
  const pending = capture(event);
  assert.equal(await capture(event), null);
  finish({ isEmpty: () => true });
  assert.equal(await pending, null);
  const next = capture(event);
  finish({ isEmpty: () => false, resize: ({ width }) => { assert.equal(width, 480); return { toJPEG: () => Buffer.from('jpeg') }; } });
  assert.equal(await next, 'data:image/jpeg;base64,anBlZw==');
});
