import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createJiti } from 'jiti';
import { seedData } from '../apps/recruiting/src/seed.mjs';
import { mutate } from '../apps/recruiting/src/domain.mjs';
import { presentationProjection } from '../apps/recruiting/src/presentation.mjs';

const directory = await mkdtemp(join(tmpdir(), 'syntropic-progress-test-'));
const previousRoot = process.env.SYNTROPIC_PRESENTATION_ROOT;
process.env.SYNTROPIC_PRESENTATION_ROOT = directory;
const jiti = createJiti(import.meta.url, { alias: { '@': resolve('.') } });
const { readProgress, saveRecruitingProgress, advancePresentation } = await jiti.import('./presentation-progress.ts');
const { subscribeToFileEvents } = await jiti.import('./files-app/events.ts');
const { GET } = await jiti.import('../app/api/apps/internal-recruiting/route.ts');
const fields = { draft: 'current-run', title: 'AI Agent 工程师', description: '本轮 JD', target: '6', location: '北京 / 上海', department: 'Agent 研发', owner: '陈晓' };
let published = mutate(seedData(true), '/jobs/publish', fields);
function snapshot(data = published) {
  const scene = presentationProjection(data);
  return { scene, jobs: [{ ...scene.job, draft: fields.draft, headcount: 6, candidateCount: scene.candidates.length, url: 'https://example.com/jobs/current' }] };
}

test('local run snapshot, calendar and read endpoint work without any website requests', async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error('website offline'); };
  const events = [];
  const unsubscribe = subscribeToFileEvents(event => events.push(event));
  try {
    assert.deepEqual(await readProgress(), {});
    assert.deepEqual((await (await GET()).json()).jobs, []);
    await assert.rejects(advancePresentation('meeting'), /先通过网页/);
    await saveRecruitingProgress(snapshot(), fields.draft);
    assert.equal((await (await GET()).json()).scene.metrics.missing, 3);
    assert.equal((await readProgress()).insight, undefined, 'publication waits for the recruiting page to trigger the insight');
    await assert.rejects(advancePresentation('meeting'), /先查看招聘洞察/);
    await saveRecruitingProgress(snapshot(), fields.draft);
    assert.equal((await readProgress()).insight, undefined, 'query alone does not trigger the insight');
    await advancePresentation('insight');
    const triggered = await readProgress();
    assert.ok(triggered.insight);
    await advancePresentation('insight');
    assert.deepEqual((await readProgress()).insight, triggered.insight, 'reopening the recruiting page does not create a second insight');
    // A query result and calendar action arriving together must merge, not overwrite.
    published = mutate(published, '/candidates/NF-1001/review/round-2', { status: 'submitted', score: '4', conclusion: 'yes', opinion: '评价完成' });
    await Promise.all([advancePresentation('meeting'), saveRecruitingProgress(snapshot(), fields.draft)]);
    const saved = await readProgress();
    assert.equal(saved.recruiting.scene.metrics.missing, 2);
    assert.ok(saved.meeting.title.includes(fields.title));
    assert.ok(saved.insight.filePath.startsWith(directory));
    assert.deepEqual(await advancePresentation('meeting'), saved, 'meeting is idempotent');
    assert.equal(JSON.parse(await readFile(join(directory, 'progress.json'), 'utf8')).meeting.id, saved.meeting.id);
    assert.equal(requests, 0);
    assert.ok(events.some(event => event.type === 'presentation.updated'));

    const nextRun = join(directory, 'next-run'); await mkdir(nextRun);
    process.env.SYNTROPIC_PRESENTATION_ROOT = nextRun;
    assert.deepEqual(await readProgress(), {});
    assert.equal((await (await GET()).json()).scene, null);
    process.env.SYNTROPIC_PRESENTATION_ROOT = directory;
    assert.deepEqual(await readProgress(), saved, 'same-run reload preserves the verified result');

    await assert.rejects(saveRecruitingProgress(snapshot(), 'other-draft'), /未找到本轮/);
    const mismatched = snapshot(); mismatched.scene.job.id = 'other-job';
    // The job and scene are separate records in the projection.
    mismatched.jobs[0].id = 'current-job';
    await assert.rejects(saveRecruitingProgress(mismatched, fields.draft), /不一致/);
    assert.deepEqual(await readProgress(), saved, 'rejected verification never replaces the previous result');
  } finally {
    unsubscribe(); globalThis.fetch = originalFetch;
    if (previousRoot === undefined) delete process.env.SYNTROPIC_PRESENTATION_ROOT;
    else process.env.SYNTROPIC_PRESENTATION_ROOT = previousRoot;
    await rm(directory, { recursive: true, force: true });
  }
});
