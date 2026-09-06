import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url);
const { readCrmState, updateCrmState, applyCompanyCrmSnapshot } = await jiti.import('./crm-store.ts');

test('CRM persists by workspace and enforces revisions, source replacement and disconnect', () => {
  const temp = mkdtempSync(join(tmpdir(), 'crm-store-test-'));
  const previous = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = temp;
  try {
    const cwd = join(temp, 'workspace-a');
    const other = join(temp, 'workspace-b');
    let state = updateCrmState(cwd, { revision: 0, action: 'connect-demo', sourceId: 'demo-crm' });
    assert.equal(readCrmState(cwd).sources[0].data.customers.length, 5);
    assert.equal(readCrmState(other).sources.length, 0);
    assert.throws(() => updateCrmState(cwd, { revision: 0, action: 'connect-demo', sourceId: 'demo-orders' }), /刷新/);
    const customer = state.sources[0].data.customers[0];
    state = updateCrmState(cwd, { revision: state.revision, action: 'save', data: { customers: [{ ...customer, name: '本地编辑' }] } });
    assert.equal(state.manual.customers[0].name, '本地编辑');
    assert.throws(() => updateCrmState(cwd, { revision: state.revision, action: 'save', data: { activities: [{ id: 'x', customerId: 'missing', date: '2026-09-06', summary: 'test' }] } }), /关联客户/);
    state = updateCrmState(cwd, { revision: state.revision, action: 'import', name: '真实数据', data: { customers: [{ ...customer, id: 'imported' }] } });
    state = updateCrmState(cwd, { revision: state.revision, action: 'import', name: '真实数据', data: { customers: [{ ...customer, id: 'imported', name: '替换快照' }] } });
    assert.equal(state.sources.length, 2);
    assert.equal(state.sources[1].data.customers[0].name, '替换快照');
    state = updateCrmState(cwd, { revision: state.revision, action: 'disconnect', sourceId: 'demo-crm' });
    assert.equal(state.manual.customers.length, 0);
    assert.equal(state.sources.length, 1);
    assert.equal(readCrmState(cwd).sources[0].name, '真实数据');
    const remote = { data: { customers: [{ ...customer, id: 'imported', name: '远端客户' }], orders: [], activities: [] }, meta: { sourceId: 'company-crm', sourceName: '星流 CRM', revision: 1, updatedAt: '2026-09-06T00:00:00Z', syntheticData: true } };
    const first = applyCompanyCrmSnapshot(cwd, 'https://crm.example.com', remote);
    assert.equal(first.changed, true);
    assert.equal(first.state.sources[0].data.customers[0].name, '替换快照');
    const synced = first.state.sources[1].data.customers[0];
    assert.equal(synced.id, 'company-crm:imported');
    const repeated = applyCompanyCrmSnapshot(cwd, 'https://crm.example.com', remote);
    assert.equal(repeated.changed, false);
    assert.equal(repeated.state.revision, first.state.revision);
    assert.throws(() => updateCrmState(cwd, { revision: first.state.revision, action: 'save', data: { customers: [synced] } }), /只读同步/);

  } finally {
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
    rmSync(temp, { recursive: true, force: true });
  }
});
