import assert from 'node:assert/strict';
import test from 'node:test';
import { createJiti } from 'jiti';
const { captureBrowserOrigin, isBrowserOriginCurrent, browserReturnDestination } = await createJiti(import.meta.url).import('./return-to-origin.ts');
const context = { cwd: '/workspace', jarvisSessionId: 'main', taskSessionId: 'task', browserOpen: true, frontWindow: 'browser' };
const page = { pageId: 'page', cwd: context.cwd, taskSessionId: 'main', controller: 'agent' };
const finished = { pageId: page.pageId, cwd: page.cwd, parentSessionId: 'main', status: 'completed' };

test('completed and failed browser tasks return to the exact originating main conversation', () => {
  const origin = captureBrowserOrigin(page, context);
  for (const status of ['completed', 'failed']) assert.equal(browserReturnDestination(origin, { ...finished, status }, context), 'jarvis');
});
test('a task-window origin returns to that task rather than the desktop main conversation', () => {
  const origin = captureBrowserOrigin({ ...page, taskSessionId: 'task' }, context);
  assert.equal(browserReturnDestination(origin, { ...finished, parentSessionId: 'task' }, context), 'tasks');
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
  for (const patch of [{ frontWindow: 'files' }, { browserOpen: false }, { cwd: '/other' }, { jarvisSessionId: 'new-main' }]) {
    assert.equal(isBrowserOriginCurrent(origin, { ...context, ...patch }), false);
    assert.equal(browserReturnDestination(origin, finished, { ...context, ...patch }), null);
  }
});
test('completion from another page, parent or workspace cannot return this task', () => {
  const origin = captureBrowserOrigin(page, context);
  for (const patch of [{ pageId: 'other-page' }, { parentSessionId: 'other-parent' }, { cwd: '/other' }]) assert.equal(browserReturnDestination(origin, { ...finished, ...patch }, context), null);
});
