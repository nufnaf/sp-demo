import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { LocalService, checkoutId, portIsOpen } from './service.mjs';
import { isAppUrl, isExternalUrl } from './policy.mjs';

async function fixture(t, handler) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  t.after(() => { server.closeAllConnections(); server.close(); });
  return { server, port, origin: `http://127.0.0.1:${port}` };
}
async function workspace(t) {
  const root = await mkdtemp(join(tmpdir(), 'syntropic-desktop-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
function reply(root, req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(req.url === '/api/desktop/health'
    ? { app: 'syntropic-local', checkoutId: checkoutId(root) }
    : { runningSessionIds: [] }));
}

test('only the exact loopback origin is a trusted app URL; dangerous external schemes are denied', () => {
  assert.ok(isAppUrl('http://127.0.0.1:30141/?session=x'));
  for (const url of ['http://127.0.0.1:30142', 'https://127.0.0.1:30141', 'http://127.0.0.1.evil:30141', 'file:///tmp/x', 'javascript:alert(1)', 'http://user:pass@127.0.0.1:30141']) assert.equal(isAppUrl(url), false);
  for (const url of ['https://auth.openai.com/authorize', 'http://localhost:1455/auth/callback', 'mailto:user@example.com']) assert.ok(isExternalUrl(url));
  for (const url of ['javascript:alert(1)', 'file:///tmp/x', 'data:text/html,x', 'x-apple.systempreferences:privacy', 'https://user:pass@example.com']) assert.equal(isExternalUrl(url), false);
});

test('waits for readiness, reuses the matching service and never stops it', async (t) => {
  const root = await workspace(t);
  let available = false;
  const { port, origin } = await fixture(t, (req, res) => {
    if (!available) { res.statusCode = 503; res.end(); return; }
    reply(root, req, res);
  });
  const statuses = [];
  const service = new LocalService({ root, origin, timeout: 4000, onStatus: (title) => statuses.push(title) });
  let resolved = false;
  const started = service.start().then((result) => { resolved = true; return result; });
  await delay(150);
  assert.equal(resolved, false);
  assert.equal(service.start(), service.start(), 'concurrent starts share one promise');
  available = true;
  assert.deepEqual(await started, { owned: false });
  await service.stop();
  assert.equal(await portIsOpen(port), true);
  assert.match(statuses[0], /已有服务/);
});

test('rejects another checkout without killing its listener', async (t) => {
  const root = await workspace(t);
  const other = await workspace(t);
  const { port, origin } = await fixture(t, (req, res) => reply(other, req, res));
  const service = new LocalService({ root, origin });
  await assert.rejects(service.start(), /其他项目或 worktree/);
  await service.stop();
  assert.equal(await portIsOpen(port), true);
});

test('reports an unresponsive or unknown occupied port without taking ownership', async (t) => {
  const root = await workspace(t);
  const { port, origin } = await fixture(t, (_req, res) => { res.statusCode = 404; res.end(); });
  const service = new LocalService({ root, origin, timeout: 100 });
  await assert.rejects(service.start(), /健康检查/);
  await service.stop();
  assert.equal(await portIsOpen(port), true);
});

test('does not consider identity alone sufficient when the Pi API is broken', async (t) => {
  const root = await workspace(t);
  const { origin } = await fixture(t, (req, res) => {
    if (req.url === '/api/agent/running') { res.statusCode = 500; res.end(); return; }
    reply(root, req, res);
  });
  const service = new LocalService({ root, origin, timeout: 100 });
  await assert.rejects(service.start(), /健康检查/);
  await service.stop();
});

test('reports child startup failure and refuses a duplicate Next dev lock', async (t) => {
  const root = await workspace(t);
  const { server, origin } = await fixture(t, () => {});
  await new Promise((resolve) => server.close(resolve));
  const service = new LocalService({ root, origin, timeout: 2000, command: [process.execPath, '-e', 'process.exit(7)'] });
  await assert.rejects(service.start(), /退出码 7/);
  await service.stop();
  await mkdir(join(root, '.next/dev'), { recursive: true });
  await writeFile(join(root, '.next/dev/lock'), '');
  const locked = new LocalService({ root, origin });
  await assert.rejects(locked.start(), /lock 已存在/);
  assert.equal(locked.owned, false);
});

test('stopping during startup cancels it and reaps the owned child', async (t) => {
  const root = await workspace(t);
  const { server, origin } = await fixture(t, () => {});
  await new Promise((resolve) => server.close(resolve));
  const service = new LocalService({ root, origin, timeout: 3000, command: [process.execPath, '-e', 'setInterval(()=>{},1000)'] });
  const started = assert.rejects(service.start(), /启动已取消/);
  while (!service.child) await delay(10);
  const pid = service.child.pid;
  await service.stop();
  await started;
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
});

test('owns a real recruiting service, checks its data, and preserves saves across restart', async (t) => {
  const dataRoot = await workspace(t);
  const root = new URL('../apps/recruiting/', import.meta.url).pathname;
  const { server, port, origin } = await fixture(t, () => {});
  await new Promise((resolve) => server.close(resolve));
  const dataFile = join(dataRoot, 'state.json');
  const options = { root, origin, kind: 'recruiting', timeout: 8000,
    env: { ...process.env, PORT: String(port), RECRUITING_DATA_FILE: dataFile, DATABASE_URL: '', VERCEL: '' } };
  const service = new LocalService(options);
  t.after(() => service.stop());
  assert.deepEqual(await service.start(), { owned: true });
  const { readFile } = await import('node:fs/promises');
  const state = JSON.parse(await readFile(dataFile, 'utf8'));
  const response = await fetch(`${origin}/jobs/ai-agent/save`, { method: 'POST', redirect: 'manual',
    headers: { Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ revision: state.revision, target: '9', owner: '测试负责人', description: '重启持久化测试' }),
  });
  assert.equal(response.status, 303);
  await service.stop();
  assert.equal(await portIsOpen(port), false);
  const restarted = new LocalService(options);
  t.after(() => restarted.stop());
  await restarted.start();
  const html = await (await fetch(`${origin}/jobs/ai-agent`)).text();
  assert.match(html, /测试负责人/);
  assert.match(html, /重启持久化测试/);
});
