import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url);
const { FeishuDemoClient } = await jiti.import('./feishu-demo-client.ts');
const config = { appId: 'test-app', appSecret: 'test-only-secret', folderToken: 'demo-folder', documentIds: ['DocA'] };
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
  return { client: new FeishuDemoClient(config, request, () => now), calls, get authRequests() { return authRequests; }, time(value) { now = value; }, failToken(n) { tokenFailures = n; }, deny() { denied = true; } };
}
test('real list response is filtered by allow-list and arbitrary reads fail before network access', async () => {
  const h = harness(); assert.deepEqual((await h.client.documents()).map(d => d.id), ['DocA']);
  const count = h.calls.length; await assert.rejects(h.client.read('PrivateDoc'), { kind: 'authorization' }); assert.equal(h.calls.length, count);
  assert.equal((await h.client.read('DocA')).content, 'Real fixture source text');
});
test('concurrent reads share token acquisition and refresh before returned expiry', async () => {
  const h = harness(); await Promise.all([h.client.documents(), h.client.documents()]); assert.equal(h.authRequests, 1);
  h.time(79000); await h.client.documents(); assert.equal(h.authRequests, 1);
  h.time(81000); await h.client.documents(); assert.equal(h.authRequests, 2);
});
test('invalid token has one bounded refresh retry; authorization errors never echo upstream messages', async () => {
  const h = harness(); h.failToken(1); await h.client.documents(); assert.equal(h.authRequests, 2);
  h.failToken(3); await assert.rejects(h.client.documents(), /管理员/); assert.equal(h.authRequests, 3);
  h.deny(); await assert.rejects(h.client.documents(), (e) => !e.message.includes('upstream secret'));
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
  const client = new FeishuDemoClient({ ...config, documentIds: ['DocA', 'DocB'] }, async url => {
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
  const client = new FeishuDemoClient(config, async url => {
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
  const client = new FeishuDemoClient({ ...config, resourceIds: ['Weekly', 'BaseA', 'SheetA'], wikiNodeIds: ['WikiA'] }, async url => {
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
  const client = new FeishuDemoClient({ ...config, resourceIds: ['SheetA'], wikiNodeIds: ['WikiA'] }, async url => {
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
  const withoutWiki = new FeishuDemoClient({ ...config, resourceIds: ['SheetA'] }, async url => {
    if (url.includes('/auth/')) return Response.json({code:0,tenant_access_token:'fixture',expire:100});
    return Response.json({code:0,data:{files:[{token:'SheetA',name:'招聘计划',type:'sheet',url:'javascript:alert(1)'}],has_more:false}});
  });
  assert.equal((await withoutWiki.documents())[0].url, undefined);
});
