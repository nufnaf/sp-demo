import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);
const { renderRecruitingJdDemo } = await jiti.import('../lib/recruiting-jd-demo-renderer.ts');
const { recruitingJdPreviewDocument } = await jiti.import('../lib/recruiting-jd-preview.ts');
const html = renderRecruitingJdDemo();
const chrome = process.env.PI_WEB_BROWSER_EXECUTABLE || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(path => existsSync(path));

// Use the production preview document in its actual opaque-origin sandbox.
async function open(t, { animate = true, width = 1100, reducedMotion = 'no-preference' } = {}) {
  const browser = await chromium.launch({ headless: true, ...(chrome ? { executablePath: chrome } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width, height: 750 }, reducedMotion });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const source = recruitingJdPreviewDocument(html);
  await page.setContent('<style>html,body{margin:0;height:100%}iframe{width:100%;height:100%;border:0}</style>');
  await page.evaluate(({ source, animate }) => {
    window.completions = 0;
    window.addEventListener('message', event => { if (event.data?.type === 'jd-preview-complete') window.completions++; });
    const frame = document.createElement('iframe');
    frame.sandbox = 'allow-scripts';
    frame.srcdoc = source;
    frame.onload = () => frame.contentWindow.postMessage({ type: 'jd-preview-state', animate, active: true }, '*');
    document.body.append(frame);
  }, { source, animate });
  const frame = await page.locator('iframe').elementHandle().then(el => el.contentFrame());
  await frame.waitForSelector('main[aria-busy]');
  const state = () => frame.evaluate(() => ({
    text: document.querySelector('.content').innerText,
    busy: document.querySelector('main').getAttribute('aria-busy'),
    pending: document.querySelectorAll('[data-jd-pending]').length,
    scroll: scrollY,
  }));
  const active = value => page.evaluate(active => document.querySelector('iframe').contentWindow.postMessage({ type: 'jd-preview-state', animate: true, active }, '*'), value);
  return { page, frame, state, active, errors };
}

test('JD streams for 18 seconds, retains exact text/markup, completes once and follows growth', async t => {
  const { page, frame, state, errors } = await open(t);
  const first = await state();
  assert.equal(first.busy, 'true');
  assert.ok(first.pending > 0);
  await page.waitForTimeout(5000);
  const middle = await state();
  assert.ok(middle.text.length > first.text.length);
  assert.ok(middle.scroll > 0);
  assert.equal(await page.evaluate(() => window.completions), 0);
  await page.waitForTimeout(12000);
  assert.equal((await state()).busy, 'true');
  await page.waitForTimeout(1500);
  const last = await state();
  assert.equal(last.busy, 'false');
  assert.equal(last.pending, 0);
  assert.equal(await page.evaluate(() => window.completions), 1);
  const comparison = await frame.evaluate(original => {
    const saved = new DOMParser().parseFromString(original, 'text/html');
    return {
      original: saved.querySelector('main').textContent,
      preview: document.querySelector('main').textContent,
      headings: [...document.querySelectorAll('h1,h2,h3')].map(e => e.textContent),
      expected: [...saved.querySelectorAll('h1,h2,h3')].map(e => e.textContent),
      caret: document.querySelectorAll('.jd-writing').length,
    };
  }, html);
  assert.equal(comparison.original, comparison.preview);
  assert.deepEqual(comparison.headings, comparison.expected);
  assert.equal(comparison.caret, 0);
  await page.waitForTimeout(3000);
  assert.equal(await page.evaluate(() => window.completions), 1);
  assert.deepEqual(errors, []);
});

test('background windows pause and manual upward scrolling stops automatic following', async t => {
  const { page, frame, state, active } = await open(t);
  await page.waitForTimeout(6000);
  await active(false);
  await page.waitForTimeout(100);
  const paused = await state();
  await page.waitForTimeout(8000);
  assert.deepEqual(await state(), paused);
  await active(true);
  await page.waitForTimeout(2000);
  assert.ok((await state()).text.length > paused.text.length);
  await frame.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);
  await page.waitForTimeout(4000);
  assert.equal((await state()).scroll, 0);
  await page.waitForTimeout(12000);
  assert.equal((await state()).busy, 'false');
});

test('reopened and reduced-motion views show complete content immediately; narrow layout does not overflow', async t => {
  for (const options of [{ animate: false }, { reducedMotion: 'reduce' }, { animate: false, width: 390 }]) {
    const { page, frame, state, errors } = await open(t, options);
    assert.equal((await state()).busy, 'false');
    assert.equal((await state()).pending, 0);
    assert.equal(await page.evaluate(() => window.completions), 1);
    assert.equal(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
  }
});

test('printing during playback reveals the whole document and removes the cursor', async t => {
  const { page, frame, state } = await open(t);
  await page.waitForTimeout(1000);
  await frame.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  assert.equal((await state()).busy, 'false');
  assert.equal((await state()).pending, 0);
  assert.equal(await frame.locator('.jd-writing').count(), 0);
});

test('narrow streaming follows the writing above the stacked sidebar', async t => {
  const { page, frame } = await open(t, { width: 390 });
  await page.waitForTimeout(6000);
  const position = await frame.evaluate(() => ({
    bottom: document.querySelector('.jd-writing').getBoundingClientRect().bottom,
    height: innerHeight,
    scroll: scrollY,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  assert.ok(position.scroll > 0);
  assert.ok(position.bottom > 0 && position.bottom <= position.height);
  assert.equal(position.overflow, false);
});
