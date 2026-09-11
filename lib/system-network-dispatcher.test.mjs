import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';

const { bypassSystemProxy } = await createJiti(import.meta.url).import('./system-network-dispatcher.ts');

test('loopback always bypasses; NO_PROXY retains suffix, port, wildcard and IPv6 semantics dynamically', t => {
  const saved = [process.env.no_proxy, process.env.NO_PROXY];
  t.after(() => {
    for (const [key, value] of [['no_proxy', saved[0]], ['NO_PROXY', saved[1]]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  delete process.env.no_proxy; process.env.NO_PROXY = '';
  for (const host of ['localhost', 'service.localhost', '127.0.0.1', '127.23.4.5', '[::1]']) assert.equal(bypassSystemProxy(new URL(`http://${host}/`)), true);
  assert.equal(bypassSystemProxy(new URL('https://example.com/')), false);
  assert.equal(bypassSystemProxy(new URL('https://127.example.com/')), false);
  process.env.NO_PROXY = '.example.com:443, *.company.test, [fd00::1]:8080, fd00::2';
  for (const url of ['https://example.com', 'https://sub.example.com', 'https://sub.company.test', 'http://[fd00::1]:8080', 'http://[fd00::2]']) assert.equal(bypassSystemProxy(new URL(url)), true, url);
  for (const url of ['http://example.com', 'https://notexample.com', 'http://[fd00::1]:8081']) assert.equal(bypassSystemProxy(new URL(url)), false, url);
  process.env.no_proxy = '*';
  assert.equal(bypassSystemProxy(new URL('https://anywhere.invalid/')), true);
});
