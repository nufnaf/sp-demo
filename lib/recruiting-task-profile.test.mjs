import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DefaultResourceLoader, SessionManager } from '@earendil-works/pi-coding-agent';
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url);
const { recruitingProfile, recruitingTaskKind, readRecruitingTaskKind, RECRUITING_TASK_PROFILE } = await jiti.import('./recruiting-task-profile.ts');

test('profiles survive session restore and cannot change another workspace', async () => {
  const previous = process.env.SYNTROPIC_PRESENTATION_ROOT;
  const root = await mkdtemp(join(tmpdir(), 'recruiting-profile-'));
  process.env.SYNTROPIC_PRESENTATION_ROOT = root;
  try {
    const cwd = join(root, 'workspace'); await mkdir(cwd);
    assert.equal(recruitingTaskKind(cwd, 'publication'), 'publication');
    assert.equal(recruitingTaskKind(root, 'jd'), undefined);
    assert.equal(recruitingTaskKind(cwd, 'unknown'), undefined);
    const session = SessionManager.create(cwd, join(root, 'sessions'));
    session.appendCustomEntry(RECRUITING_TASK_PROFILE, { version: 1, kind: 'jd' });
    session.appendMessage({ role: 'user', content: '生成 JD', timestamp: Date.now() });
    // Pi flushes a fresh session to disk after the first assistant message.
    session.appendMessage({ role: 'assistant', content: [{type:'text',text:'已完成'}], timestamp: Date.now() });
    const restored = SessionManager.open(session.getSessionFile());
    assert.equal(readRecruitingTaskKind(cwd, restored.getEntries()), 'jd');
    assert.equal(readRecruitingTaskKind(root, restored.getEntries()), undefined);
    assert.equal(readRecruitingTaskKind(cwd, [{type:'custom',customType:RECRUITING_TASK_PROFILE,data:{version:2,kind:'jd'}}]), undefined);
  } finally {
    if (previous === undefined) delete process.env.SYNTROPIC_PRESENTATION_ROOT; else process.env.SYNTROPIC_PRESENTATION_ROOT = previous;
    await rm(root, {recursive:true,force:true});
  }
});

for (const kind of ['jd', 'publication']) test(`${kind} SDK loader excludes generic design/context on initial load and reload`, async () => {
  const root = await mkdtemp(join(tmpdir(), 'recruiting-loader-'));
  try {
    await mkdir(join(root,'.pi'));
    await writeFile(join(root,'AGENTS.md'),'UNRELATED_PROJECT_INSTRUCTIONS');
    await writeFile(join(root,'.pi','APPEND_SYSTEM.md'),'UNRELATED_HTML_DESIGN');
    const profile = recruitingProfile(kind);
    const loader = new DefaultResourceLoader({cwd:root,agentDir:join(root,'agent'),...profile.resources});
    for(let i=0;i<2;i++) {
      await loader.reload();
      assert.equal(loader.getSystemPrompt(),profile.resources.systemPrompt);
      assert.deepEqual(loader.getAppendSystemPrompt(),[]);
      assert.deepEqual(loader.getAgentsFiles().agentsFiles,[]);
      assert.deepEqual(loader.getSkills().skills,[]);
    }
    assert.deepEqual(profile.tools,kind==='jd'?['feishu_demo_find_read','save_recruiting_jd']:['browser_task']);
    assert.match(profile.resources.systemPrompt, kind==='jd'?/1200/:/不重复创建/);
  } finally { await rm(root,{recursive:true,force:true}); }
});
