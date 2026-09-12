import { connectFixture } from './test-fixtures/feishu.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createJiti } from 'jiti';
import { seedData } from '../apps/recruiting/src/seed.mjs';
import { mutate } from '../apps/recruiting/src/domain.mjs';
import { presentationProjection } from '../apps/recruiting/src/presentation.mjs';

const directory = await mkdtemp(join(tmpdir(), 'syntropic-progress-test-'));
const disconnect = await connectFixture(directory,{appId:'test-app',folderToken:'folder',documentIds:['doc'],calendarId:'calendar'});
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

test('local recruiting snapshots merge with Feishu meetings without rereading the website', async () => {
  const originalFetch = globalThis.fetch;
  let websiteRequests = 0, calendarWrites = 0;
  const event = { event_id:'event_0', summary: '面试标准对齐-syntropic', start_time:{timestamp:'1789106400'}, end_time:{timestamp:'1789108200'}, status:'confirmed' };
  globalThis.fetch = async (url, init) => {
    const path = String(url);
    if (path.includes('/auth/v3/tenant_access_token/internal')) return Response.json({code:0,tenant_access_token:'fixture-token',expire:7200});
    if (path.includes('/calendar/v4/calendars/calendar/events')) {
      if (init?.method === 'POST') calendarWrites++;
      return Response.json({code:0,data:{event}});
    }
    websiteRequests++; throw new Error('website offline');
  };
  const events = [];
  const unsubscribe = subscribeToFileEvents(event => events.push(event));
  try {
    assert.deepEqual(await readProgress(), {});
    assert.deepEqual((await (await GET()).json()).jobs, []);
    await assert.rejects(advancePresentation('meeting'), /先通过网页/);
    await assert.rejects(saveRecruitingProgress({ jobs: [], scene: null }, fields.draft), /未找到当前工作台/);
    assert.deepEqual(await readProgress(), {}, 'missing website job cannot create a BOSS receipt');
    await saveRecruitingProgress(snapshot(), fields.draft, directory, { sessionId: 'query-1', question: '多少人面试结束？', summary: '12 人结束，3 人评价未齐。' });
    const querySnapshot = (await readProgress()).queries['query-1'];
    assert.equal(querySnapshot.metrics.finished, 12);
    assert.equal(querySnapshot.metrics.missing, 3);
    assert.equal(querySnapshot.missingCandidates.length, 3);
    const receipt = (await (await GET()).json()).jobs[0].bossPublication;
    assert.deepEqual(receipt, { mode: 'demo', status: 'published', publishedAt: snapshot().jobs[0].publishedAt });
    assert.equal(snapshot().jobs[0].bossPublication, undefined, 'mock result never mutates website data');
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
    assert.deepEqual(saved.queries['query-1'], querySnapshot, 'later synchronization does not replace a previous query snapshot');
    assert.equal(saved.recruiting.jobs.length, 1, 'retries and queries do not duplicate the BOSS job');
    assert.deepEqual(saved.recruiting.jobs[0].bossPublication, receipt);
 assert.equal(saved.meeting.title, '面试标准对齐-syntropic');
    assert.ok(saved.insight.filePath.startsWith(directory));
    assert.deepEqual(JSON.parse(JSON.stringify(await advancePresentation('meeting'))), saved, 'meeting is idempotent');
    assert.equal(JSON.parse(await readFile(join(directory, 'progress.json'), 'utf8')).meeting.id, saved.meeting.id);
    assert.equal(websiteRequests, 0);
    assert.equal(calendarWrites, 1);
    assert.equal(saved.meeting.source, "feishu");
    assert.ok(events.some(event => event.type === 'presentation.updated'));

    const nextRun = join(directory, 'next-run'); await mkdir(nextRun);
    process.env.SYNTROPIC_PRESENTATION_ROOT = nextRun;
    assert.deepEqual(await readProgress(), {});
    assert.equal((await (await GET()).json()).scene, null);
    process.env.SYNTROPIC_PRESENTATION_ROOT = directory;
    assert.deepEqual(await readProgress(), saved, 'same-run reload preserves the verified result');

    await assert.rejects(saveRecruitingProgress(snapshot(), 'other-draft'), /未找到当前工作台/);
    const mismatched = snapshot(); mismatched.scene.job.id = 'other-job';
    // The job and scene are separate records in the projection.
    mismatched.jobs[0].id = 'current-job';
    await assert.rejects(saveRecruitingProgress(mismatched, fields.draft), /不一致/);
    assert.deepEqual(await readProgress(), saved, 'rejected verification never replaces the previous result');
  } finally {
    unsubscribe(); globalThis.fetch = originalFetch; await disconnect();
    if (previousRoot === undefined) delete process.env.SYNTROPIC_PRESENTATION_ROOT;
    else process.env.SYNTROPIC_PRESENTATION_ROOT = previousRoot;
    await rm(directory, { recursive: true, force: true });
  }
});
