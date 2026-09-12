import test from 'node:test';
import assert from 'node:assert/strict';
import { seedData } from '../apps/recruiting/src/seed.mjs';
import { mutate } from '../apps/recruiting/src/domain.mjs';
import { presentationProjection } from '../apps/recruiting/src/presentation.mjs';
import { recruitingMetrics, filterRecruitingCandidates } from './recruiting-view.ts';
import { renderRecruitingInsightReport, recruitingInsightSummary } from './recruiting-insight-report.ts';
const fields = { draft: 'figma-view-test', title: 'AI Agent 工程师', description: '验证数据一致性', target: '6', location: '杭州 / 上海', department: 'Agent 研发', owner: '陈晓' };
function published() { return mutate(seedData(true), '/jobs/publish', fields); }

test('each cumulative metric selects the same records that the source counted', () => {
  const scene = presentationProjection(published());
  for (const metric of recruitingMetrics(scene)) {
    assert.equal(filterRecruitingCandidates(scene.candidates, metric.filter, '').length, metric.count, metric.label);
  }
  for (const [stage, count] of Object.entries(scene.metrics.current)) {
    assert.equal(filterRecruitingCandidates(scene.candidates, stage, '').length, count);
  }
  assert.equal(filterRecruitingCandidates(scene.candidates, '', ' nf-1001 ').length, 1);
  assert.equal(filterRecruitingCandidates(scene.candidates, '', 'no such person').length, 0);
});

test('insight and recruiting use the same role while separating missing and paired reviews', () => {
  const scene = presentationProjection(published());
  const report = renderRecruitingInsightReport(scene, '2026-09-10T08:00:00Z');
  assert.equal(scene.insight.pairedCount, 9);
  assert.equal(scene.insight.disagreementCount, 3);
  assert.equal(scene.metrics.missing, 3);
  assert.ok(report.includes(recruitingInsightSummary(scene)));
  assert.ok(report.includes(scene.job.title));
  assert.ok(report.includes('面试结束但评价未齐（另计）'));
  assert.ok(report.includes('分析快照'));
  assert.ok(!report.includes('BOSS 直聘'));
  const missing = new Set(filterRecruitingCandidates(scene.candidates, 'missing', '').map(c => c.id));
  for (const c of scene.insight.candidates) {
    assert.ok(!missing.has(c.id));
    assert.ok(report.includes(c.id));
    for (const r of c.interviews) assert.ok(report.includes(r.review.opinion));
  }
});

test('updated review records change both the new report and the corresponding progress metric', () => {
  const data = mutate(published(), '/candidates/NF-1001/review/round-2', { status:'submitted', score:'4', conclusion:'yes', opinion:'完成本轮评价' });
  const scene = presentationProjection(data);
  assert.equal(scene.metrics.missing, 2);
  assert.equal(recruitingMetrics(scene).find(m => m.filter === 'missing').count, 2);
  assert.ok(renderRecruitingInsightReport(scene, '2026-09-10T08:00:00Z').includes('<b>2</b><small>面试结束但评价未齐'));
});

test('report escapes business text without introducing extra executable markup', () => {
  const scene = presentationProjection(published());
  scene.job.title = '<img src=x onerror=alert(1)>';
  const html = renderRecruitingInsightReport(scene, '2026-09-10T08:00:00Z');
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!html.includes('<img src=x'));
});


test('evidence columns stay attached to the named interviewer when records arrive in a different order', () => {
  const scene = presentationProjection(published());
  const original = renderRecruitingInsightReport(scene, '2026-09-10T08:00:00Z');
  for (const candidate of scene.insight.candidates) candidate.interviews.reverse();
  assert.equal(renderRecruitingInsightReport(scene, '2026-09-10T08:00:00Z'), original);
});
