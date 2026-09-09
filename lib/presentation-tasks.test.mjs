import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = await readFile(new URL('./presentation-tasks.ts', import.meta.url), 'utf8');
const compiled = ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
function harness(action, { browserStatus = 'completed', verificationFails = false, abortAfterBrowser = false, alreadyPublished = false } = {}) {
  const calls = [], saved = [], controller = new AbortController();
  const cwd = '/run/workspace';
  let reads = 0, draft;
  const job = () => ({ id: 'job-1', draft, title: 'AI Agent 工程师', location: '北京', headcount: 6 });
  const testModule = { exports: {} };
  const mocks = {
    '@earendil-works/pi-coding-agent': { SessionManager: { create: () => ({ getSessionId: () => 'task', appendCustomEntry() {}, appendSessionInfo() {}, appendMessage() {} }) } },
    './presentation-runtime': { presentationCwd: () => cwd, presentationRoot: () => '/run', presentationSessionDir: () => '/run/sessions' },
    './jarvis': { JARVIS_TASK_ORIGIN_TYPE: 'task' },
    './recruiting-jd-demo': { demoAssistant: text => ({ text }) },
    './browser/business-sites': { recruitingSiteUrl: () => new URL('https://example.com') },
    './browser/recruiting-publication': { recruitingPublicationTask: async () => 'publish through form' },
    './recruiting-snapshot': { readRecruitingSnapshot: async () => {
      calls.push('read'); reads++;
      if (reads > 1 && verificationFails) throw new Error('verification unavailable');
      return { jobs: reads === 1 && action === 'publish-jd' && !alreadyPublished ? [] : [job()], scene: { revision: reads } };
    } },
    './presentation-progress': { saveRecruitingProgress: async (data, key, root) => { calls.push('save'); saved.push({ data, key, root }); } },
    './browser/tasks': { startBrowserTask: () => { calls.push('browser'); if (abortAfterBrowser) controller.abort(); return { completion: Promise.resolve({ status: browserStatus, result: 'verified on page' }) }; } },
  };
  vm.runInNewContext(compiled, { module: testModule, exports: testModule.exports, URL, Date, require: id => id.startsWith('node:') ? require(id) : mocks[id] });
  draft = testModule.exports.publicationDraft(cwd);
  return { calls, saved, draft, run: () => testModule.exports.createPresentationTask(cwd, 'parent', '用户任务', action).run(controller.signal) };
}

test('publication and query save only after browser success and a fresh website verification', async () => {
  for (const action of ['publish-jd', 'query-recruiting']) {
    const h = harness(action); assert.equal((await h.run()).status, 'completed');
    assert.deepEqual(h.calls, ['read', 'browser', 'read', 'save']);
    assert.equal(h.saved[0].data.scene.revision, 2);
    assert.equal(h.saved[0].key, h.draft); assert.equal(h.saved[0].root, '/run');
  }
});
test('browser failure, cancellation or failed final verification never saves success locally', async () => {
  for (const options of [{ browserStatus: 'failed' }, { browserStatus: 'stopped' }, { verificationFails: true }, { abortAfterBrowser: true }]) {
    const h = harness('publish-jd', options);
    assert.notEqual((await h.run()).status, 'completed'); assert.equal(h.saved.length, 0);
  }
});
test('verified already-published job is recovered without submitting the form again', async () => {
  const h = harness('publish-jd', { alreadyPublished: true });
  assert.equal((await h.run()).status, 'completed'); assert.deepEqual(h.calls, ['read', 'save']);
});
