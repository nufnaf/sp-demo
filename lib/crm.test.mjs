import assert from 'node:assert/strict';
import test from 'node:test';
import { crmDemoData, crmRecords, crmSignals, emptyCrmState, parseCrmData } from './crm.ts';
const now = Date.parse('2026-09-06T10:00:00Z');
function demo() { return { customers: crmDemoData('demo-crm', now).customers, orders: crmDemoData('demo-orders', now).orders, activities: crmDemoData('demo-activity', now).activities }; }
test('cross-source evidence detects stalled negotiations, overdue payment and expansion', () => {
  const signals = crmSignals(demo(), now);
  assert.deepEqual(signals.map(row => row.id), ['idle:xinglan', 'overdue:yunzhou', 'expansion:qinghe']);
  assert.match(signals[1].detail, /210,000/);
  assert.match(signals[1].detail, /验收报告/);
});
test('payment and follow-up changes resolve risk; cancelled orders are excluded', () => {
  const data = demo();
  data.orders[0].paid = data.orders[0].amount;
  data.activities.push({ id: 'new', customerId: 'xinglan', date: '2026-09-06', summary: '已确认下次沟通日期' });
  assert.deepEqual(crmSignals(data, now).map(row => row.id), ['expansion:qinghe']);
  data.orders[0].paid = 0; data.orders[0].status = '已取消';
  assert.equal(crmSignals(data, now).some(row => row.id === 'overdue:yunzhou'), false);
});
test('local edits override source records without double counting', () => {
  const state = emptyCrmState();
  const data = demo();
  state.sources.push({ id: 'one', name: 'one', mode: 'import', syncedAt: '', data });
  state.sources.push({ id: 'two', name: 'two', mode: 'import', syncedAt: '', data });
  state.manual.customers = [{ ...data.customers[0], name: '更新客户' }];
  assert.equal(crmRecords(state).customers.length, 5);
  assert.equal(crmRecords(state).customers[0].name, '更新客户');
});
test('imports reject negative/invalid amounts, duplicate IDs, invalid stages and dates', () => {
  assert.deepEqual(parseCrmData(demo()), demo());
  for (const patch of [{ value: -1 }, { value: Infinity }, { stage: 'bad' }, { lastContact: '2026-02-30' }, { name: '' }]) {
    assert.throws(() => parseCrmData({ customers: [{ ...demo().customers[0], ...patch }] }));
  }
  assert.throws(() => parseCrmData({ customers: [demo().customers[0], demo().customers[0]] }), /重复/);
  assert.throws(() => parseCrmData({ orders: [{ ...demo().orders[0], paid: 999999 }] }), /不能超过/);
  assert.throws(() => parseCrmData({ orders: {} }), /数组/);
});
test('unlinked order source does not manufacture customers or signals', () => {
  const data = crmDemoData('demo-orders', now);
  assert.equal(data.customers.length, 0);
  assert.deepEqual(crmSignals(data, now), []);
});
