import test from 'node:test';
import assert from 'node:assert/strict';
import { jdInsightReadyAt } from './recruiting-jd-timing.ts';

test('visible JD waits for playback, while closed, unopened and restored documents retain a deadline', () => {
  const writtenAt = 10000;
  assert.equal(jdInsightReadyAt(writtenAt, { active: true }), null);
  assert.equal(jdInsightReadyAt(writtenAt, { active: false }), 30000);
  assert.equal(jdInsightReadyAt(writtenAt, { active: true, completedAt: 40000 }), 42000);
  assert.equal(jdInsightReadyAt(writtenAt, { active: false, completedAt: 40000 }), 42000);
  assert.equal(jdInsightReadyAt(NaN, { active: false }), null);
});
