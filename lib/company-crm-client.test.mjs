import assert from 'node:assert/strict';
import test from 'node:test';
import { createJiti } from 'jiti';
const { normalizeCompanyCrmUrl, isPublicCrmAddress, parseRemoteCrmSnapshot } = await createJiti(import.meta.url).import('./company-crm-client.ts');
test('company CRM URLs cannot target local services or carry embedded credentials', () => {
  assert.equal(normalizeCompanyCrmUrl('https://company-crm-site.vercel.app/'), 'https://company-crm-site.vercel.app');
  for (const url of ['http://example.com', 'https://localhost', 'https://127.0.0.1', 'https://10.0.0.1', 'https://[::1]', 'https://example.com:444', 'https://user:pass@example.com', 'https://example.com/path', 'https://example.com?token=secret']) assert.throws(() => normalizeCompanyCrmUrl(url));
  for (const ip of ['127.0.0.1','10.0.0.1','192.168.1.1','169.254.169.254','100.64.1.1','::1','fc00::1','::ffff:127.0.0.1']) assert.equal(isPublicCrmAddress(ip), false, ip);
  assert.equal(isPublicCrmAddress('8.8.8.8'), true);
});
test('remote snapshot requires explicit data, provenance and a valid revision', () => {
  const snapshot = { data: { customers: [], orders: [], activities: [] }, meta: { sourceId: 'company-crm', sourceName: '星流 CRM', revision: 1, updatedAt: '2026-09-06T12:00:00Z', syntheticData: true } };
  assert.deepEqual(parseRemoteCrmSnapshot(snapshot), snapshot);
  assert.throws(() => parseRemoteCrmSnapshot({ ...snapshot, data: {} }), /缺少/);
  assert.throws(() => parseRemoteCrmSnapshot({ ...snapshot, meta: { ...snapshot.meta, revision: -1 } }), /版本/);
  assert.throws(() => parseRemoteCrmSnapshot({ ...snapshot, meta: { ...snapshot.meta, sourceId: 'other' } }), /版本/);
});
