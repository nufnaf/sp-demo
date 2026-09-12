import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createHandler } from '../src/handler.mjs';

test('standalone and desktop ship the same company identity', async t => {
  const root = new URL('../../../', import.meta.url);
  try { await readFile(new URL('package.json', root)); }
  catch (error) { if (error.code === 'ENOENT') { t.skip('standalone package has no desktop distribution'); return; } throw error; }
  for (const [local, desktop] of [
    ['company-logo.svg', 'icons/company-careers-logo.svg'],
    ['brand.css', 'design/company/brand.css'],
  ]) {
    const distributed = await readFile(new URL(`public/${desktop}`, root), 'utf8');
    assert.equal(await readFile(new URL(`../public/${local}`, import.meta.url), 'utf8'), distributed);
  }
});

test('scoped theme, style and logo requests are local assets, independent of database availability', async () => {
  const server = createServer(createHandler(async () => { throw Error('database unavailable'); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const prefix of ['', `/demo/${'a'.repeat(32)}`]) {
      for (const [file, mime] of [['style.css', 'text/css'], ['brand.css', 'text/css'], ['ui.js', 'text/javascript'], ['company-logo.svg', 'image/svg+xml']]) {
        const response = await fetch(`${origin}${prefix}/${file}`);
        assert.equal(response.status, 200);
        assert.ok(response.headers.get('content-type').startsWith(mime));
      }
      const failed = await fetch(origin + prefix + '/');
      assert.equal(failed.status, 503);
      const html = await failed.text();
      assert.ok(html.includes(`src="${prefix}/ui.js"`));
      assert.ok(html.includes(`href="${prefix}/brand.css"`));
      assert.ok(html.includes(`src="${prefix}/company-logo.svg"`));
      assert.match(html, /role="alert"/);
      const csp = failed.headers.get('content-security-policy');
      assert.match(csp, /script-src 'self';/);
      assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/);
      assert.match(csp, /form-action 'self'/);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
