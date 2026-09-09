import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJiti } from 'jiti';
import { createAgentSessionServices, ModelRuntime, SessionManager, SettingsManager, defineTool } from '@earendil-works/pi-coding-agent';
import { createAssistantMessageEventStream, Type } from '@earendil-works/pi-ai';
const { createBrowserTaskSession, BROWSER_MODEL } = await createJiti(import.meta.url).import('./tasks.ts');

async function fixture(t, completed, failFirstFinish = false) {
  const cwd = await mkdtemp(join(tmpdir(), 'browser-finish-'));
  const runtime = await ModelRuntime.create({ authPath: join(cwd, 'auth.json'), modelsPath: null, modelsStorePath: join(cwd, 'models'), refreshOnCreate: false });
  runtime.hasConfiguredAuth = () => true;
  runtime.getAuth = async () => ({ auth: { apiKey: 'test-only-never-sent' } });
  const model = runtime.getModel(BROWSER_MODEL.provider, BROWSER_MODEL.modelId);
  assert.ok(model);
  const services = await createAgentSessionServices({
    cwd, agentDir: cwd, modelRuntime: runtime,
    settingsManager: SettingsManager.inMemory({ retry: { enabled: false }, compaction: { enabled: false } }),
    resourceLoaderOptions: { noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true, systemPrompt: 'Test browser lifecycle.' },
  });
  let reported;
  let finishCalls = 0;
  let actions = 0;
  const tools = [
    defineTool({ name: 'browser_step', label: 'step', description: 'step', parameters: Type.Object({}), execute: async () => { actions++; return { content: [{ type: 'text', text: 'observed page' }], details: {} }; } }),
    defineTool({ name: 'browser_finish', label: 'finish', description: 'finish', parameters: Type.Object({ completed: Type.Boolean() }), execute: async (_id, args) => {
      finishCalls++;
      if (failFirstFinish && finishCalls === 1) throw Error('Failed finish must not be accepted');
      reported = args;
      return { content: [{ type: 'text', text: 'recorded' }], details: {} };
    } }),
  ];
  const session = await createBrowserTaskSession({ services, sessionManager: SessionManager.inMemory(cwd), model, tools: tools.map(t => t.name), customTools: tools }, () => reported !== undefined);
  t.after(async () => { session.dispose(); await rm(cwd, { recursive: true, force: true }); });
  let requests = 0;
  session.agent.streamFunction = () => {
    requests++;
    assert.ok(!reported, 'must not request another model response after recording the finish result');
    const stream = createAssistantMessageEventStream();
    const message = { role: 'assistant', api: model.api, provider: model.provider, model: model.id, timestamp: Date.now(), stopReason: 'toolUse', usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, content: [{ type: 'toolCall', id: `call-${requests}`, name: requests === 1 ? 'browser_step' : 'browser_finish', arguments: requests === 1 ? {} : { completed } }] };
    stream.push({ type: 'done', reason: 'toolUse', message });
    return stream;
  };
  return { session, result: () => ({ reported, requests, finishCalls, actions }) };
}

for (const completed of [true, false]) test(`recorded completion=${completed} ends after two model requests, without cancellation`, async t => {
  const f = await fixture(t, completed);
  await f.session.prompt('Run the task');
  assert.deepEqual(f.result(), { reported: { completed }, requests: 2, finishCalls: 1, actions: 1 });
  assert.equal(f.session.isStreaming, false);
  assert.equal(f.session.messages.some(m => m.stopReason === 'aborted'), false);
});

test('an unsuccessful finish tool does not prematurely stop the model loop', async t => {
  const f = await fixture(t, true, true);
  await f.session.prompt('Run the task');
  assert.deepEqual(f.result(), { reported: { completed: true }, requests: 3, finishCalls: 2, actions: 1 });
});

test('user cancellation before a result still aborts and never reports success', async t => {
  const f = await fixture(t, true);
  f.session.agent.streamFunction = (_model, _context, options) => {
    const stream = createAssistantMessageEventStream();
    options.signal.addEventListener('abort', () => {
      const message = { role: 'assistant', content: [], stopReason: 'aborted', errorMessage: 'aborted', timestamp: Date.now() };
      stream.push({ type: 'error', reason: 'aborted', error: message });
    }, { once: true });
    queueMicrotask(() => { void f.session.abort(); });
    return stream;
  };
  await f.session.prompt('Run the task');
  assert.equal(f.result().reported, undefined);
  assert.equal(f.session.isStreaming, false);
});
