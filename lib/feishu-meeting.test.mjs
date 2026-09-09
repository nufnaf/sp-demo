import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJiti } from 'jiti';
const { ensureFeishuMeeting, alignmentMeetingDraft }=await createJiti(import.meta.url).import('./feishu-meeting.ts');
const draft={title:'标准对齐',startsAt:'2026-09-11T14:00:00+08:00',endsAt:'2026-09-11T14:30:00+08:00',description:'参会名单与议程'};
const event={id:'remote-id',title:draft.title,source:'feishu'};
test('concurrent triggers create once; subsequent calls and a new service instance read the remote ID',async t=>{
 const root=await mkdtemp(join(tmpdir(),'feishu-meeting-'));t.after(()=>rm(root,{recursive:true,force:true}));
 let creates=0,reads=0;
 const calendar={identity:'app:calendar',create:async()=>{creates++;return event;},get:async id=>{reads++;assert.equal(id,event.id);return {...event,title:'远端修改'};}};
 const results=await Promise.all(Array.from({length:6},()=>ensureFeishuMeeting(root,'same',draft,calendar)));
 assert.equal(creates,1);assert.equal(results.length,6);
 assert.equal((await ensureFeishuMeeting(root,'same',draft,{...calendar})).title,'远端修改');assert.equal(reads,1);assert.equal(creates,1);
});
test('uncertain write retry retains request key and original times even after the day changes',async t=>{
 const root=await mkdtemp(join(tmpdir(),'feishu-meeting-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const attempts=[];
 const calendar={identity:'app:calendar',create:async(input,key)=>{attempts.push({input,key});if(attempts.length===1)throw Error('response lost');return event;}};
 await assert.rejects(ensureFeishuMeeting(root,'same',draft,calendar),/response lost/);
 await ensureFeishuMeeting(root,'same',{...draft,startsAt:'2026-09-12T14:00:00+08:00'},calendar);
 assert.deepEqual(attempts[0],attempts[1]);
});
test('a different app/calendar or a new presentation run has separate identity',async t=>{
 const root=await mkdtemp(join(tmpdir(),'feishu-meeting-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const keys=[];
 const create=async(_draft,key)=>{keys.push(key);return event;};
 await ensureFeishuMeeting(root,'same',draft,{identity:'app:calendar',create});
 await ensureFeishuMeeting(root,'same',draft,{identity:'other:calendar',create});
 await ensureFeishuMeeting(join(root,'next-run'),'same',draft,{identity:'app:calendar',create});
 assert.equal(new Set(keys).size,3);
});
test('alignment draft derives people and agenda from the current job with an explicit timezone',()=>{
 const scene={job:{id:'job',title:'AI 工程师',owner:'Mark'},insight:{interviewers:['Mark','TIM'],candidates:[{name:'王一'}]}};
 const result=alignmentMeetingDraft(scene,new Date('2026-09-10T17:00:00Z'));
 assert.equal(result.startsAt,'2026-09-12T14:00:00+08:00');assert.match(result.description,/王一/);assert.equal(result.description.match(/Mark/g).length,1);
 assert.match(result.title,/AI 工程师/);
});
