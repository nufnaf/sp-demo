import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import { createPresentationRun } from '../electron/presentation.mjs';

test('an untouched Jarvis session survives idle disposal and streams the first and subsequent sends', { timeout: 15_000 }, async t => {
  const temp = await mkdtemp(join(tmpdir(), 'jarvis-lifecycle-'));
  const run = await createPresentationRun(temp);
  const oldRoot = process.env.SYNTROPIC_PRESENTATION_ROOT;
  const oldAgentDir = process.env.PI_CODING_AGENT_DIR;
  process.env.SYNTROPIC_PRESENTATION_ROOT = run.root;
  process.env.PI_CODING_AGENT_DIR = join(temp, 'agent');
  const jiti = createJiti(import.meta.url, { alias: { '@': fileURLToPath(new URL('../', import.meta.url)) } });
  const { startRpcSession, getRpcSession } = await jiti.import('./rpc-manager.ts');
  const { POST: ensureJarvis } = await jiti.import('../app/api/jarvis/route.ts');
  const { POST: sendCommand } = await jiti.import('../app/api/agent/[id]/route.ts');
  const { GET: connect } = await jiti.import('../app/api/agent/[id]/events/route.ts');
  const { SessionManager } = await import('@earendil-works/pi-coding-agent');
  const { invalidateSessionPathCache } = await jiti.import('./session-reader.ts');
  const controllers = [];
  let id;
  t.after(async () => {
    controllers.forEach(controller => controller.abort());
    if (id) await getRpcSession(id)?.shutdown();
    if (oldRoot === undefined) delete process.env.SYNTROPIC_PRESENTATION_ROOT; else process.env.SYNTROPIC_PRESENTATION_ROOT = oldRoot;
    if (oldAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = oldAgentDir;
    await rm(temp, { recursive: true, force: true });
  });
  const cwd = join(run.root, 'workspace');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const jsonRequest = (path, body) => new Request(`http://localhost${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', Host: 'localhost' }, body: JSON.stringify(body),
  });
  const [created, concurrent] = await Promise.all([
    ensureJarvis(jsonRequest('/api/jarvis', { cwd })),
    ensureJarvis(jsonRequest('/api/jarvis', { cwd })),
  ]);
  assert.equal(created.status, 200, await created.clone().text());
  id = (await created.json()).sessionId;
  assert.equal((await concurrent.json()).sessionId, id, 'concurrent mounts must share one Jarvis session');
  const file = getRpcSession(id).sessionFile;
  assert.equal(existsSync(file), true, 'ID must be resumable before the first prompt');
  assert.equal(SessionManager.open(file).getSessionId(), id);
  assert.equal(SessionManager.open(file).getCwd(), cwd);

  const openStream = async () => {
    const controller = new AbortController();
    controllers.push(controller);
    const response = await connect(new Request(`http://localhost/api/agent/${id}/events`, { signal: controller.signal }), { params: Promise.resolve({ id }) });
    assert.equal(response.status, 200);
    const reader = response.body.getReader();
    const next = async () => {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) return null;
        const text = new TextDecoder().decode(chunk.value);
        if (text.startsWith('data: ')) return JSON.parse(text.slice(6));
      }
    };
    assert.equal((await next()).type, 'connected');
    return { next, reader };
  };

  let stream = await openStream();
  const secondClient = await openStream();
  for (let round = 0; round < 2; round++) {
    // Advance the real wrapper's idle timer without waiting ten wall-clock minutes.
    await getRpcSession(id).send({ type: 'get_tools' });
    t.mock.timers.tick(10 * 60 * 1000);
    for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(getRpcSession(id)?.isAlive() ?? false, false);
    assert.equal((await stream.next()).type, 'session_closed');
    assert.equal(await stream.next(), null, 'idle SSE must close instead of heartbeating a dead wrapper');
    if (round === 0) {
      assert.equal((await secondClient.next()).type, 'session_closed');
      assert.equal(await secondClient.next(), null);
      invalidateSessionPathCache(id); // also exercise discovery without the startup path cache
    }

    stream = await openStream();
    assert.equal(getRpcSession(id).sessionId, id);
    assert.equal(getRpcSession(id).cwd, cwd);
    const sent = await sendCommand(jsonRequest(`/api/agent/${id}`, { type: 'prompt', message: `帮助 ${round}` }), { params: Promise.resolve({ id }) });
    assert.equal(sent.status, 200, await sent.clone().text());
    const events = [];
    while (events.at(-1)?.type !== 'prompt_done') events.push(await stream.next());
    assert.ok(events.some(event => event.type === 'message_end' && event.message?.role === 'assistant'));
    const entries = (await readFile(file, 'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(entries.filter(entry => entry.type === 'session').length, 1);
    assert.equal(entries.filter(entry => entry.type === 'message' && entry.message.role === 'assistant').length, round + 1);
  }
  await assert.rejects(startRpcSession('missing', join(temp, 'missing.jsonl')), /Session not found/);
  await assert.rejects(startRpcSession('wrong-id', file), /Session identity mismatch/);
  // A stale path cache must also produce a definite rejection, not open an
  // unrelated empty session under the disappeared file's name.
  controllers.forEach(controller => controller.abort());
  await getRpcSession(id).shutdown();
  await rm(file);
  const rejected = await sendCommand(jsonRequest(`/api/agent/${id}`, { type: 'prompt', message: '帮助' }), { params: Promise.resolve({ id }) });
  assert.equal(rejected.status, 404);
  assert.equal((await rejected.json()).accepted, false);
  const recovered = await ensureJarvis(jsonRequest('/api/jarvis', { cwd }));
  assert.equal(recovered.status, 200);
  const recoveredId = (await recovered.json()).sessionId;
  assert.notEqual(recoveredId, id);
  id = recoveredId;
  assert.equal(getRpcSession(id).cwd, cwd);
  assert.equal(getRpcSession(id).inner.sessionManager.getEntries().some(entry => entry.type === 'message'), false, 'recovery must not replay the rejected prompt');
});
