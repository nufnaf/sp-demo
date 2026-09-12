import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
const { createCalendarStore }=await createJiti(import.meta.url).import('./feishu-calendar-store.ts');
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
test('desktop and schedule share one read and receive the same snapshot',async()=>{
 const pending=deferred();let calls=0;let date;const store=createCalendarStore(async url=>{calls++;date=new URL(url,'http://local').searchParams.get('date');return pending.promise;});
 const views=[];const a=store.subscribe(()=>views.push(store.getSnapshot()));const b=store.subscribe(()=>views.push(store.getSnapshot()));
 const first=store.refresh();const second=store.refresh();assert.equal(calls,1);
 pending.resolve(Response.json({date,events:[{id:'real-event'}]}));await Promise.all([first,second]);
 assert.equal(store.getSnapshot().events[0].id,'real-event');assert.equal(views.at(-1),views.at(-2));a();b();
});
test('changing date rejects late results from the old date',async()=>{
 const old=deferred();const store=createCalendarStore(async url=>{const date=new URL(url,'http://local').searchParams.get('date');return date==='2026-09-10'?old.promise:Response.json({date,events:[{id:'new'}]});});
 const first=store.setDate('2026-09-10');await store.setDate('2026-09-17');old.resolve(Response.json({date:'2026-09-10',events:[{id:'old'}]}));await first;
 assert.equal(store.getSnapshot().events[0].id,'new');assert.equal(store.getSnapshot().date,'2026-09-17');
});
test('creation invalidates a read already in flight; failure keeps the last snapshot visibly marked with an error',async()=>{
 const old=deferred();let calls=0;let date;let fail=false;
 const store=createCalendarStore(async url=>{date=new URL(url,'http://local').searchParams.get('date');if(++calls===1)return old.promise;if(fail)return Response.json({error:'权限已撤销'},{status:502});return Response.json({date,events:[{id:'created'}]});});
 const first=store.refresh();await store.invalidate();old.resolve(Response.json({date,events:[]}));await first;
 assert.equal(store.getSnapshot().events.length,1);
 fail=true;await store.refresh();assert.equal(store.getSnapshot().error,'权限已撤销');assert.equal(store.getSnapshot().events[0].id,'created');
});
