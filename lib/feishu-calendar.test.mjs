import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url);
const { FeishuDemoClient } = await jiti.import('./feishu-demo-client.ts');
const { normalizeCalendarEvent } = await jiti.import('./feishu-calendar.ts');
const { calendarDate, calendarRange, calendarDuration, calendarTimeLabel } = await jiti.import('./calendar-view.ts');
const config = { appId:'fixture-app', appSecret:'fixture-secret', folderToken:'folder', documentIds:['doc'], calendarId:'shared-calendar' };
const event = { event_id:'event-one_0', summary:'对齐会议', start_time:{timestamp:'1789012800'}, end_time:{timestamp:'1789014600'}, description:'参会人（名单记录）\nMark\n\n会议议程\n1. 对齐标准', status:'confirmed', app_link:'https://applink.feishu.cn/client/calendar/event/detail?key=fixture' };
function harness(handle) {
  const calls=[];
  const client=new FeishuDemoClient(config, async (url,init) => {
    calls.push({url,init});
    if(url.includes('/auth/'))return Response.json({code:0,tenant_access_token:'fixture-token',expire:7200});
    return handle(url,init);
  });
  return {client,calendar:client.calendar(),calls};
}
test('create writes the exact event to the configured shared calendar, without invitations or notifications',async()=>{
  const h=harness((_url,init)=>{
    const body=JSON.parse(init.body);
    assert.equal(body.need_notification,false);
    assert.equal(body.visibility,'public');
    assert.deepEqual(body.vchat,{vc_type:'no_meeting'});
    assert.equal(body.attendees,undefined);
    assert.equal(body.location,undefined, 'Feishu rejects an empty location.name');
    assert.equal(body.start_time.timezone,'Asia/Shanghai');
    assert.equal(body.start_time.timestamp,String(Date.parse('2026-09-10T14:00:00+08:00')/1000));
    return Response.json({code:0,data:{event}});
  });
  const result=await h.calendar.create({title:event.summary,startsAt:'2026-09-10T14:00:00+08:00',endsAt:'2026-09-10T14:30:00+08:00',description:event.description},'same-key');
  assert.equal(result.source,'feishu');assert.equal(result.id,event.event_id);assert.equal(result.description,event.description);
  assert.ok(h.calls[1].url.includes('/calendars/shared-calendar/events?idempotency_key=same-key'));
  assert.equal(h.calls.filter(x=>x.init?.method==='POST').length,2); // auth + create only
});
test('lost token retries once with the identical idempotency key and body',async()=>{
  let writes=0;
  const h=harness(()=>Response.json(writes++===0?{code:99991663}:{code:0,data:{event}}));
  await h.calendar.create({title:'会议',startsAt:'2026-09-10T14:00:00+08:00',endsAt:'2026-09-10T14:30:00+08:00',description:''},'stable-key');
  const requests=h.calls.filter(x=>x.url.includes('/calendar/'));
  assert.equal(requests.length,2);assert.equal(requests[0].url,requests[1].url);assert.equal(requests[0].init.body,requests[1].init.body);
});
test('instance view includes repeated instances, filters cancellations, sorts and preserves all-day dates',async()=>{
  const allDay={...event,event_id:'all-day',start_time:{date:'2026-09-10'},end_time:{date:'2026-09-11'}};
  const h=harness(url=>{
    assert.ok(url.includes('/events/instance_view?'));
    return Response.json({code:0,data:{items:[{...event,event_id:'repeat_1'}, {...event,event_id:'cancel',status:'cancelled'},allDay,{...event,event_id:'repeat_2',start_time:{timestamp:'1789099200'},end_time:{timestamp:'1789101000'}}]}});
  });
  const events=await h.calendar.events('2026-09-10T00:00:00+08:00','2026-09-17T00:00:00+08:00');
  assert.deepEqual(events.map(x=>x.id),['all-day','repeat_1','repeat_2']);
  assert.equal(events[0].startsAt,'2026-09-10');assert.equal(calendarDuration(events[0]),'全天');assert.match(calendarTimeLabel(events[0]),/2026-09-10/);
});
test('invalid range and missing explicit calendar fail before making any request',async()=>{
  let calls=0;const client=new FeishuDemoClient({...config,calendarId:undefined},async()=>{calls++;});
  assert.throws(()=>client.calendar(),/团队日历尚未配置/);
  const h=harness(()=>{throw Error('unexpected');});
  await assert.rejects(h.calendar.events('invalid','invalid'),/范围/);
  await assert.rejects(h.calendar.events('2026-09-10','2026-10-20'),/范围/);
  assert.equal(h.calls.length,0);assert.equal(calls,0);
  assert.throws(()=>new FeishuDemoClient({...config,calendarId:'primary'}).calendar(),/团队日历尚未配置/);
});
test('permission, transport and malformed upstream failures never become empty calendar success',async()=>{
  const denied=harness(()=>Response.json({code:99991672,msg:'fixture-secret must never appear'}));
  await assert.rejects(denied.calendar.events('2026-09-10','2026-09-17'),e=>e.message.includes('日历')&&!e.message.includes('fixture-secret'));
  assert.equal(denied.calls.length,2);
  const malformed=harness(()=>Response.json({code:0,data:{items:'invalid'}}));
  await assert.rejects(malformed.calendar.events('2026-09-10','2026-09-17'),/不完整/);
  const transport=harness(()=>Response.json({code:0,data:{items:[]}},{status:500}));
  await assert.rejects(transport.calendar.events('2026-09-10','2026-09-17'),/异常响应/);
});

test('new empty calendar accepts Feishu successful response with omitted items', async()=>{
  const h=harness(()=>Response.json({code:0,data:{}}));
  assert.deepEqual(await h.calendar.events('2026-09-10','2026-09-17'),[]);
});
test('remote edits are read by ID; cancelled events cannot be reported as arranged',async()=>{
  let cancelled=false;
  const h=harness(()=>Response.json({code:0,data:{event:{...event,summary:'飞书修改后的标题',status:cancelled?'cancelled':'confirmed'}}}));
  assert.equal((await h.calendar.get(event.event_id)).title,'飞书修改后的标题');
  cancelled=true;await assert.rejects(h.calendar.get(event.event_id),/取消/);
});
test('rich descriptions are rendered as safe readable text and links are restricted to official app links',()=>{
  const normalized=normalizeCalendarEvent({...event,description:'<p>Mark &amp; TIM</p><p>议程<br>第一项</p><script>bad()</script>',app_link:'javascript:alert(1)'},'calendar');
  assert.equal(normalized.description,'Mark & TIM\n议程\n第一项');assert.equal(normalized.appLink,undefined);
  assert.throws(()=>normalizeCalendarEvent({...event,start_time:{date:'2026-02-30'},end_time:{date:'2026-03-01'}},'calendar'),/时间/);
});
test('calendar dates and ranges stay in Beijing time even when process timezone differs',()=>{
  assert.equal(calendarDate(new Date('2026-09-10T17:00:00Z')),'2026-09-11');
  assert.deepEqual(calendarRange('2026-12-29'),{date:'2026-12-29',start:'2026-12-29T00:00:00+08:00',end:'2027-01-05T00:00:00+08:00'});
});
test('rate limiting asks for a later retry without automatic write retries',async()=>{
 const h=harness(()=>Response.json({code:99991400},{status:429}));
 await assert.rejects(h.calendar.create({title:'会议',startsAt:'2026-09-10T14:00:00+08:00',endsAt:'2026-09-10T14:30:00+08:00',description:''},'stable'),/稍后/);
 assert.equal(h.calls.filter(x=>x.url.includes('/calendar/')).length,1);
});
test('changing the local configuration swaps app and calendar identity instead of retaining the old account',async t=>{
 const {mkdtemp,writeFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const folder=await mkdtemp(join(tmpdir(),'feishu-config-'));const file=join(folder,'config.json');const previous=process.env.SYNTROPIC_FEISHU_CONFIG;
 t.after(async()=>{if(previous===undefined)delete process.env.SYNTROPIC_FEISHU_CONFIG;else process.env.SYNTROPIC_FEISHU_CONFIG=previous;await rm(folder,{recursive:true,force:true});});
 process.env.SYNTROPIC_FEISHU_CONFIG=file;
 const {getFeishuDemoClient}=await jiti.import('./feishu-demo-client.ts');
 await writeFile(file,JSON.stringify(config));const first=await getFeishuDemoClient();assert.equal(first,await getFeishuDemoClient());
 await writeFile(file,JSON.stringify({...config,appId:'replacement-app',calendarId:'replacement-calendar'}));
 const second=await getFeishuDemoClient();assert.notEqual(first,second);assert.equal(second.calendar().identity,'replacement-app:replacement-calendar');
 await writeFile(file,'{}');await assert.rejects(getFeishuDemoClient(),/配置/);
});
