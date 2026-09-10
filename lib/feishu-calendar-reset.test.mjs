import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url);
const { resetPresentationCalendar } = await jiti.import('./feishu-calendar-reset.ts');
const { DEMO_CALENDAR_MARKER } = await jiti.import('./feishu-demo-calendar-marker.ts');
const { FeishuCalendarClient } = await jiti.import('./feishu-calendar.ts');
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'calendar-reset-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const events = new Map([
    ['old', { id: 'old', description: DEMO_CALENDAR_MARKER }],
    ['legacy', { id: 'legacy', description: '旧演示记录' }],
    ['personal', { id: 'personal', title: '招聘进展周会', description: '个人手动安排' }],
  ]);
  const keys = new Map(), deleted = [], created = [];
  const calendar = {
    identity: 'app:calendar', resetEventIds: ['legacy'],
    allEvents: async () => [...events.values()],
    remove: async id => { deleted.push(id); events.delete(id); },
    create: async (draft, key) => {
      if (keys.has(key)) return keys.get(key);
      const event = { ...draft, id: `new-${created.length}` }; created.push(event); keys.set(key, event); events.set(event.id, event); return event;
    },
    get: async id => { assert.ok(events.has(id)); return events.get(id); },
  };
  return { root, calendar, events, deleted, created };
}
test('fresh run restores two today presets, leaves unrelated meetings, refresh keeps new progress, next run resets', async t => {
  const f = await fixture(t);
  await Promise.all(Array.from({ length: 5 }, () => resetPresentationCalendar(f.root, f.calendar, new Date('2026-09-10T17:00:00Z'))));
  assert.deepEqual(f.deleted.sort(), ['legacy', 'old']);
  assert.deepEqual(f.created.map(e => [e.title,e.startsAt,e.endsAt]), [
    ['招聘进展周会','2026-09-11T10:00:00+08:00','2026-09-11T10:30:00+08:00'],
    ['用人需求沟通','2026-09-11T15:00:00+08:00','2026-09-11T15:30:00+08:00'],
  ]);
  f.events.set('alignment', { id:'alignment', description:`议程\n\n${DEMO_CALENDAR_MARKER}` });
  await resetPresentationCalendar(f.root, f.calendar, new Date('2026-09-12T01:00:00Z'));
  assert.ok(f.events.has('alignment')); assert.equal(f.created.length,2);
  await resetPresentationCalendar(join(f.root,'next-run'), f.calendar, new Date('2026-09-12T01:00:00Z'));
  assert.equal(f.events.size,3); assert.ok(f.events.has('personal')); assert.equal(f.events.has('alignment'),false);
  assert.equal(f.created[2].startsAt,'2026-09-12T10:00:00+08:00');
});
test('partial create and lost response retry keep first preset and reuse second request even across midnight', async t => {
  const f = await fixture(t); const create = f.calendar.create; let calls = 0;
  f.calendar.create = async (...args) => { const event = await create(...args); if (++calls === 2) throw Error('lost create response'); return event; };
  await assert.rejects(resetPresentationCalendar(f.root,f.calendar,new Date('2026-09-10T01:00:00Z')),/lost/);
  const firstIds=[...f.events.keys()];
  await resetPresentationCalendar(f.root,f.calendar,new Date('2026-09-11T01:00:00Z'));
  assert.equal(f.created.length,2); assert.deepEqual([...f.events.keys()],firstIds);
  assert.deepEqual(f.deleted.sort(),['legacy','old']); assert.equal(f.created[1].startsAt,'2026-09-10T15:00:00+08:00');
});
test('delete response loss and failure stop startup; retry tolerates already cancelled event', async t => {
  const f = await fixture(t); const remove=f.calendar.remove; let first=true;
  f.calendar.remove=async id=>{await remove(id);if(first){first=false;throw Error('lost delete response');}};
  await assert.rejects(resetPresentationCalendar(f.root,f.calendar),/lost/); assert.equal(f.created.length,0);
  await resetPresentationCalendar(f.root,f.calendar); assert.equal(f.created.length,2); assert.equal(f.events.size,3);
});
test('failed list and corrupt journal cannot become successful reset or trigger deletion',async t=>{
  const f=await fixture(t); const list=f.calendar.allEvents;
  f.calendar.allEvents=async()=>{throw Error('permission denied');};
  await assert.rejects(resetPresentationCalendar(f.root,f.calendar),/permission/);assert.equal(f.deleted.length,0);
  f.calendar.allEvents=list;await resetPresentationCalendar(f.root,f.calendar);
  const dir=join(f.root,'calendar-reset',(await readdir(join(f.root,'calendar-reset')))[0]);
  assert.ok(JSON.parse(await readFile(join(dir,'state.json'))).complete);
  await writeFile(join(dir,'state.json'),'broken');
  const before=f.deleted.length;await assert.rejects(resetPresentationCalendar(f.root,f.calendar),/记录/);assert.equal(f.deleted.length,before);
});
test('remote list paginates without time limits, skips cancelled tombstones and DELETE suppresses notifications',async()=>{
  const calls=[]; const event={event_id:'owned',summary:'招聘进展周会',description:DEMO_CALENDAR_MARKER,start_time:{timestamp:'1789012800'},end_time:{timestamp:'1789014600'}};
  const client=new FeishuCalendarClient('shared','app:shared',async(path,init)=>{
    calls.push({path,init});if(init?.method==='DELETE')return {};
    return path.includes('page_token=next')?{items:[event],has_more:false}:{items:[{event_id:'cancelled',status:'cancelled'}],has_more:true,page_token:'next'};
  });
  assert.equal((await client.allEvents()).length,1);assert.equal(calls.length,2);
  assert.ok(calls.every(c=>!c.path.includes('start_time')));
  assert.ok(calls.every(c=>c.path.includes('anchor_time=0')));
  await client.remove('owned');assert.match(calls[2].path,/\/owned\?need_notification=false$/);assert.equal(calls[2].init.method,'DELETE');
});
test('broken or repeated pagination fails before callers can delete anything',async()=>{
  for(const body of [{items:[],has_more:true},{items:[],has_more:true,page_token:'same'},{items:'bad'}]){
    const client=new FeishuCalendarClient('shared','app:shared',async()=>body);
    await assert.rejects(client.allEvents(),/列表/);
  }
});
