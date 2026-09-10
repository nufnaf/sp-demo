import test from 'node:test';
import assert from 'node:assert/strict';
import { recruitingQuickPrompts } from './desktop-quick-prompts.ts';

test('recruiting cues follow saved progress and current viewing context', () => {
  const initial = { hasJd: false, jdRequested: false, progressReady: true, busy: false, viewingRecruiting: false, publishedJob: null, checkedPublication: true };
  assert.match(recruitingQuickPrompts(initial)[0], /生成.*JD/);
  assert.deepEqual(recruitingQuickPrompts({ ...initial, hasJd: true }), []);
  assert.deepEqual(recruitingQuickPrompts({ ...initial, jdRequested: true }), []);
  const published = { ...initial, hasJd: true, publishedJob: 'AI Agent 工程师' };
  assert.deepEqual(recruitingQuickPrompts(published), []);
  assert.match(recruitingQuickPrompts({ ...published, viewingRecruiting: true })[0], /评价没齐/);
  // Restored jobs still take precedence if artifact discovery has not finished.
  assert.match(recruitingQuickPrompts({ ...published, hasJd: false, viewingRecruiting: true })[0], /面试结束/);
  assert.deepEqual(recruitingQuickPrompts({ ...initial, progressReady: false }), []);
  assert.match(recruitingQuickPrompts({ ...initial, checkedPublication: false })[0], /生成.*JD/);
  assert.match(recruitingQuickPrompts({ ...initial, busy: true })[0], /生成.*JD/);
  assert.deepEqual(recruitingQuickPrompts({ ...published, viewingRecruiting: true, busy: true }), []);
  assert.deepEqual(recruitingQuickPrompts({ ...published, viewingRecruiting: true, checkedPublication: false }), []);
});
