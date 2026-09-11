import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { chromium } from 'playwright-core';
import { createJiti } from 'jiti';
const { desktopEventsStream } = await createJiti(import.meta.url).import('../lib/desktop-events-stream.ts');

// Real HTTP/1 sockets and Chromium EventSource: route interception cannot reproduce this bug.
test('live preview plus documents and Agent streams leave capacity for a publication POST', { timeout: 30000 }, async () => {
  const code = ts.transpileModule(await readFile(new URL('../lib/desktop-events-client.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const sockets = new Set(); let held = 0, posts = 0;
  const server = http.createServer(async (req, res) => {
    if (req.url === '/') { res.end('<!doctype html><title>Connection regression</title>'); return; }
    if (req.url === '/client.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(code); return; }
    if (req.url === '/api/agent/new') { posts++; res.setHeader('Content-Type', 'application/json'); res.end('{"sessionId":"publication"}'); return; }
    if (req.url.startsWith('/hold')) {
      held++; res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.write('data: ready\n\n');
      req.on('close', () => held--); return;
    }
    if (req.url.startsWith('/api/desktop/events')) {
      const abort = new AbortController(); req.on('close', () => abort.abort());
      const idle = () => () => {};
      const stream = desktopEventsStream(abort.signal, {
        browser: idle, file: idle, status: send => { send({ available: true }); return () => {}; }, snapshot: () => ({ available: true }),
        frames: req.url.includes('frames=1') ? send => { const timer = setInterval(() => send({ dataUrl: 'live-frame' }), 20); return () => clearInterval(timer); } : undefined,
      });
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      try { for await (const chunk of stream) if (!res.destroyed) res.write(chunk); } finally { res.end(); }
      return;
    }
    res.writeHead(404).end();
  });
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage(); await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(async () => {
      await Promise.all(Array.from({ length: 6 }, (_, i) => new Promise(resolve => {
        const s = new EventSource(`/hold?legacy=${i}`); (window.legacy ??= []).push(s); s.onmessage = resolve;
      })));
      window.queued = fetch('/api/agent/new', { method: 'POST' });
    });
    await page.waitForTimeout(300); assert.equal(held, 6); assert.equal(posts, 0, 'legacy layout exhausts the actual socket pool');
    await page.evaluate(async () => { window.legacy.forEach(s => s.close()); await window.queued; });
    assert.equal(posts, 1, 'freeing a connection releases the original request');
    await page.evaluate(async () => {
      const { subscribeDesktopEvents } = await import('/client.js');
      window.frames = 0; window.releases = [];
      for (const channel of ['browser', 'file', 'computer-status', 'computer-frame']) window.releases.push(subscribeDesktopEvents(channel, { message: () => { if (channel === 'computer-frame') window.frames++; } }));
      // Jarvis, document watch, another visible document, and a running task.
      await Promise.all(Array.from({ length: 4 }, (_, i) => new Promise(resolve => {
        const s = new EventSource(`/hold?current=${i}`); (window.current ??= []).push(s); s.onmessage = resolve;
      })));
    });
    await page.waitForFunction(() => window.frames >= 3);
    const result = await page.evaluate(async () => {
      const start = performance.now(), before = window.frames;
      const response = await fetch('/api/agent/new', { method: 'POST', signal: AbortSignal.timeout(2000) });
      return { duration: performance.now() - start, body: await response.json(), before };
    });
    assert.equal(result.body.sessionId, 'publication'); assert.equal(posts, 2); assert.ok(result.duration < 2000);
    await page.waitForFunction(before => window.frames > before, result.before);
    console.log(`publication POST with live frames and four other streams: ${Math.round(result.duration)}ms`);
  } finally { await browser.close(); for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); }
});
