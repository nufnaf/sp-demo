import test from 'node:test';
import assert from 'node:assert/strict';
import { seedData } from '../src/seed.mjs';
import { mutate } from '../src/domain.mjs';
import { presentationProjection } from '../src/presentation.mjs';
const fields = { draft: 'test-draft-publish', title: 'AI Agent 工程师', description: '本轮实际生成的完整 JD', target: '6', location: '杭州 / 上海', department: 'Agent 研发', owner: '陈晓' };
test('presentation starts without the target published; only actual form publication attaches its seeded progress once', () => {
  const initial = seedData(true); assert.equal(presentationProjection(initial).job, null); assert.equal(initial.jobs.some(j => j.id === 'ai-agent'), false);
  const published = mutate(initial, '/jobs/publish', fields);
  const scene = presentationProjection(published);
  assert.equal(scene.job.description, fields.description); assert.equal(scene.candidates.length, 30);
  assert.ok(scene.candidates.every(c => c.jobId === scene.job.id));
  assert.deepEqual([scene.metrics.applied, scene.metrics.screened, scene.metrics.interviewing, scene.metrics.finished, scene.metrics.missing], [30, 24, 18, 12, 3]);
  assert.deepEqual(scene.candidates.filter(c => c.interviewsFinished && c.missingReviews).map(c => c.id), ['NF-1001','NF-1002','NF-1003']);
  assert.equal(Object.values(scene.metrics.current).reduce((a,b) => a+b,0), 30);
  assert.equal(scene.insight.pairedCount, 9); assert.equal(scene.insight.disagreementCount, 3);
  assert.deepEqual(mutate(published, '/jobs/publish', fields), published);
  assert.equal(presentationProjection(seedData(true)).job, null);
});
test('changes to interview records change website/native query and insight from the same records', () => {
  let data = mutate(seedData(true), '/jobs/publish', fields);
  data = mutate(data, '/candidates/NF-1001/review/round-2', { status: 'submitted', score: '4', conclusion: 'yes', opinion: '评价完成' });
  assert.equal(presentationProjection(data).metrics.missing, 2);
  data = mutate(data, '/candidates/NF-1004/review/round-1', { status: 'submitted', score: '4', conclusion: 'yes', opinion: '已对齐证据' });
  assert.equal(presentationProjection(data).insight.disagreementCount, 2);
});
test('standalone seed and ordinary publication retain their persistence/data behavior', () => {
  const initial = seedData(false); assert.equal(presentationProjection(initial), null);
  const next = mutate(initial, '/jobs/publish', fields); assert.equal(next.applications.length, initial.applications.length);
  assert.equal(next.applications.some(a => a.jobId === next.jobs[0].id), false);
});
