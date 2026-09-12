import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createJiti} from 'jiti';
const {ensureFeishuGuiMeeting,matchesGuiMeeting}=await createJiti(import.meta.url).import('./meeting.ts');
const draft={title:'面试标准对齐',startsAt:'2026-09-12T14:00:00+08:00',endsAt:'2026-09-12T14:30:00+08:00',description:'评价标准\n由 Syntropic 安排'};
const event={...draft,id:'remote',calendarId:'demo',allDay:false,status:'confirmed',source:'feishu'};
async function setup(t){const root=await mkdtemp(join(tmpdir(),'gui-meeting-'));t.after(()=>rm(root,{recursive:true,force:true}));let entries=[],runs=0;const calendar={identity:'app:demo',events:async()=>entries,get:async()=>event,create:async()=>assert.fail('GUI route must never call API create')};const executor={run:async(_id,_draft,_name,before)=>{runs++;await before();entries=[event];},verified:()=>{}};return {root,calendar,executor,get runs(){return runs;},set entries(value){entries=value;}};}
test('concurrent meeting triggers perform one GUI save and subsequent calls read the event ID',async t=>{const s=await setup(t);const results=await Promise.all(Array.from({length:5},()=>ensureFeishuGuiMeeting(s.root,'meeting',draft,s.calendar,s.executor,'demo',1)));assert.equal(s.runs,1);assert.equal(results.length,5);await ensureFeishuGuiMeeting(s.root,'meeting',draft,s.calendar,s.executor,'demo',1);assert.equal(s.runs,1);});
test('a lost save response reconciles through API and never repeats GUI input',async t=>{const s=await setup(t);let runs=0;s.executor.run=async(_i,_d,_n,before)=>{runs++;await before();s.entries=[event];throw Error('worker disconnected');};assert.equal((await ensureFeishuGuiMeeting(s.root,'meeting',draft,s.calendar,s.executor,'demo',1)).id,'remote');await ensureFeishuGuiMeeting(s.root,'meeting',draft,s.calendar,s.executor,'demo',1);assert.equal(runs,1);});
test('uncertain writes without a match stay read-only across retries until the original event appears',async t=>{const s=await setup(t);let runs=0;s.executor.run=async(_i,_d,_n,before)=>{runs++;await before();throw Error('lost');};await assert.rejects(ensureFeishuGuiMeeting(s.root,'meeting',draft,s.calendar,s.executor,'demo',1),/尚未/);await assert.rejects(ensureFeishuGuiMeeting(s.root,'meeting',{...draft,title:'changed'},s.calendar,s.executor,'demo',1),/上次保存/);assert.equal(runs,1);s.entries=[event];assert.equal((await ensureFeishuGuiMeeting(s.root,'meeting',draft,s.calendar,s.executor,'demo',1)).title,draft.title);assert.equal(runs,1);});
test('a failure before save can retry after permission is fixed',async t=>{const s=await setup(t);const run=s.executor.run;s.executor.run=async()=>{throw Error('日历不可写');};await assert.rejects(ensureFeishuGuiMeeting(s.root,'meeting',draft,s.calendar,s.executor,'demo',1),/日历不可写/);s.executor.run=run;await ensureFeishuGuiMeeting(s.root,'meeting',draft,s.calendar,s.executor,'demo',1);assert.equal(s.runs,1);});
test('ambiguous API matches after an uncertain save stop without another GUI attempt',async t=>{const s=await setup(t);let runs=0;s.executor.run=async(_id,_draft,_name,before)=>{runs++;await before();s.entries=[event,{...event,id:'second'}];};await assert.rejects(ensureFeishuGuiMeeting(s.root,'meeting',draft,s.calendar,s.executor,'demo',1),/多条/);assert.equal(runs,1);});
test('API verification checks committed times, description, cancellation and all-day status',()=>{assert(matchesGuiMeeting({...event,startsAt:'2026-09-12T06:00:00Z',description:'评价标准  由 Syntropic 安排'},draft));for(const patch of [{status:'cancelled'},{allDay:true},{description:'different'},{endsAt:'2026-09-12T14:45:00+08:00'}])assert(!matchesGuiMeeting({...event,...patch},draft));});

test('GUI executor keeps the configured calendar name as context when available',async t=>{
 const s=await setup(t);s.calendar.calendarName='刘星（星流科技HR）';
 const run=s.executor.run;
 s.executor.run=async(...args)=>{assert.equal(args[2],s.calendar.calendarName);await run(...args);};
 assert.equal((await ensureFeishuGuiMeeting(s.root,'personal',draft,s.calendar,s.executor)).id,'remote');
 assert.equal(s.runs,1);
});
test('missing GUI destination is allowed because native flow keeps the current calendar',async t=>{
 const s=await setup(t);let received;
 s.executor.run=async(...args)=>{received=args[2];await args[3]();s.entries=[event];};
 assert.equal((await ensureFeishuGuiMeeting(s.root,'personal',draft,s.calendar,s.executor)).id,'remote');
 assert.equal(received,'');
});
