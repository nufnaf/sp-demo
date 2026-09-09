import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createJiti } from 'jiti';

test('presentation only persists success after Feishu confirms; uncertain failure retries the same request',async t=>{
 const root=await mkdtemp(join(tmpdir(),'feishu-presentation-'));
 const previousRoot=process.env.SYNTROPIC_PRESENTATION_ROOT;
 const previousConfig=process.env.SYNTROPIC_FEISHU_CONFIG;
 const originalFetch=globalThis.fetch;
 t.after(async()=>{globalThis.fetch=originalFetch;if(previousRoot===undefined)delete process.env.SYNTROPIC_PRESENTATION_ROOT;else process.env.SYNTROPIC_PRESENTATION_ROOT=previousRoot;if(previousConfig===undefined)delete process.env.SYNTROPIC_FEISHU_CONFIG;else process.env.SYNTROPIC_FEISHU_CONFIG=previousConfig;await rm(root,{recursive:true,force:true});});
 process.env.SYNTROPIC_PRESENTATION_ROOT=root;
 process.env.SYNTROPIC_FEISHU_CONFIG=join(root,'config.json');
 await writeFile(process.env.SYNTROPIC_FEISHU_CONFIG,JSON.stringify({appId:'test-app',appSecret:'test-secret',folderToken:'folder',documentIds:['doc'],calendarId:'test-calendar'}));
 await writeFile(join(root,'progress.json'),JSON.stringify({insight:{filePath:'fixture',title:'洞察'},recruiting:{jobs:[],scene:{job:{id:'job-a',title:'Agent 工程师',owner:'张'},insight:{interviewers:['Mark','TIM'],candidates:[{name:'王一'}]}}}}));
 let fail=true;const writes=[];
 const event={event_id:'actual-event_0',summary:'返回的真实标题',start_time:{timestamp:'1789106400'},end_time:{timestamp:'1789108200'},description:'返回的说明',status:'confirmed'};
 globalThis.fetch=async(url,init)=>{
   const path=String(url);
   if(path.includes('/auth/'))return Response.json({code:0,tenant_access_token:'fixture-token',expire:7200});
   if(init?.method==='POST'){writes.push({path,body:init.body});if(fail)throw Error('connection lost');return Response.json({code:0,data:{event}});}
   if(path.includes('/events/actual-event_0'))return Response.json({code:0,data:{event:{...event,summary:'飞书后来修改的标题'}}});
   throw Error('unexpected request');
 };
 const {advancePresentation}=await createJiti(import.meta.url,{alias:{'@':resolve('.')}}).import('./presentation-progress.ts');
 await assert.rejects(advancePresentation('meeting'),/连接飞书/);
 assert.equal(JSON.parse(await readFile(join(root,'progress.json'),'utf8')).meeting,undefined);
 fail=false;
 const result=await advancePresentation('meeting');
 assert.equal(result.meeting.id,'actual-event_0');assert.equal(result.meeting.source,'feishu');assert.equal(result.meeting.title,'返回的真实标题');
 assert.equal(writes.length,2);assert.deepEqual(writes[0],writes[1]);
 const repeated=await advancePresentation('meeting');assert.equal(repeated.meeting.title,'飞书后来修改的标题');assert.equal(writes.length,2);
});
