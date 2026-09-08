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
