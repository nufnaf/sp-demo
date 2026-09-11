import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url);
const { FeishuDemoClient } = await jiti.import('./feishu-demo-client.ts');
function fixtureClient(config, request = async () => Response.json({code:0,data:{}}), clock) {
 return new FeishuDemoClient({ ...config, identity: config.appId }, async (path, init) => {
   let response;
   try { response = await request(`https://open.feishu.cn/open-apis${path}`, init); }
   catch { throw new Error('无法连接飞书，请重试。'); }
   if(response.status===429)throw new Error('飞书请求较多，请稍后重试。');
   let body;try{body=await response.json();}catch{throw new Error('飞书返回异常响应');}
   if(body.code!==0)throw Object.assign(new Error('请联系管理员检查权限'),{kind:'authorization'});
   return body.data??{};
 },clock);
}

const config = { appId: 'test-app', folderToken: 'demo-folder', documentIds: ['DocA'] };
test('calendar target retains an explicit GUI name independently of API identity, with no implicit shared target',()=>{
 const client=fixtureClient({...config,calendarId:'personal-id',calendarName:' 刘星（星流科技HR） '});
 assert.equal(client.calendar().identity,'test-app:personal-id');
 assert.equal(client.calendar().calendarName,'刘星（星流科技HR）');
 assert.equal(fixtureClient({...config,calendarId:'personal-id'}).calendar().calendarName,undefined);
 for(const calendarName of ['', ' ', '\ninvalid',42,'x'.repeat(201)]) {
  assert.throws(()=>fixtureClient({...config,calendarId:'personal-id',calendarName}).calendar(),{kind:'configuration'});
 }
});
function harness() {
  const calls = []; let now = 0; let tokenFailures = 0; let authRequests = 0; let denied = false;
  const request = async (url, init) => {
    calls.push(url);
    if (url.includes('/auth/')) { authRequests++; return Response.json({ code: 0, tenant_access_token: `token-${authRequests}`, expire: 100 }); }
    if (denied) return Response.json({ code: 99991672, msg: 'upstream secret must not leak' });
    if (tokenFailures-- > 0) return Response.json({ code: 99991663 });
    if (url.includes('/drive/')) return Response.json({ code: 0, data: { files: [{ token: 'DocA', name: '星流科技业务介绍', type: 'docx' }, { token: 'PrivateDoc', name: 'Personal', type: 'docx' }], has_more: false } });
    return Response.json({ code: 0, data: { content: 'Real fixture source text' } });
  };
  return { client: fixtureClient(config, request, () => now), calls, get authRequests() { return authRequests; }, time(value) { now = value; }, failToken(n) { tokenFailures = n; }, deny() { denied = true; } };
}
test('real list response is filtered by allow-list and arbitrary reads fail before network access', async () => {
  const h = harness(); assert.deepEqual((await h.client.documents()).map(d => d.id), ['DocA']);
  const count = h.calls.length; await assert.rejects(h.client.read('PrivateDoc'), { kind: 'authorization' }); assert.equal(h.calls.length, count);
  assert.equal((await h.client.read('DocA')).content, 'Real fixture source text');
});



test('combined read fetches one list and one body while preserving live content and metadata', async () => {
  const h = harness();
  const result = await h.client.findAndRead(' 星流科技业务介绍 ');
  assert.equal(result.id, 'DocA');
  assert.equal(result.title, '星流科技业务介绍');
  assert.equal(result.content, 'Real fixture source text');
  assert.equal(h.calls.filter(url => url.includes('/drive/')).length, 1);
  assert.equal(h.calls.filter(url => url.includes('/raw_content')).length, 1);
  await assert.rejects(h.client.findAndRead('Personal'), /未找到/);
  await assert.rejects(h.client.findAndRead('星流科技'), /未找到/);
  assert.equal(h.calls.filter(url => url.includes('/raw_content')).length, 1);
  const count = h.calls.length;
  await assert.rejects(h.client.findAndRead(' '), /完整/);
  assert.equal(h.calls.length, count);
});

test('combined lookup detects ambiguous titles on later pages before reading any body', async () => {
  const calls = [];
  const client = fixtureClient({ ...config, documentIds: ['DocA', 'DocB'] }, async url => {
    calls.push(url);
    if (url.includes('/auth/')) return Response.json({code:0, tenant_access_token:'fixture-token', expire:100});
    assert.ok(url.includes('/drive/'));
    const second = new URL(url).searchParams.has('page_token');
    return Response.json({code:0,data:{files:[{token:second?'DocB':'DocA',name:'星流科技业务介绍',type:'docx'}],has_more:!second,next_page_token:second?undefined:'page-two'}});
  });
  await assert.rejects(client.findAndRead('星流科技业务介绍'), /同名/);
  assert.equal(calls.filter(url=>url.includes('/drive/')).length,2);
});

test('combined read fails if permissions are revoked after listing, without retrying or leaking upstream text', async () => {
  let bodyCalls = 0;
  const client = fixtureClient(config, async url => {
    if (url.includes('/auth/')) return Response.json({code:0, tenant_access_token:'fixture-token', expire:100});
    if (url.includes('/drive/')) return Response.json({code:0,data:{files:[{token:'DocA',name:'星流科技业务介绍',type:'docx'}],has_more:false}});
    bodyCalls++;
    return Response.json({code:99991672,msg:'private upstream details'});
  });
  await assert.rejects(client.findAndRead('星流科技业务介绍'), e=>e.kind==='authorization'&&!e.message.includes('private'));
  assert.equal(bodyCalls,1);
});

test('mixed resources retain live types and links without widening body access', async () => {
  const calls = [];
  const files = [
    { token: 'DocA', name: '星流科技业务介绍', type: 'docx', url: 'https://team.feishu.cn/docx/DocA' },
    { token: 'Weekly', name: '本周招聘进展', type: 'docx', url: 'https://team.feishu.cn/docx/Weekly' },
    { token: 'BaseA', name: '候选人招聘进度', type: 'bitable', url: 'https://team.feishu.cn/base/BaseA' },
    { token: 'SheetA', name: 'Q3 招聘计划与编制', type: 'sheet', url: 'https://team.feishu.cn/sheets/SheetA' },
    { token: 'Private', name: '其他资料', type: 'sheet' },
  ];
  const client = fixtureClient({ ...config, resourceIds: ['Weekly', 'BaseA', 'SheetA'], wikiNodeIds: ['WikiA'] }, async url => {
    calls.push(url);
    if (url.includes('/auth/')) return Response.json({code:0, tenant_access_token:'fixture-token', expire:100});
    if (url.includes('/drive/')) return Response.json({code:0,data:{files,has_more:false}});
    if (url.includes('/wiki/')) return Response.json({code:0,data:{node:{node_token:'WikiA',title:'招聘与面试 FAQ',obj_edit_time:'1800000000'}}});
    return Response.json({code:0,data:{content:'业务介绍'}});
  });
  const items = await client.documents();
  assert.deepEqual(items.map(item => item.type), ['docx', 'docx', 'bitable', 'sheet', 'wiki']);
  assert.deepEqual(items.filter(item => item.readable).map(item => item.id), ['DocA']);
  assert.equal(items.at(-1).url, 'https://team.feishu.cn/wiki/WikiA');
  const count = calls.length;
  for (const id of ['Weekly', 'BaseA', 'SheetA', 'WikiA']) await assert.rejects(client.read(id), {kind:'authorization'});
  assert.equal(calls.length, count);
  await assert.rejects(client.findAndRead('候选人招聘进度'), /未找到/);
  assert.equal(calls.filter(url => url.includes('/raw_content')).length, 0);
  assert.deepEqual((await client.documents('FAQ')).map(item => item.id), ['WikiA']);
  files.pop(); files.splice(2,1);
  assert.ok(!(await client.documents()).some(item => item.id === 'BaseA'));
});

test('unavailable wiki cannot block reading the business document or leak arbitrary links', async () => {
  const client = fixtureClient({ ...config, resourceIds: ['SheetA'], wikiNodeIds: ['WikiA'] }, async url => {
    if (url.includes('/auth/')) return Response.json({code:0, tenant_access_token:'fixture-token', expire:100});
    if (url.includes('/wiki/')) return Response.json({code:99991672,msg:'private details'});
    if (url.includes('/drive/')) return Response.json({code:0,data:{files:[
      {token:'DocA',name:'星流科技业务介绍',type:'docx',url:'https://team.feishu.cn/docx/DocA'},
      {token:'SheetA',name:'招聘计划',type:'sheet',url:'https://feishu.cn.attacker.invalid/sheets/SheetA'},
    ],has_more:false}});
    return Response.json({code:0,data:{content:'当前飞书正文'}});
  });
  await assert.rejects(client.documents(), {kind:'authorization'});
  assert.equal((await client.findAndRead('星流科技业务介绍')).content, '当前飞书正文');
  assert.equal((await client.read('DocA')).content, '当前飞书正文');
  const withoutWiki = fixtureClient({ ...config, resourceIds: ['SheetA'] }, async url => {
    if (url.includes('/auth/')) return Response.json({code:0,tenant_access_token:'fixture',expire:100});
    return Response.json({code:0,data:{files:[{token:'SheetA',name:'招聘计划',type:'sheet',url:'javascript:alert(1)'}],has_more:false}});
  });
  assert.equal((await withoutWiki.documents())[0].url, undefined);
});
