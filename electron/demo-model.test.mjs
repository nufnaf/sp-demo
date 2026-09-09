import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJiti } from 'jiti';
import { createAgentSessionServices, createAgentSessionFromServices, SessionManager } from '@earendil-works/pi-coding-agent';
import { prepareDemoModelEnvironment, readDemoApiKey } from './demo-model.mjs';
import { createPresentationRun, cleanPresentationRun } from './presentation.mjs';

const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
const { presentationModelDefaults } = await jiti.import('../lib/presentation-runtime.ts');
const { readDemoModel, DEFAULT_DEMO_MODEL, OPENROUTER_DEMO_MODEL } = await jiti.import('../lib/demo-model.ts');
const { startBrowserTask } = await jiti.import('../lib/browser/tasks.ts');

test('bundled credentials select Luna for fresh App sessions without personal auth, and survive relaunch', async () => {
  const root = await mkdtemp(join(tmpdir(), 'syntropic-openrouter-test-'));
  const configPath = join(root, 'openrouter-demo.json');
  const before = { ...process.env };
  try {
    await writeFile(configPath, JSON.stringify({ apiKey: 'test-only-never-sent' }));
    await writeFile(join(root, 'personal-auth-sentinel'), 'untouched');
    for (let round = 0; round < 2; round++) {
      const run = await createPresentationRun(root);
      const env = await prepareDemoModelEnvironment({ configPath, presentationRoot: run.root });
      Object.assign(process.env, env, { SYNTROPIC_PRESENTATION_ROOT: run.root });
      delete process.env.OPENROUTER_API_KEY;
      assert.doesNotMatch(JSON.stringify(env), /test-only-never-sent/);
      const authPath = join(env.PI_CODING_AGENT_DIR, 'auth.json');
      assert.equal((await stat(authPath)).mode & 0o777, 0o600);
      assert.deepEqual(Object.keys(JSON.parse(await readFile(authPath, 'utf8'))), ['openrouter']);
      assert.deepEqual(readDemoModel(), OPENROUTER_DEMO_MODEL);
      for (const cwd of [join(run.root, 'workspace'), join(run.root, 'workspaces/product-release')]) {
        assert.deepEqual(presentationModelDefaults(cwd), OPENROUTER_DEMO_MODEL);
        const services = await createAgentSessionServices({ cwd, agentDir: env.PI_CODING_AGENT_DIR,
          resourceLoaderOptions: { noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true },
        });
        assert.equal(services.modelRuntime.hasConfiguredAuth('openai-codex'), false);
        const model = services.modelRuntime.getModel('openrouter', 'openai/gpt-5.6-luna');
        assert.ok(model);
        assert.equal((await services.modelRuntime.getAuth(model)).auth.apiKey, 'test-only-never-sent');
        const { session } = await createAgentSessionFromServices({ services, sessionManager: SessionManager.inMemory(cwd), tools: [] });
        assert.equal(session.model.provider, 'openrouter');
        assert.equal(session.model.id, 'openai/gpt-5.6-luna');
        assert.equal(session.thinkingLevel, 'low');
        session.dispose();
      }
      // Stop before sending a request: only validate the browser runner's captured selection.
      const controller = new AbortController(); controller.abort();
      const task = startBrowserTask({ cwd: join(run.root, 'workspace'), parentSessionId: `test-${round}`, task: 'test', url: 'http://127.0.0.1:30142/' }, controller.signal);
      await task.completion;
      assert.equal(task.state.provider, 'openrouter');
      assert.equal(task.state.modelId, 'openai/gpt-5.6-luna');
      await cleanPresentationRun(run);
      await assert.rejects(stat(authPath), { code: 'ENOENT' });
      assert.equal(await readDemoApiKey(configPath), 'test-only-never-sent', 'bundle remains available for relaunch');
    }
    assert.equal(await readFile(join(root, 'personal-auth-sentinel'), 'utf8'), 'untouched');
    delete process.env.SYNTROPIC_DEMO_OPENROUTER;
    assert.deepEqual(readDemoModel(), DEFAULT_DEMO_MODEL, 'legacy OAuth remains the default outside the preconfigured package');
    assert.equal(presentationModelDefaults('/ordinary-web'), undefined);
  } finally {
    for (const key of ['PI_CODING_AGENT_DIR', 'SYNTROPIC_PRESENTATION_ROOT', 'SYNTROPIC_DEMO_OPENROUTER', 'OPENROUTER_API_KEY']) {
      if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key];
    }
    await rm(root, { recursive: true, force: true });
  }
});

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
  } finally { await rm(root, { recursive: true, force: true }); }
});
