import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { setTimeout as delay } from 'node:timers/promises';
import ts from 'typescript';
const source = await readFile(new URL('./recruiting-snapshot.ts', import.meta.url), 'utf8');
const compiled = ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
function reader(base, timeout = ms => AbortSignal.timeout(ms)) {
  const testModule = { exports: {} };
  vm.runInNewContext(compiled, { module: testModule, exports: testModule.exports, URL, fetch, Error, TypeError, SyntaxError,
    AbortSignal: { timeout, any: signals => AbortSignal.any(signals) },
    require: () => ({ recruitingSiteUrl: () => new URL(base) }),
  });
  return testModule.exports.readRecruitingSnapshot;
}
async function fixture(fn, operation) {
  const server = createServer(fn);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await operation(`http://127.0.0.1:${server.address().port}/`); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
const body = JSON.stringify({ app: 'syntropic-recruiting', jobs: [{ id: 'job-1' }], scene: null });
test('a successful website read returns the saved jobs without repeating the request', async () => {
  let calls = 0;
  await fixture((_req, res) => { calls++; res.setHeader('content-type', 'application/json'); res.end(body); }, async base => {
    const result = await reader(base)();
    assert.equal(result.jobs[0].url, new URL('jobs/job-1', base).href);
    assert.equal(calls, 1);
  });
});
test('the deadline includes reading the response body and reports an actionable timeout', async () => {
  await fixture((_req, res) => { res.setHeader('content-type', 'application/json'); res.write('{'); }, async base => {
    const read = reader(base, ms => { assert.equal(ms, 30000); return AbortSignal.timeout(50); });
    await assert.rejects(read(), /招聘网站响应超时.*30 秒/);
  });
});
test('cancellation during a website read preserves the parent cancellation', async () => {
  await fixture((_req, res) => { res.writeHead(200); res.flushHeaders(); }, async base => {
    const controller = new AbortController();
    const pending = reader(base)(controller.signal);
    controller.abort(new Error('user cancelled'));
    await assert.rejects(pending, /user cancelled/);
  });
});
test('HTTP failures are reported without automatically retrying or treating them as empty jobs', async () => {
  let calls = 0;
  await fixture((_req, res) => { calls++; res.writeHead(503); res.end('unavailable'); }, async base => {
    await assert.rejects(reader(base)(), /HTTP 503/);
    assert.equal(calls, 1);
  });
});

test('a six-second response completes within the new deadline without retrying', { timeout: 12000 }, async () => {
  let calls = 0;
  await fixture(async (_req, res) => { calls++; await delay(6000); res.end(body); }, async base => {
    assert.equal((await reader(base)()).jobs.length, 1);
    assert.equal(calls, 1);
  });
});
