import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url);
const { recruitingBrowserContext } = await jiti.import('./business-sites.ts');
const { BROWSER_MODEL } = await jiti.import('./tasks.ts');
const { createBrowserExtension } = await jiti.import('./extension.ts');
const { buildSystemPrompt } = await import('../../node_modules/@earendil-works/pi-coding-agent/dist/core/system-prompt.js');

test('registered business context supplies an entry point and purpose, never a canned answer or model override', () => {
  const before = process.env.SYNTROPIC_RECRUITING_URL;
  try {
    delete process.env.SYNTROPIC_RECRUITING_URL;
    const context = recruitingBrowserContext();
    assert.match(context, /http:\/\/127.0.0.1:30143/);
    assert.match(context, /用途：.*招聘职位/);
    assert.doesNotMatch(context, /林然|许宁|苏悦|NF-1001/);
    assert.deepEqual(BROWSER_MODEL, { provider: 'openai-codex', modelId: 'gpt-5.6-luna', thinkingLevel: 'low' });
    process.env.SYNTROPIC_RECRUITING_URL = 'https://recruiting.example.test';
    assert.match(recruitingBrowserContext(), /https:\/\/recruiting.example.test/);
    process.env.SYNTROPIC_RECRUITING_URL = 'https://user:password@recruiting.example.test';
    assert.throws(recruitingBrowserContext, /不含凭据/);
  } finally {
    if (before === undefined) delete process.env.SYNTROPIC_RECRUITING_URL;
    else process.env.SYNTROPIC_RECRUITING_URL = before;
  }
});

test('business context occurs once in the assembled system prompt and not in tool descriptions', () => {
  const definitions = [];
  createBrowserExtension(true).factory({ registerTool: (tool) => definitions.push(tool) });
  const context = recruitingBrowserContext();
  const prompt = buildSystemPrompt({
    cwd: process.cwd(),
    selectedTools: definitions.map((tool) => tool.name),
    promptGuidelines: definitions.flatMap((tool) => tool.promptGuidelines ?? []),
  });
  assert.equal(prompt.split(context).length - 1, 1);
  assert.ok(definitions.every((tool) => !tool.description.includes(context)));
});
