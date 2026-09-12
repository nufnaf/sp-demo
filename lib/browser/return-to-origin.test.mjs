import assert from 'node:assert/strict';
import test from 'node:test';
import { createJiti } from 'jiti';
const { captureBrowserOrigin, isBrowserOriginCurrent, browserReturnDestination } = await createJiti(import.meta.url).import('./return-to-origin.ts');
const context = { cwd: '/workspace', publicationSessionId: 'publication', taskSessionId: null, browserOpen: true, frontWindow: 'browser' };
const page = { pageId: 'page', cwd: context.cwd, taskSessionId: 'publication', controller: 'agent' };
const finished = { pageId: page.pageId, cwd: page.cwd, parentSessionId: 'publication', status: 'completed' };

test('publication can return to recruiting without opening a task chat window', () => {
  const origin = captureBrowserOrigin(page, context);
  for (const status of ['completed', 'failed']) assert.equal(browserReturnDestination(origin, { ...finished, status }, context), 'recruiting');
});
test('a task-window origin returns to that task rather than the desktop main conversation', () => {
  const taskContext = { ...context, taskSessionId: 'task' };
  const origin = captureBrowserOrigin({ ...page, taskSessionId: 'task' }, taskContext);
  assert.equal(browserReturnDestination(origin, { ...finished, parentSessionId: 'task' }, taskContext), 'tasks');
});
test('main-agent browser work never requests opening its conversation', () => {
  assert.equal(captureBrowserOrigin({ ...page, taskSessionId: 'main' }, context), null);
});
test('manual pages and unknown or other-workspace origins are never followed back', () => {
  for (const patch of [{ controller: 'shared' }, { taskSessionId: null }, { taskSessionId: 'other' }, { cwd: '/other' }]) {
    assert.equal(captureBrowserOrigin({ ...page, ...patch }, context), null);
  }
});
test('in-progress and user-stopped tasks do not take focus', () => {
  const origin = captureBrowserOrigin(page, context);
  for (const status of ['starting', 'running', 'stopping', 'stopped']) assert.equal(browserReturnDestination(origin, { ...finished, status }, context), null);
});
test('switching window, workspace, conversation, or closing the browser invalidates the return', () => {
  const origin = captureBrowserOrigin(page, context);
  for (const patch of [{ frontWindow: 'files' }, { browserOpen: false }, { cwd: '/other' }, { publicationSessionId: null }]) {
    assert.equal(isBrowserOriginCurrent(origin, { ...context, ...patch }), false);
    assert.equal(browserReturnDestination(origin, finished, { ...context, ...patch }), null);
  }
});
test('completion from another page, parent or workspace cannot return this task', () => {
  const origin = captureBrowserOrigin(page, context);
  for (const patch of [{ pageId: 'other-page' }, { parentSessionId: 'other-parent' }, { cwd: '/other' }]) assert.equal(browserReturnDestination(origin, { ...finished, ...patch }, context), null);
});
