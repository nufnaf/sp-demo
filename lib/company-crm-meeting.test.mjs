import assert from 'node:assert/strict';
import test from 'node:test';
import { createJiti } from 'jiti';
const { crmMeetingProposal } = await createJiti(import.meta.url).import('./company-crm-meeting.ts');
const source = { data: { customers: [{ id: 'company-crm:yunzhou', name: '云舟制造', owner: '林一', contact: '周远 · 信息化总监 / 刘敏 · 财务 / 陈工 · 验收负责人', note: '销售负责人林一，交付负责人许航；客户验收负责人陈工。' }] } };
test('meeting is led by Lin Yi, contains related stakeholders and lasts thirty minutes on next weekday', () => {
  const friday = new Date(2026, 8, 4, 17, 0);
  const proposal = crmMeetingProposal(source, friday.getTime());
  const start = new Date(proposal.startsAt);
  assert.equal(start.getDay(), 1);
  assert.equal(start.getHours(), 10);
  assert.equal(new Date(proposal.endsAt) - start, 30 * 60000);
  assert.deepEqual(proposal.attendees.map(a => a.name), ['林一', '周远', '刘敏', '陈工', '许航']);
  assert.equal(proposal.agenda.length, 4);
  assert.equal(proposal.materials.length, 4);
});
