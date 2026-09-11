import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJiti } from 'jiti';
const { computerRuntime } = await createJiti(import.meta.url).import('./runtime.ts');

test('native worker inherits the same demo model as the browser, with explicit CU overrides preserved', async t => {
  if (process.platform !== 'darwin') return t.skip('native runtime is macOS-only');
  const root = await mkdtemp(join(tmpdir(), 'computer-model-'));
  const keys = ['SYNTROPIC_APP_ROOT', 'SYNTROPIC_COMPUTER_USE', 'SYNTROPIC_PRESENTATION_ROOT',
    'SYNTROPIC_DEMO_DEEPSEEK_MODEL', 'SYNTROPIC_DEMO_OPENROUTER',
    'SYNTROPIC_COMPUTER_PROVIDER', 'SYNTROPIC_COMPUTER_MODEL', 'SYNTROPIC_COMPUTER_THINKING'];
  const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  await mkdir(join(root, 'electron/computer-use'), { recursive: true });
  // Exercise the real fork boundary without starting the native driver or a model.
  await writeFile(join(root, 'electron/computer-use/worker.mjs'), `process.on('message', message => {
    if (message.type !== 'view') return;
    if (!message.enabled) return process.exit();
    process.send({ type:'status', patch:{ detail:JSON.stringify({
      provider:process.env.SYNTROPIC_COMPUTER_PROVIDER,
      modelId:process.env.SYNTROPIC_COMPUTER_MODEL,
      thinkingLevel:process.env.SYNTROPIC_COMPUTER_THINKING
    }) } });
  });`);
  t.after(async () => {
    for (const key of keys) if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key];
    await rm(root, { recursive: true, force: true });
  });
  for (const [config, expected] of [
    [{ SYNTROPIC_DEMO_DEEPSEEK_MODEL:'deepseek-flash' }, { provider:'deepseek', modelId:'deepseek-flash', thinkingLevel:'low' }],
    [{ SYNTROPIC_DEMO_OPENROUTER:'1' }, { provider:'openrouter', modelId:'openai/gpt-5.6-luna', thinkingLevel:'low' }],
    [{}, { provider:'openai-codex', modelId:'gpt-5.6-luna', thinkingLevel:'low' }],
    [{ SYNTROPIC_DEMO_DEEPSEEK_MODEL:'deepseek-flash', SYNTROPIC_COMPUTER_PROVIDER:'openai-codex', SYNTROPIC_COMPUTER_MODEL:'gpt-5.6-luna', SYNTROPIC_COMPUTER_THINKING:'medium' },
      { provider:'openai-codex', modelId:'gpt-5.6-luna', thinkingLevel:'medium' }],
  ]) {
    for (const key of keys) delete process.env[key];
    Object.assign(process.env, { SYNTROPIC_APP_ROOT:root, SYNTROPIC_COMPUTER_USE:'1', SYNTROPIC_PRESENTATION_ROOT:root, ...config });
    const runtime = new (computerRuntime().constructor)();
    let unstatus = () => {}, unframes = () => {};
    try {
      const selected = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(Error('worker model selection timeout')), 5000);
        unstatus = runtime.subscribeStatus(state => {
          if (state.detail.startsWith('{')) { clearTimeout(timeout); resolve(JSON.parse(state.detail)); }
        });
      });
      unframes = runtime.subscribeFrames(() => {});
      assert.deepEqual(await selected, expected);
    } finally { unstatus(); unframes(); }
  }
});
