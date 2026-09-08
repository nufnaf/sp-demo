import test from 'node:test';
import assert from 'node:assert/strict';
import { recruitingQuickPrompts } from './desktop-quick-prompts.ts';

test('recruiting cues follow saved progress and current viewing context', () => {
  const initial = { hasJd: false, busy: false, viewingRecruiting: false, publishedJob: null, checkedPublication: true };
  assert.match(recruitingQuickPrompts(initial)[0], /生成.*JD/);
  assert.deepEqual(recruitingQuickPrompts({ ...initial, hasJd: true }), []);
  const published = { ...initial, hasJd: true, publishedJob: 'AI Agent 工程师' };
  assert.deepEqual(recruitingQuickPrompts(published), []);
  assert.match(recruitingQuickPrompts({ ...published, viewingRecruiting: true })[0], /评价没齐/);
  // Restored jobs still take precedence if artifact discovery has not finished.
  assert.match(recruitingQuickPrompts({ ...published, hasJd: false, viewingRecruiting: true })[0], /面试结束/);
  for (const state of [initial, { ...published, viewingRecruiting: true }]) {
    assert.deepEqual(recruitingQuickPrompts({ ...state, busy: true }), []);
    assert.deepEqual(recruitingQuickPrompts({ ...state, checkedPublication: false }), []);
  }
});
