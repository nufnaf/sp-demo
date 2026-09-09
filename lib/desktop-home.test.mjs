import assert from 'node:assert/strict';
import test from 'node:test';
import { recruitingHomeSchedule } from './desktop-home.ts';

test('home appointments use the displayed local day, without mutating the clock', () => {
  const now = new Date(2026, 8, 9, 23, 59);
  const original = now.getTime();
  const events = recruitingHomeSchedule(now, null);
  assert.equal(events.length, 2);
  assert.equal(new Set(events.map(event => event.id)).size, 2);
  assert.ok(events.every(event => event.simulated && new Date(event.startsAt).getDate() === 9));
  assert.deepEqual(events.map(event => new Date(event.startsAt).getHours()), [10, 16]);
  assert.ok(events.every(event => Date.parse(event.endsAt) - Date.parse(event.startsAt) === 1_800_000));
  assert.equal(now.getTime(), original);
});

test('an arranged meeting keeps its actual date and full details, even on another day', () => {
  const now = new Date(2026, 8, 9, 12);
  const meeting = Object.freeze({ id: 'alignment-job-1', title: '面试标准对齐', startsAt: new Date(2026, 8, 10, 14).toISOString(), endsAt: new Date(2026, 8, 10, 14, 30).toISOString(), attendees: ['招聘负责人'], agenda: ['对齐评价标准'], simulated: true });
  const events = recruitingHomeSchedule(now, meeting);
  assert.equal(events.length, 3);
  assert.strictEqual(events[2], meeting);
  assert.equal(new Date(events[2].startsAt).getDate(), 10);
});
