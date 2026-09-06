import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url);
const { companyCrmDemoReport, isCompanyCrmDemo } = await jiti.import('./company-crm-demo-report.ts');
const url = 'https://company-crm-site.vercel.app';
const source = {
  id: 'company-crm', mode: 'remote', baseUrl: url, syntheticData: true, remoteRevision: 3, syncedAt: '2026-09-06T00:00:00Z',
  data: {
    customers: [{ id: 'company-crm:yunzhou', name: '云舟制造', contact: '<script>alert(1)</script>', owner: '林一', note: '验收签字后付款' }],
    orders: [{ id: 'company-crm:SO-26001', customerId: 'company-crm:yunzhou', title: '年度订阅', amount: 420000, paid: 300000, dueDate: '2026-08-25', status: '执行中' }],
    activities: [{ id: 'follow-2', customerId: 'company-crm:yunzhou', date: '2026-09-05', summary: '验收报告尚未签字，缺少培训附件。' }],
  },
};
test('demo is restricted to our synthetic website and derives escaped evidence and amounts', () => {
  assert.equal(isCompanyCrmDemo('https://other.example.com', true), false);
  assert.equal(isCompanyCrmDemo(url, false), false);
  const result = companyCrmDemoReport(source, Date.parse('2026-09-06'));
  assert.match(result.title, /120,000/);
  assert.match(result.html, /&lt;script&gt;/);
  assert.doesNotMatch(result.html, /<script>alert\(1\)/);
  const changed = structuredClone(source); changed.data.orders[0].paid = 350000;
  assert.match(companyCrmDemoReport(changed).title, /70,000/);
  changed.data.orders[0].paid = 420000;
  assert.equal(companyCrmDemoReport(changed), null);
  const resolved = structuredClone(source); resolved.data.activities.push({ id: 'new', customerId: 'company-crm:yunzhou', date: '2026-09-06', summary: '验收已通过，财务确认周五付款。' });
  assert.equal(companyCrmDemoReport(resolved), null);
});
test('connection demo emits once at ten seconds; reconnect resets timer and disconnect cancels it', async (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'crm-demo-'));
  const previous = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = temp;
  const { applyCompanyCrmSnapshot, updateCrmState, readCrmState } = await jiti.import('./crm-store.ts');
  const { scheduleCompanyCrmInsight, cancelCompanyCrmInsight } = await jiti.import('./company-crm-demo-insight.ts');
  const { listInsightResults } = await jiti.import('./insight-event-store.ts');
  try {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse('2026-09-06') });
    const data = structuredClone(source.data);
    for (const rows of Object.values(data)) for (const row of rows) { row.id = row.id.replace('company-crm:', ''); if (row.customerId) row.customerId = row.customerId.replace('company-crm:', ''); }
    applyCompanyCrmSnapshot(temp, url, { data, meta: { sourceName: '星流 CRM', sourceId: 'company-crm', revision: 3, syntheticData: true } });
    scheduleCompanyCrmInsight(temp);
    t.mock.timers.tick(9999); assert.equal(listInsightResults(temp).length, 0);
    t.mock.timers.tick(1); assert.equal(listInsightResults(temp).length, 1);
    t.mock.timers.tick(60000); assert.equal(listInsightResults(temp).length, 1);
    scheduleCompanyCrmInsight(temp); t.mock.timers.tick(5000); scheduleCompanyCrmInsight(temp);
    t.mock.timers.tick(5000); assert.equal(listInsightResults(temp).length, 1);
    t.mock.timers.tick(5000); assert.equal(listInsightResults(temp).length, 2);
    scheduleCompanyCrmInsight(temp); cancelCompanyCrmInsight(temp); t.mock.timers.tick(10000);
    assert.equal(listInsightResults(temp).length, 2);
    scheduleCompanyCrmInsight(temp);
    updateCrmState(temp, { action: 'disconnect', sourceId: 'company-crm', revision: readCrmState(temp).revision });
    t.mock.timers.tick(10000); assert.equal(listInsightResults(temp).length, 2);
  } finally {
    cancelCompanyCrmInsight(temp); t.mock.timers.reset();
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = previous;
    delete globalThis.__piInsightState;
    rmSync(temp, { recursive: true, force: true });
  }
});
test('portfolio charts calculate outstanding balances and exclude cancelled orders', () => {
  const data = structuredClone(source);
  data.data.orders.push(
    { id: 'other', customerId: 'company-crm:yunzhou', title: '第二订单', amount: 200000, paid: 80000, dueDate: '2026-10-01', status: '执行中' },
    { id: 'cancelled', customerId: 'company-crm:yunzhou', title: '取消订单', amount: 900000, paid: 0, dueDate: '2026-08-01', status: '已取消' },
  );
  const report = companyCrmDemoReport(data, Date.parse('2026-09-06T08:00:00Z'));
  assert.match(report.html, /未收款合计 ¥240,000/);
  assert.match(report.html, /其中逾期 ¥120,000，涉及 1 笔订单/);
  assert.match(report.html, /50\.0%/);
  assert.match(report.html, /71\.4%/);
  assert.match(report.html, /<svg[^>]+role="img"/);
  assert.doesNotMatch(report.html, /900,000/);
  assert.match(report.html, /id="evidence-1"/);
});
