import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url);
const { presentationModelDefaults } = await jiti.import('./presentation-runtime.ts');
const { selectInitialModelScope } = await jiti.import('./model-scope.ts');

test('Luna defaults apply only to owned App workspaces and cannot silently fall back', () => {
  const previous = process.env.SYNTROPIC_PRESENTATION_ROOT;
  process.env.SYNTROPIC_PRESENTATION_ROOT = '/tmp/syntropic-model-test';
  try {
    const defaults = presentationModelDefaults('/tmp/syntropic-model-test/workspace');
    assert.deepEqual(defaults, { provider: 'openai-codex', modelId: 'gpt-5.6-luna', thinkingLevel: 'low' });
    assert.deepEqual(presentationModelDefaults('/tmp/syntropic-model-test/workspaces/research'), defaults);
    assert.equal(presentationModelDefaults('/tmp/ordinary-workspace'), undefined);
    const luna = { provider: 'openai-codex', id: 'gpt-5.6-luna' };
    const old = { provider: 'openai-codex', id: 'gpt-5.4-mini' };
    const scope = { visible: [old, luna], scopedModels: [], thinkingLevelPins: {}, warnings: [] };
    const selected = selectInitialModelScope(scope, { requestedModel: defaults, defaultModel: { provider: old.provider, modelId: old.id }, thinkingLevel: defaults.thinkingLevel });
    assert.equal(selected.model, luna);
    assert.equal(selected.thinkingLevel, 'low');
    assert.throws(() => selectInitialModelScope({ ...scope, visible: [old] }, { requestedModel: defaults }), /not available/);
    delete process.env.SYNTROPIC_PRESENTATION_ROOT;
    assert.equal(presentationModelDefaults('/tmp/syntropic-model-test/workspace'), undefined);
  } finally {
    if (previous === undefined) delete process.env.SYNTROPIC_PRESENTATION_ROOT;
    else process.env.SYNTROPIC_PRESENTATION_ROOT = previous;
  }
});
