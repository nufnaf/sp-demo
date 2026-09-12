import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { connect } from 'node:net';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, stat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { gzipSync } from 'node:zlib';
import test from 'node:test';
import { _electron } from 'playwright-core';
import { createJiti } from 'jiti';
import { fetch } from 'undici';
import { socksFixture } from './fixtures/socks-proxy.mjs';

const { createHttpDispatcher } = await createJiti(import.meta.url).import('../lib/http-dispatcher.ts');

test('native system transport: PAC, HTTP proxy, direct, per-URL rules, switching, redirects, POST, SSE, compression, abort and isolation', { timeout: 60000 }, async t => {
  const requests = [];
  const data = await mkdtemp(join(tmpdir(), 'syntropic-network-test-'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(data, 'key.pem'), '-out', join(data, 'cert.pem'), '-days', '1', '-subj', '/CN=secure.fixture.test', '-addext', 'subjectAltName=DNS:secure.fixture.test'], { stdio: 'ignore' });
  const tls = { key: await readFile(join(data, 'key.pem')), cert: await readFile(join(data, 'cert.pem')) };
  const secure = createHttpsServer(tls, (_req, res) => res.end('secure origin reached'));
  secure.listen(0, '127.0.0.1'); await once(secure, 'listening');
  let streamClosed = false;
  const proxy = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://direct.invalid');
    requests.push({ url: url.href, auth: req.headers.authorization, cookie: req.headers.cookie });
    if (url.pathname === '/redirect') { res.writeHead(302, { Location: '/final' }).end(); return; }
    if (url.pathname === '/cookies') { res.setHeader('Set-Cookie', ['a=1; Path=/', 'b=2; Path=/']); res.end('cookies'); return; }
    if (url.pathname === '/gzip') { res.setHeader('Content-Encoding', 'gzip'); res.end(gzipSync('decoded exactly once')); return; }
    if (url.pathname === '/stream') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('data: first\n\n');
      const timer = setInterval(() => res.write('data: next\n\n'), 25);
      res.on('close', () => { clearInterval(timer); streamClosed = true; });
      return;
    }
    let body = '';
    for await (const chunk of req) body += chunk;
    res.end(JSON.stringify({ method: req.method, body, path: url.pathname, auth: req.headers.authorization }));
  });
  proxy.listen(0, '127.0.0.1'); await once(proxy, 'listening');
  const proxyPort = proxy.address().port;
  const sockets = new Set();
  const tunnel = (req, socket, head) => {
    if (req.url !== `secure.fixture.test:${secure.address().port}`) { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    const upstream = connect(secure.address().port, '127.0.0.1', () => {
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) upstream.write(head);
      socket.pipe(upstream); upstream.pipe(socket);
    });
    for (const peer of [socket, upstream]) { sockets.add(peer); peer.on('close', () => sockets.delete(peer)); peer.on('error', () => {}); }
    socket.on('close', () => upstream.destroy());
  };
  proxy.on('connect', tunnel);
  const secureProxy = createHttpsServer(tls, (_req, res) => res.end('HTTPS proxy reached'));
  secureProxy.on('connect', tunnel); secureProxy.listen(0, '127.0.0.1'); await once(secureProxy, 'listening');
  const socks = socksFixture(proxyPort); socks.server.listen(0, '127.0.0.1'); await once(socks.server, 'listening');
  let pacRule = `PROXY 127.0.0.1:${proxyPort}`;
  const pac = createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/x-ns-proxy-autoconfig');
    res.end(`function FindProxyForURL(url, host) { if (host === 'direct.fixture.test') return 'DIRECT'; return '${pacRule}'; }`);
  });
  pac.listen(0, '127.0.0.1'); await once(pac, 'listening');
  const env = { ...process.env, SYNTROPIC_TEST_DATA: data }; delete env.ELECTRON_RUN_AS_NODE;
  const desktop = await _electron.launch({ args: [join(import.meta.dirname, 'fixtures/system-network-harness.mjs')], env });
  const socketPath = await desktop.evaluate(async () => {
    const deadline = Date.now() + 5000;
    while (!globalThis.systemNetworkFixture) {
      if (Date.now() > deadline) throw new Error('network fixture did not initialize');
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    return globalThis.systemNetworkFixture.bridge.socketPath;
  });
  const envKeys = ['http_proxy', 'HTTP_PROXY', 'https_proxy', 'HTTPS_PROXY', 'all_proxy', 'ALL_PROXY', 'no_proxy', 'NO_PROXY', 'SYNTROPIC_NETWORK_SOCKET'];
  const savedEnv = new Map(envKeys.map(key => [key, process.env[key]]));
  for (const key of envKeys) delete process.env[key];
  process.env.SYNTROPIC_NETWORK_SOCKET = socketPath;
  const dispatcher = createHttpDispatcher(5000);
  t.after(async () => {
    await dispatcher.destroy();
    await desktop.evaluate(() => globalThis.systemNetworkFixture.bridge.close());
    await desktop.close(); proxy.closeAllConnections(); pac.closeAllConnections();
    secure.closeAllConnections(); secureProxy.closeAllConnections();
    for (const socket of sockets) socket.destroy();
    await Promise.all([new Promise(r => proxy.close(r)), new Promise(r => pac.close(r)), new Promise(r => secure.close(r)), new Promise(r => secureProxy.close(r)), socks.close()]);
    await rm(data, { recursive: true, force: true });
    for (const [key, value] of savedEnv) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  });
  assert.equal((await stat(socketPath)).mode & 0o777, 0o600);
  const setProxy = config => desktop.evaluate(async (_electron, config) => {
    await globalThis.systemNetworkFixture.session.closeAllConnections();
    await globalThis.systemNetworkFixture.session.setProxy(config);
  }, config);
  const request = (path, options = {}) => fetch(`http://network-target.invalid${path}`, { dispatcher, ...options });
  await setProxy({ mode: 'pac_script', pacScript: `http://127.0.0.1:${pac.address().port}/proxy.pac` });
  assert.equal((await (await request('/pac')).json()).path, '/pac');
  assert.equal((await (await fetch(`http://direct.fixture.test:${proxyPort}/pac-direct`, { dispatcher })).json()).path, '/pac-direct');
  const secureUrl = `https://secure.fixture.test:${secure.address().port}/`;
  assert.equal(await (await fetch(secureUrl, { dispatcher })).text(), 'secure origin reached');
  const posted = await (await request('/post', { method: 'POST', headers: { Authorization: 'Bearer fixture-only', 'Content-Type': 'application/json' }, body: '{"hello":"world"}' })).json();
  assert.deepEqual(posted, { method: 'POST', body: '{"hello":"world"}', path: '/post', auth: 'Bearer fixture-only' });
  assert.equal(requests.filter(item => item.url.endsWith('/post')).length, 1);
  for (const method of ['DELETE', 'POST', 'PUT', 'PATCH', 'OPTIONS']) {
    const empty = await (await request('/empty', { method })).json();
    assert.deepEqual(empty, { method, body: '', path: '/empty' });
  }
  const emptyStream = await (await request('/empty-stream', { method: 'POST', body: new ReadableStream({ start(controller) { controller.close(); } }), duplex: 'half' })).json();
  assert.deepEqual(emptyStream, { method: 'POST', body: '', path: '/empty-stream' });
  assert.equal((await (await request('/redirect')).json()).path, '/final');
  assert.equal((await request('/redirect', { redirect: 'manual' })).status, 302);
  assert.equal(await (await request('/gzip')).text(), 'decoded exactly once');
  const cookieResponse = await request('/cookies'); await cookieResponse.text();
  assert.equal(cookieResponse.headers.getSetCookie().length, 2);
  await (await request('/no-ambient-cookie')).text();
  assert.equal(requests.at(-1).cookie, undefined);
  const abort = new AbortController();
  const stream = await request('/stream', { signal: abort.signal });
  const reader = stream.body.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value), /data: first/);
  abort.abort(); await assert.rejects(reader.read());
  for (let i = 0; i < 30 && !streamClosed; i++) await new Promise(r => setTimeout(r, 20));
  assert.equal(streamClosed, true);
  await setProxy({ mode: 'fixed_servers', proxyRules: `http=127.0.0.1:${proxyPort}` });
  assert.equal((await (await request('/manual')).json()).path, '/manual');
  await setProxy({ mode: 'direct' });
  // Loopback bypass must work even if Chromium's proxy is unavailable.
  assert.equal((await (await fetch(`http://127.0.0.1:${proxyPort}/local`, { dispatcher })).json()).path, '/local');
  await assert.rejects(request('/unreachable'));
  // HTTPS proxy and both SOCKS versions use Chromium's native implementations.
  await setProxy({ mode: 'fixed_servers', proxyRules: `https://secure.fixture.test:${secureProxy.address().port}` });
  assert.equal(await (await fetch(secureUrl, { dispatcher })).text(), 'secure origin reached');
  for (const version of [4, 5]) {
    await setProxy({ mode: 'fixed_servers', proxyRules: `socks${version}://127.0.0.1:${socks.server.address().port}`, proxyBypassRules: '<-loopback>' });
    assert.equal((await (await fetch(`http://direct.fixture.test:${proxyPort}/socks${version}`, { dispatcher })).json()).path, `/socks${version}`);
    assert.ok(socks.versions.includes(version));
  }
  // A PAC-authorized fallback is handled before any request body is submitted.
  pacRule = `PROXY 127.0.0.1:1; PROXY 127.0.0.1:${proxyPort}`;
  await setProxy({ mode: 'pac_script', pacScript: `http://127.0.0.1:${pac.address().port}/proxy.pac` });
  assert.equal((await (await request('/restored')).json()).path, '/restored');
});
