import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJiti } from 'jiti';
import { SessionManager } from '@earendil-works/pi-coding-agent';
const jiti = createJiti(import.meta.url);
const { isRecruitingJdDemoRequest, saveRecruitingJdDemo } = await jiti.import('./recruiting-jd-demo.ts');
const { renderRecruitingJdDemo } = await jiti.import('./recruiting-jd-demo-renderer.ts');
const { RECRUITING_JD_DEMO: jd } = await jiti.import('./recruiting-jd-fixture.ts');
const { extractRecruitingJd } = await jiti.import('./browser/recruiting-publication.ts');
const { AgentSessionWrapper, getRunningRpcSessionIds } = await jiti.import('./rpc-manager.ts');
const { normalizeToolCalls } = await jiti.import('./normalize.ts');
const { createPresentationTask, publicationDraft } = await jiti.import('./presentation-tasks.ts');
const { extractTurnWrittenFiles } = await jiti.import('./turn-written-files.ts');

async function setup(t) {
  const root = await mkdtemp(join(tmpdir(), 'jd-demo-'));
  const previous = process.env.SYNTROPIC_PRESENTATION_ROOT;
  process.env.SYNTROPIC_PRESENTATION_ROOT = root;
  const cwd = join(root,'workspace'); await mkdir(cwd);
  t.after(async () => {
    if (previous === undefined) delete process.env.SYNTROPIC_PRESENTATION_ROOT; else process.env.SYNTROPIC_PRESENTATION_ROOT = previous;
    await rm(root,{recursive:true,force:true});
    globalThis.__piJarvisTasks?.clear();
    globalThis.__piSessions?.clear();
  });
  return { root, cwd };
}

test('fixture preserves full design content and embeds the existing Xingliu logo offline', async () => {
  const html = renderRecruitingJdDemo();
  const result = extractRecruitingJd(html,'jd.html');
  assert.equal(result.title,jd.title);
  for (const line of [...jd.about,...jd.responsibilities,...jd.requirements,...jd.bonus.flatMap(x=>x.body),...jd.benefits.flatMap(x=>x.body),jd.closing]) assert.ok(result.text.includes(line),line);
  assert.ok(result.text.includes('北京 / 上海'));
  assert.ok(result.text.includes('混合办公'));
  assert.doesNotMatch(result.text,/Syntropic|Syntrropic|杭州/);
  assert.doesNotMatch(html, /<script|src="https?:/);
  assert.ok(html.includes((await readFile(new URL('../public/icons/company-careers-logo.svg',import.meta.url))).toString('base64')));
});

test('only explicit JD generation in recruiting is intercepted', async t => {
  const {cwd,root}=await setup(t);
  for(const message of ['生成 JD','生成 JD，不要写薪资','帮我写一个岗位描述','请根据飞书中的《星流科技业务介绍》，生成高级 AI Agent 研发工程师的岗位 JD']) assert.equal(isRecruitingJdDemoRequest(cwd,message),true);
  for(const message of ['发布这份 JD','生成 JD 了吗','不要生成 JD','怎么生成 JD','查询面试进展']) assert.equal(isRecruitingJdDemoRequest(cwd,message),false);
  assert.equal(isRecruitingJdDemoRequest(root,'生成 JD'),false);
});

test('save is deterministic, scoped and does not follow the destination symlink; abort preserves prior result', async t => {
  const {cwd,root}=await setup(t);const outside=join(root,'keep');await writeFile(outside,'keep');
  await symlink(outside,join(cwd,'ai-agent-engineer-jd.html'));
  const first=await saveRecruitingJdDemo(cwd);const html=await readFile(first.path,'utf8');
  assert.equal(await readFile(outside,'utf8'),'keep');
  await saveRecruitingJdDemo(cwd);assert.equal(await readFile(first.path,'utf8'),html);
  const controller=new AbortController();controller.abort();
  await assert.rejects(saveRecruitingJdDemo(cwd,controller.signal));
  await assert.rejects(saveRecruitingJdDemo(root));
  assert.equal(await readFile(first.path,'utf8'),html);
});

function wrapperFor(cwd, root) {
  const manager=SessionManager.create(cwd,join(root,'parent-sessions'));
  const inner={isStreaming:false,isCompacting:false,isBashRunning:false,sessionId:manager.getSessionId(), sessionFile:manager.getSessionFile(), sessionManager:manager, agent:{state:{messages:[]}}, extensionRunner:{}, prompt(){throw Error('MODEL MUST NOT RUN');}, dispose(){}, getContextUsage(){return null;}, getSteeringMessages(){return [];},getFollowUpMessages(){return [];}};
  const wrapper=new AgentSessionWrapper(inner,{role:'jarvis'});
  globalThis.__piSessions ??= new Map();globalThis.__piSessions.set(inner.sessionId,wrapper);
  return {wrapper,inner,manager};
}

test('presentation input has no general-model fallback, including legacy task sessions and queues', async t => {
  const {cwd,root}=await setup(t); const {wrapper,inner}=wrapperFor(cwd,root); t.after(()=>wrapper.destroy());
  inner.steer=inner.followUp=inner.executeBash=inner.compact=()=>{throw Error('MODEL MUST NOT RUN');};
  for (const type of ['prompt','steer','follow_up']) {
    await wrapper.send({type,message:'请帮我写一首诗'});
    assert.equal(inner.agent.state.messages.at(-1).provider,'syntropic-demo');
    assert.match(inner.agent.state.messages.at(-1).content[0].text,/生成岗位 JD/);
  }
  for (const type of ['bash','compact','reload','set_model','navigate_tree']) await assert.rejects(wrapper.send({type}),/工作台中的操作入口/);
  const legacy=new AgentSessionWrapper(inner);t.after(()=>legacy.destroy());
  await legacy.send({type:'prompt',message:'不要重新生成 JD'});
  assert.equal(legacy.isRunning(),false);
  const other=join(root,'workspaces','personal-focus');await mkdir(other,{recursive:true});
  const ordinary=wrapperFor(other,root);t.after(()=>ordinary.wrapper.destroy());
  await ordinary.wrapper.send({type:'prompt',message:'生成 JD'});
  assert.match(ordinary.inner.agent.state.messages.at(-1).content[0].text,/查看资料和成果/);
});

test('publication failure is a persisted failed task, never a model reply claiming completion', async t => {
  const {cwd,root}=await setup(t);const {wrapper}=wrapperFor(cwd,root);t.after(()=>wrapper.destroy());
  const previous=globalThis.fetch;globalThis.fetch=async()=>({ok:false});t.after(()=>{globalThis.fetch=previous;});
  const events=[];let done;const finished=new Promise(resolve=>done=resolve);wrapper.onEvent(event=>{events.push(event);if(event.type==='prompt_done')done();});
  const result=await wrapper.send({type:'prompt',message:'发布岗位',demoAction:'publish-jd'});
  assert.ok(result.taskId);await finished;
  const task=events.filter(event=>event.type==='jarvis_task_update').at(-1).task;
  assert.equal(task.status,'failed');
  const files=await SessionManager.list(cwd,join(root,'sessions','recruiting'));
  const child=SessionManager.open(files.find(file=>file.id===result.taskId).path);
  assert.equal(child.getBranch().filter(entry=>entry.type==='message').at(-1).message.stopReason,'error');
});

test('an already published draft is reused without starting a browser or submitting twice', async t => {
  const {cwd}=await setup(t);const previous=globalThis.fetch;
  globalThis.fetch=async()=>({ok:true,json:async()=>({app:'syntropic-recruiting',jobs:[{id:'saved-job',draft:publicationDraft(cwd),title:'高级 AI Agent 研发工程师'}],scene:{job:{id:'saved-job'}}})});
  t.after(()=>{globalThis.fetch=previous;});
  const run=createPresentationTask(cwd,'parent','发布岗位','publish-jd');
  const task=await run.run(new AbortController().signal);
  assert.equal(task.status,'completed');assert.match(task.summary,/无需重复创建/);
  const messages=run.manager.getBranch().filter(entry=>entry.type==='message').map(entry=>entry.message);
  assert.equal(messages.some(message=>Array.isArray(message.content)&&message.content.some(block=>block.type==='toolCall')),false);
});

test('desktop dispatch completes without model calls, restores transcript and exposes the real artifact',async t=>{
  const {cwd,root}=await setup(t);const {wrapper,inner,manager}=wrapperFor(cwd,root);t.after(()=>wrapper.destroy());
  const events=[];let finish;const done=new Promise(r=>finish=r);
  wrapper.onEvent(e=>{events.push(e);if(e.type==='prompt_done')finish();});
  await wrapper.send({type:'prompt',message:'生成 JD'});
  assert.equal(wrapper.isRunning(),true);
  const started=events.find(e=>e.type==='jarvis_task_update').task;
  assert.ok(getRunningRpcSessionIds().includes(started.sessionId));
  await assert.rejects(wrapper.send({type:'prompt',message:'生成 JD'}));
  await done;
  assert.equal(wrapper.isRunning(),false);
  assert.equal(events.filter(e=>e.type==='jarvis_task_update').at(-1).task.status,'completed');
  assert.ok(inner.agent.state.messages.some(m=>m.role==='user'));
  const restored=SessionManager.open(manager.getSessionFile());
  assert.ok(restored.getEntries().some(e=>e.type==='message'&&e.message.role==='custom'&&e.message.details.status==='completed'));
  const tasks=await SessionManager.list(cwd,join(root,'sessions','recruiting'));
  const child=SessionManager.open(tasks.find(x=>x.id===started.sessionId).path);
  const messages=child.getBranch().filter(e=>e.type==='message').map(e=>e.message);
  const results=new Map(messages.filter(m=>m.role==='toolResult').map(m=>[m.toolCallId,m]));
  const files=messages.filter(m=>m.role==='assistant').flatMap(m=>extractTurnWrittenFiles(normalizeToolCalls(m).content,results,cwd));
  assert.equal(files.length,1);
  assert.equal(extractRecruitingJd(await readFile(files[0].filePath,'utf8'),'jd.html').title,jd.title);
});

test('stopping during preparation settles once and never creates an artifact',async t=>{
  const {cwd,root}=await setup(t);const {wrapper}=wrapperFor(cwd,root);t.after(()=>wrapper.destroy());
  const events=[];let finish;const done=new Promise(r=>finish=r);
  wrapper.onEvent(e=>{events.push(e);if(e.type==='prompt_done')finish();});
  await wrapper.send({type:'prompt',message:'生成 JD'});await wrapper.send({type:'abort'});await done;
  assert.equal(events.filter(e=>e.type==='jarvis_task_update').at(-1).task.status,'aborted');
  assert.equal(events.filter(e=>e.type==='prompt_done').length,1);
  await assert.rejects(readFile(join(cwd,'ai-agent-engineer-jd.html')));
});
