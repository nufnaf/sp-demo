import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJiti } from 'jiti';
import { streamSimple } from '@earendil-works/pi-ai/api/openai-completions';
import { createAgentSessionServices, createAgentSessionFromServices, SessionManager } from '@earendil-works/pi-coding-agent';
import { prepareDemoModelEnvironment, readDemoApiKey, readDemoModelConfig } from './demo-model.mjs';
import { createPresentationRun, cleanPresentationRun } from './presentation.mjs';

const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
const { presentationModelDefaults } = await jiti.import('../lib/presentation-runtime.ts');
const { readDemoModel, DEFAULT_DEMO_MODEL, OPENROUTER_DEMO_MODEL } = await jiti.import('../lib/demo-model.ts');
const { startBrowserTask } = await jiti.import('../lib/browser/tasks.ts');

for (const provider of ['openrouter', 'deepseek']) test(`${provider} bundled credentials initialize actual SDK sessions and survive relaunch`, async () => {
  const expected = provider === 'deepseek'
    ? { provider: 'deepseek', modelId: 'deepseek-flash', thinkingLevel: 'low' } : OPENROUTER_DEMO_MODEL;
  const root = await mkdtemp(join(tmpdir(), 'syntropic-openrouter-test-'));
  const configPath = join(root, 'openrouter-demo.json');
  const before = { ...process.env };
  try {
    await writeFile(configPath, JSON.stringify({ apiKey: 'test-only-never-sent' }));
    await writeFile(join(root, 'personal-auth-sentinel'), 'untouched');
    for (let round = 0; round < 2; round++) {
      const run = await createPresentationRun(root);
      const env = await prepareDemoModelEnvironment({ configPath, presentationRoot: run.root, provider });
      Object.assign(process.env, env, { SYNTROPIC_PRESENTATION_ROOT: run.root });
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.DEEPSEEK_API_KEY;
      assert.doesNotMatch(JSON.stringify(env), /test-only-never-sent/);
      const authPath = join(env.PI_CODING_AGENT_DIR, 'auth.json');
      assert.equal((await stat(authPath)).mode & 0o777, 0o600);
      assert.deepEqual(Object.keys(JSON.parse(await readFile(authPath, 'utf8'))), [provider]);
      assert.deepEqual(readDemoModel(), expected);
      for (const cwd of [join(run.root, 'workspace'), join(run.root, 'workspaces/product-release')]) {
        assert.deepEqual(presentationModelDefaults(cwd), expected);
        const services = await createAgentSessionServices({ cwd, agentDir: env.PI_CODING_AGENT_DIR,
          resourceLoaderOptions: { noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true },
        });
        assert.equal(services.modelRuntime.hasConfiguredAuth('openai-codex'), false);
        const model = services.modelRuntime.getModel(expected.provider, expected.modelId);
        assert.ok(model);
        if (provider === 'deepseek' && round === 0) await verifyDeepSeekToolTransport(model);
        assert.equal((await services.modelRuntime.getAuth(model)).auth.apiKey, 'test-only-never-sent');
        const { session } = await createAgentSessionFromServices({ services, sessionManager: SessionManager.inMemory(cwd), tools: [] });
        assert.equal(session.model.provider, expected.provider);
        assert.equal(session.model.id, expected.modelId);
        assert.equal(session.thinkingLevel, 'low');
        session.dispose();
      }
      // Stop before sending a request: only validate the browser runner's captured selection.
      const controller = new AbortController(); controller.abort();
      const task = startBrowserTask({ cwd: join(run.root, 'workspace'), parentSessionId: `test-${round}`, task: 'test', url: 'http://127.0.0.1:30142/' }, controller.signal);
      await task.completion;
      assert.equal(task.state.provider, expected.provider);
      assert.equal(task.state.modelId, expected.modelId);
      await cleanPresentationRun(run);
      await assert.rejects(stat(authPath), { code: 'ENOENT' });
      assert.equal(await readDemoApiKey(configPath), 'test-only-never-sent', 'bundle remains available for relaunch');
    }
    assert.equal(await readFile(join(root, 'personal-auth-sentinel'), 'utf8'), 'untouched');
    delete process.env.SYNTROPIC_DEMO_OPENROUTER;
    delete process.env.SYNTROPIC_DEMO_DEEPSEEK_MODEL;
    assert.deepEqual(readDemoModel(), DEFAULT_DEMO_MODEL, 'legacy OAuth remains the default outside the preconfigured package');
    assert.equal(presentationModelDefaults('/ordinary-web'), undefined);
  } finally {
    for (const key of ['PI_CODING_AGENT_DIR', 'SYNTROPIC_PRESENTATION_ROOT', 'SYNTROPIC_DEMO_OPENROUTER', 'SYNTROPIC_DEMO_DEEPSEEK_MODEL', 'DEEPSEEK_API_KEY', 'OPENROUTER_API_KEY']) {
      if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key];
    }
    await rm(root, { recursive: true, force: true });
  }
});

// Exercise the real SDK serializer/parser. No network or real credential is used.
async function verifyDeepSeekToolTransport(model) {
  const bodies = [];
  const fetch = async (url, options) => {
    assert.equal(String(url), 'https://api.deepseek.com/chat/completions');
    bodies.push(JSON.parse(options.body));
    const first = bodies.length === 1;
    const chunk = { id: 'test', object: 'chat.completion.chunk', created: 1, model: model.id,
      choices: [{ index: 0, delta: first
        ? { role: 'assistant', reasoning_content: 'Verify the page.', tool_calls: [{ index: 0, id: 'call_test', type: 'function', function: { name: 'browser_read', arguments: '{}' } }] }
        : { role: 'assistant', content: '已核对。' }, finish_reason: first ? 'tool_calls' : 'stop' }],
    };
    return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`, { headers: { 'content-type': 'text/event-stream' } });
  };
  const context = { systemPrompt: 'Verify the page.', messages: [{ role: 'user', content: '请核对网页', timestamp: 1 }],
    tools: [{ name: 'browser_read', description: 'Read page', parameters: { type: 'object', properties: {} } }],
  };
  const options = { apiKey: 'test-only-never-sent', fetch, reasoning: 'low', maxTokens: 512 };
  const first = await streamSimple(model, context, options).result();
  assert.equal(first.stopReason, 'toolUse');
  assert.equal(first.content.find(block => block.type === 'toolCall')?.name, 'browser_read');
  context.messages.push(first, { role: 'toolResult', toolCallId: 'call_test', toolName: 'browser_read', content: [{ type: 'text', text: '发布成功' }], isError: false, timestamp: 2 });
  const second = await streamSimple(model, context, options).result();
  assert.equal(second.stopReason, 'stop');
  for (const body of bodies) {
    assert.equal(body.model, 'deepseek-flash');
    assert.deepEqual(body.thinking, { type: 'enabled' });
    assert.equal(body.reasoning_effort, 'low');
    assert.equal(body.max_tokens, 512);
  }
  assert.equal(bodies[1].messages.find(message => message.role === 'assistant').reasoning_content, 'Verify the page.');
}

test('missing or invalid bundled key fails before initializing auth and never echoes contents', async () => {
  const root = await mkdtemp(join(tmpdir(), 'syntropic-key-invalid-'));
  try {
    const configPath = join(root, 'config.json');
    for (const value of [null, '{secret-sentinel', JSON.stringify({ apiKey: 'secret sentinel' }), '{}']) {
      if (value !== null) await writeFile(configPath, value);
      await assert.rejects(prepareDemoModelEnvironment({ configPath, presentationRoot: root }), error => {
        assert.doesNotMatch(error.message, /secret/); return true;
      });
      await assert.rejects(stat(join(root, 'model-agent')), { code: 'ENOENT' });
    }
    await writeFile(configPath, JSON.stringify({ apiKey: 'test-only-never-sent', modelId: 'invalid model secret' }));
    await assert.rejects(readDemoModelConfig(configPath, 'deepseek'), error => {
      assert.doesNotMatch(error.message, /secret|test-only/); return true;
    });
  } finally { await rm(root, { recursive: true, force: true }); }
});
