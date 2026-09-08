import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createJiti } from 'jiti';
import { createPresentationRun, cleanPresentationRun } from '../electron/presentation.mjs';
const jiti = createJiti(import.meta.url, { interopDefault: true });

test('completed tasks remain discoverable in every run workspace after runtime wrappers are gone', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'syntropic-session-discovery-'));
  const run = await createPresentationRun(temp);
  process.env.SYNTROPIC_PRESENTATION_ROOT = run.root;
  const { listAllSessions, invalidateSessionListCache } = await jiti.import('./session-reader.ts');
  const { listManagedWorkspaces, createManagedWorkspace } = await jiti.import('./workspaces.ts');
  const { presentationSessionDir } = await jiti.import('./presentation-runtime.ts');
  try {
    const workspaces = listManagedWorkspaces();
    assert.deepEqual(workspaces.map(w => w.name), ['招聘工作台', '产品发布工作台', '调研洞察', '个人工作台']);
    assert.equal((await readFile(join(workspaces[1].cwd, '产品发布计划.md'), 'utf8')).includes('星流科技'), true);
    for (const [index, workspace] of workspaces.entries()) {
      const dir = presentationSessionDir(workspace.cwd);
      assert.ok(dir.startsWith(join(run.root, 'sessions')));
      await mkdir(dir, { recursive: true });
      const timestamp = new Date().toISOString();
      await writeFile(join(dir, `${index}.jsonl`), [
        { type: 'session', version: 3, id: `persisted-task-${index}`, timestamp, cwd: workspace.cwd },
        { type: 'session_info', id: 'info', parentId: null, timestamp, name: `任务 ${index}` },
        { type: 'message', id: 'msg', parentId: 'info', timestamp, message: { role: 'user', content: [{ type: 'text', text: '生成工作成果' }], timestamp: Date.now() } },
      ].map(JSON.stringify).join('\n')+'\n');
    }
    // No running wrappers or optimistic frontend rows participate in this scan.
    invalidateSessionListCache();
    const tasks = await listAllSessions({ force: true });
    assert.equal(tasks.length, 4);
    assert.deepEqual(new Set(tasks.map(t => t.cwd)), new Set(workspaces.map(w => w.cwd)));
    assert.ok(tasks.every(t => t.name.startsWith('任务 ') && !t.transient));
    const extra = createManagedWorkspace('客户协作');
    assert.ok(extra.cwd.startsWith(join(run.root, 'workspaces')));
    assert.equal(listManagedWorkspaces().length, 5);
  } finally {
    delete process.env.SYNTROPIC_PRESENTATION_ROOT;
    invalidateSessionListCache();
    await cleanPresentationRun(run); await rm(temp, { recursive: true, force: true });
  }
});
