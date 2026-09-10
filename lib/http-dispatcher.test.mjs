import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";
import { createJiti } from "jiti";

const PROXY_ENV_KEYS = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "no_proxy",
  "ALL_PROXY",
  "all_proxy",
];

test("configures HTTP_PROXY, HTTPS_PROXY, and NO_PROXY for global fetch", async (t) => {
  const originalEnv = new Map(PROXY_ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of PROXY_ENV_KEYS) delete process.env[key];

  const connectTargets = [];
  const forwardedRequests = [];
  const proxy = createServer((req, res) => {
    forwardedRequests.push(`${req.method} ${req.url}`);
    res.writeHead(204, { Connection: "close" });
    res.end();
  });
  proxy.on("connect", (req, socket) => {
    connectTargets.push(req.url);
    socket.end("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n");
  });
  proxy.listen(0, "127.0.0.1");
  await once(proxy, "listening");

  t.after(async () => {
    for (const [key, value] of originalEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await new Promise((resolve, reject) => {
      proxy.close((error) => error ? reject(error) : resolve());
    });
  });

  const address = proxy.address();
  assert.ok(address && typeof address === "object");
  const proxyUrl = `http://127.0.0.1:${address.port}`;
  process.env.HTTP_PROXY = proxyUrl;
  process.env.HTTPS_PROXY = proxyUrl;
  process.env.NO_PROXY = "bypass.invalid";

  const jiti = createJiti(import.meta.url);
  const { configureHttpDispatcher } = await jiti.import("./http-dispatcher.ts");
  const { getGlobalDispatcher } = await import("undici");

  assert.throws(() => configureHttpDispatcher(-1), /Invalid HTTP idle timeout/);
  configureHttpDispatcher(2_000);

  const dispatcher = getGlobalDispatcher();
  configureHttpDispatcher(5_000);
  assert.equal(getGlobalDispatcher(), dispatcher, "configuration should be idempotent");

  const httpResponse = await fetch("http://target.invalid/through-http-proxy", {
    signal: AbortSignal.timeout(2_000),
  });
  assert.equal(httpResponse.status, 204);
  assert.deepEqual(forwardedRequests, ["GET http://target.invalid/through-http-proxy"]);
  assert.deepEqual(connectTargets, []);

  await assert.rejects(fetch("https://target.invalid/through-https-proxy", {
    signal: AbortSignal.timeout(2_000),
  }));
  assert.deepEqual(connectTargets, ["target.invalid:443"]);

  const forwardedRequestCount = forwardedRequests.length;
  const connectTargetCount = connectTargets.length;
  await assert.rejects(fetch("http://bypass.invalid:9/no-proxy", {
    signal: AbortSignal.timeout(2_000),
  }));
  assert.equal(forwardedRequests.length, forwardedRequestCount);
  assert.equal(connectTargets.length, connectTargetCount);
});

test("GUI-style environment uses the system proxy, preserves bypasses, and explicit environment wins", async (t) => {
  const saved = new Map(PROXY_ENV_KEYS.map(key => [key, process.env[key]]));
  for (const key of PROXY_ENV_KEYS) delete process.env[key];
  const hits = [];
  const proxy = createServer((req, res) => {
    hits.push(req.url);
    res.end(JSON.stringify({ via: 'system-proxy' }));
  });
  proxy.on('connect', (req, socket) => {
    hits.push(`CONNECT ${req.url}`);
    socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');
  });
  proxy.listen(0, '127.0.0.1');
  await once(proxy, 'listening');
  const direct = createServer((_req, res) => res.end('local-control'));
  direct.listen(0, '127.0.0.1');
  await once(direct, 'listening');
  const dispatchers = [];
  t.after(async () => {
    for (const agent of dispatchers) await agent.destroy();
    proxy.closeAllConnections(); direct.closeAllConnections();
    await Promise.all([new Promise(r => proxy.close(r)), new Promise(r => direct.close(r))]);
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const { createHttpDispatcher } = await createJiti(import.meta.url).import('./http-dispatcher.ts');
  const { fetch: request } = await import('undici');
  const system = { http: `http://127.0.0.1:${proxy.address().port}`, https: `http://127.0.0.1:${proxy.address().port}`, exceptions: ['bypass.invalid'], excludeSimpleHostnames: false };
  const dispatcher = createHttpDispatcher(2000, system);
  dispatchers.push(dispatcher);
  assert.deepEqual(await (await request('http://target.invalid/jobs', { dispatcher })).json(), { via: 'system-proxy' });
  await assert.rejects(request('https://target.invalid/jobs', { dispatcher, signal: AbortSignal.timeout(2000) }));
  assert.deepEqual(hits, ['http://target.invalid/jobs', 'CONNECT target.invalid:443']);
  assert.equal(await (await request(`http://127.0.0.1:${direct.address().port}/health`, { dispatcher })).text(), 'local-control');
  await assert.rejects(request('http://bypass.invalid/', { dispatcher, signal: AbortSignal.timeout(2000) }));
  process.env.NO_PROXY = 'environment-bypass.invalid';
  await assert.rejects(request('http://environment-bypass.invalid/', { dispatcher, signal: AbortSignal.timeout(2000) }));
  assert.equal(hits.length, 2, 'bypasses never hit the proxy');
  process.env.HTTP_PROXY = system.http;
  const explicit = createHttpDispatcher(2000, { ...system, http: 'http://unreachable.invalid:1' });
  dispatchers.push(explicit);
  assert.deepEqual(await (await request('http://environment-wins.invalid/', { dispatcher: explicit })).json(), { via: 'system-proxy' });
  assert.equal(hits.at(-1), 'http://environment-wins.invalid/');
});
