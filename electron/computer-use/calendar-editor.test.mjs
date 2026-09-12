import test from 'node:test';
import assert from 'node:assert/strict';
import { createCalendarEditor } from './calendar-editor.mjs';

function fixture() {
  const main = { windowId: 'main', title: '飞书' };
  const window = { windowId: 'new', title: '创建日程' };
  const state = { windowId: 'new', elements: [
    { role: 'AXTextField', value: '添加主题' },
    { role: 'AXComboBox', label: '添加联系人' },
    { role: 'AXStaticText', value: '2026年9月12日' },
    { role: 'AXStaticText', value: '目标日历', parentIndex: 'form' },
    { role: 'AXComboBox', parentIndex: 'form' },
    { role: 'AXButton', label: '保存' },
  ] };
  const f = { state, windows: [main, window], reads: [], binds: [], controller: new AbortController() };
  f.driver = { target: { windowId: 'main' }, listWindows: async () => f.windows,
    bind: async id => { f.binds.push(id); f.driver.target = { windowId: id }; } };
  f.options = { driver: f.driver, initialWindows: [main], calendarName: '目标日历', onTarget: () => {},
    checkpoint: async () => f.controller.signal.throwIfAborted(),
    read: async screenshot => { f.reads.push(screenshot); return structuredClone(f.state); } };
  return f;
}

test('wait adopts only the newly opened empty editor and returns requested screenshot state', async () => {
  const f = fixture(), editor = createCalendarEditor(f.options);
  const state = await editor.wait(true);
  assert.equal(editor.id, 'new'); assert.deepEqual(f.reads, [true]);
  editor.assert(state, { requireCalendar: true });
  state.elements[1].value = 'someone';
  assert.throws(() => editor.assert(state), /参会人/);
  f.driver.target.windowId = 'other';
  assert.throws(() => editor.assert(f.state), /本次新建/);
});

test('existing, nonempty and ambiguous editors are never adopted', async () => {
  const existing = fixture(); existing.options.initialWindows.push(existing.windows[1]);
  await assert.rejects(createCalendarEditor(existing.options).select('new'), /本次新建/);
  assert.equal(existing.binds.length, 0);
  const nonempty = fixture(); nonempty.state.elements[0].value = '用户草稿';
  const editor = createCalendarEditor(nonempty.options);
  await assert.rejects(editor.wait(), /已有内容/); assert.equal(editor.id, undefined);
  const ambiguous = fixture(); ambiguous.windows.push({ windowId: 'other', title: '创建日程' });
  await assert.rejects(createCalendarEditor(ambiguous.options).wait(), /多个/);
  assert.equal(ambiguous.binds.length, 0);
});

test('delayed AX readiness can be observed again without another create click or bind', async () => {
  const f = fixture(); let reads = 0;
  f.options.read = async () => ++reads === 1 ? { windowId: 'new', elements: [] } : structuredClone(f.state);
  const editor = createCalendarEditor(f.options);
  await editor.wait(false, 1000);
  assert.equal(editor.id, 'new'); assert.equal(reads, 2); assert.deepEqual(f.binds, ['new']);
});

test('timeout and cancellation do not adopt a window or issue actions', async () => {
  const f = fixture(); f.windows = [f.windows[0]];
  const editor = createCalendarEditor(f.options);
  await assert.rejects(editor.wait(false, 0), /不要再次点击创建/);
  f.controller.abort(new Error('stopped'));
  await assert.rejects(editor.wait(), /stopped/);
  assert.equal(editor.id, undefined); assert.equal(f.binds.length, 0);
});

test('a second editor cannot replace the adopted one, and calendar changes block edits', async () => {
  const f = fixture(), editor = createCalendarEditor(f.options);
  await editor.wait(); f.windows.push({ windowId: 'other', title: '创建日程' });
  await assert.rejects(editor.select('other'), /本次新建/);
  f.state.elements[3].value = '其他日历';
  assert.throws(() => editor.assert(f.state, { requireCalendar: true }), /选择/);
});
