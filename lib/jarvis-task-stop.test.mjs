import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url);
const { AgentSessionWrapper } = await jiti.import('./rpc-manager.ts');

test('task-window Stop marks cancellation before abort can settle, including before the first assistant message', async () => {
  const previous = globalThis.__piJarvisTasks;
  const task = { sessionId: 'stop-test', jarvisSessionId: 'parent', status: 'running', abortRequested: false };
  globalThis.__piJarvisTasks = new Map([[task.sessionId, task]]);
  let aborted = false;
  const inner = {
    sessionId: task.sessionId, agent: { state: {} },
    isStreaming: true, isCompacting: false, isBashRunning: false,
    async abort() {
      assert.equal(task.abortRequested, true, 'the completion hook must already know this was stopped');
      aborted = true;
      this.isStreaming = false;
    },
    dispose() {},
  };
  const wrapper = new AgentSessionWrapper(inner, { chatOnly: true, suppressCompletionNotifications: true });
  try { await wrapper.send({ type: 'abort' }); assert.equal(aborted, true); }
  finally { wrapper.destroy(); globalThis.__piJarvisTasks = previous; }
});
