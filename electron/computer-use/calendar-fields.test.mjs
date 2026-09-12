import test from 'node:test';
import assert from 'node:assert/strict';
import { editCalendarField, timeFields } from './calendar-fields.mjs';

const expected = { title: '字段验收', date: '2026年9月12日', times: ['14:00', '14:30'], description: '讨论评价标准。\n确认后续分工。' };
function fixture({ description = false } = {}) {
  const e = (role, value, x, y, w = 60, h = 22) => ({ role, value, label: value, frame: { x, y, w, h } });
  const state = { windowId: 'editor', windowBounds: { x: 0, y: 0, width: 1000, height: 800 }, screenshotWidth: 1000, screenshotHeight: 800,
    elements: [e('AXTextField', expected.title, 30, 70, 500), e('AXStaticText', expected.date, 30, 150, 120),
      e('AXStaticText', '12:00', 180, 150), e('AXStaticText', '12:30', 270, 150), e('AXStaticText', expected.date, 360, 150, 120),
      e('AXButton', '添加会议室', 30, 270), e('AXButton', '创建会议纪要', 30, 330, 90), e('AXStaticText', '或', 130, 333, 14),
      e('AXButton', '关联文档作为会议纪要', 160, 330, 160), e('AXButton', '保存', 500, 740, 80)] };
  let id = 0, expanded = !description, scrolls = 0;
  const actions = [], checkpoints = [], controller = new AbortController();
  const refresh = screenshot => {
    state.snapshotId = String(++id); state.screenshotFrameValid = screenshot;
    state.elements.forEach((item, i) => { item.elementIndex = String(i); item.elementToken = `${id}:${i}`; });
    const result = structuredClone(state);
    result.elements.unshift({ role: 'AXWindow', frame: { x: 0, y: 0, w: 1000, h: 800 } });
    // Production AX-only reads have no screenshot/windowBounds properties.
    if (!screenshot) { delete result.windowBounds; delete result.screenshotWidth; delete result.screenshotHeight; }
    return result;
  };
  const adapter = {
    expected,
    checkpoint: async () => { controller.signal.throwIfAborted(); checkpoints.push(id); },
    read: async screenshot => refresh(screenshot),
    act: async action => {
      assert.equal(action.snapshotId, state.snapshotId, 'must act on the freshly read snapshot');
      if (action.elementToken) assert.ok(state.elements.some(e => e.elementToken === action.elementToken), 'must use the new token');
      actions.push(action);
      if (action.kind === 'scroll') { scrolls++; if (scrolls === 1) state.elements.push(e('AXButton', '添加描述', 30, 420)); }
      else if (action.kind === 'setValue') {
        state.elements.find(e => e.elementToken === action.elementToken).value = action.text;
      } else if (action.kind === 'click') {
        if (action.elementToken) {
          const item = state.elements.find(e => e.elementToken === action.elementToken);
          assert.equal(item.label, '添加描述'); expanded = true;
          state.elements.push(e('AXTextArea', '', 30, 400, 500, 120));
        } else if (action.y < 180 && action.y > 140) {
          const index = action.x < 260 ? 2 : 3;
          state.elements[index].role = 'AXTextField';
        } else {
          for (const item of state.elements.slice(2, 4)) item.role = 'AXStaticText';
          if (state.elements[2].value === '14:00') state.elements[3].value = '14:30';
          const area = state.elements.find(e => e.role === 'AXTextArea');
          if (expanded && area?.value) state.elements.push(e('AXStaticText', area.value, 40, 430, 250, 40));
        }
      }
      return refresh(false);
    },
  };
  return { state, actions, adapter, controller, checkpoints };
}

test('time recipe re-grounds each action, commits the value and reports linked end time', async () => {
  const f = fixture();
  const result = await editCalendarField({ field: 'startTime', value: '14:00' }, f.adapter);
  assert.equal(result.status, 'verified');
  assert.deepEqual(result.times, [{ value: '14:00', committed: true }, { value: '14:30', committed: true }]);
  assert.deepEqual(f.actions.map(a => a.kind), ['click', 'setValue', 'click']);
  const skipped = await editCalendarField({ field: 'endTime', value: '14:30' }, f.adapter);
  assert.equal(skipped.skipped, true); assert.equal(f.actions.length, 3);
});
test('description handles scrolling and expansion, then checks rendered multi-line content after blur', async () => {
  const f = fixture({ description: true });
  const result = await editCalendarField({ field: 'description', value: expected.description }, f.adapter);
  assert.equal(result.status, 'verified');
  assert.deepEqual(f.actions.map(a => a.kind), ['scroll', 'click', 'setValue', 'click']);
  assert.equal(f.actions[2].text, expected.description);
});
test('ambiguous time controls fail before mutation, and unrelated sidebar hours do not match', async () => {
  const f = fixture();
  f.state.elements.push({ role: 'AXStaticText', value: '14:00', frame: { x: 800, y: 150, w: 50, h: 22 } });
  assert.equal(timeFields(f.state).length, 2);
  f.state.elements.push(structuredClone(f.state.elements[2]));
  await assert.rejects(editCalendarField({ field: 'startTime', value: '14:00' }, f.adapter), /无法唯一识别/);
  assert.equal(f.actions.length, 0);
});
test('unexpected post-click state returns partial progress and never sends the remaining writes', async () => {
  const f = fixture();
  const original = f.adapter.act;
  f.adapter.act = async action => { const state = await original(action); timeFields(state)[0].role = 'AXStaticText'; return state; };
  await assert.rejects(editCalendarField({ field: 'startTime', value: '14:00' }, f.adapter), error => {
    assert.deepEqual(error.completed, ['打开时间输入框']); return /未进入编辑状态/.test(error.message);
  });
  assert.equal(f.actions.length, 1);
});
test('pause between internal actions waits, then re-reads before continuing', async () => {
  const f = fixture();
  let resume, paused;
  const reached = new Promise(resolve => { paused = resolve; });
  const gate = new Promise(resolve => { resume = resolve; });
  f.adapter.checkpoint = async () => { if (f.actions.length === 1) { paused(); await gate; } };
  const pending = editCalendarField({ field: 'startTime', value: '14:00' }, f.adapter);
  await reached; assert.equal(f.actions.length, 1);
  // While paused, a separate preview/read can invalidate all previous tokens.
  await f.adapter.read(false);
  resume(); await pending;
  assert.equal(f.actions.length, 3);
});
test('stop between actions never issues later input; ownership refusal also stops the recipe', async () => {
  const f = fixture(); const original = f.adapter.act;
  f.adapter.act = async action => { const state = await original(action); f.controller.abort(new Error('stopped')); return state; };
  await assert.rejects(editCalendarField({ field: 'startTime', value: '14:00' }, f.adapter), /stopped/);
  assert.equal(f.actions.length, 1);
  const changed = fixture(); changed.adapter.read = async () => { throw new Error('窗口已变化'); };
  await assert.rejects(editCalendarField({ field: 'description', value: expected.description }, changed.adapter), /窗口已变化/);
  assert.equal(changed.actions.length, 0);
});
test('arbitrary fields and values are rejected without touching native controls', async () => {
  for (const params of [{ field: 'attendees', value: 'someone' }, { field: 'startTime', value: '13:00' }]) {
    const f = fixture(); await assert.rejects(editCalendarField(params, f.adapter), /字段和值/); assert.equal(f.actions.length, 0);
  }
});

test('ambiguous description editors and missing scroll anchors stop without writing', async () => {
  const f = fixture({ description: true });
  const area = { role: 'AXTextArea', frame: { x: 30, y: 400, w: 400, h: 100 } };
  f.state.elements.push(area, structuredClone(area));
  await assert.rejects(editCalendarField({ field: 'description', value: expected.description }, f.adapter), /多个说明/);
  assert.equal(f.actions.length, 0);
  const missing = fixture({ description: true });
  missing.state.elements = missing.state.elements.filter(e => e.label !== '添加会议室');
  await assert.rejects(editCalendarField({ field: 'description', value: expected.description }, missing.adapter), /滚动位置/);
  assert.equal(missing.actions.length, 0);
});

test('hidden textarea is ignored; editor value alone does not prove description was committed', async () => {
  const f = fixture({ description: true });
  f.state.elements.push({ role: 'AXTextArea', frame: { x: 0, y: 0, w: 50, h: 2 } });
  const original = f.adapter.act;
  f.adapter.act = async action => {
    const state = await original(action);
    state.elements = state.elements.filter(e => e.role !== 'AXStaticText' || e.value !== expected.description);
    return state;
  };
  await assert.rejects(editCalendarField({ field: 'description', value: expected.description }, f.adapter), /可见渲染/);
  assert.deepEqual(f.actions.map(a => a.kind), ['scroll', 'click', 'setValue', 'click']);
});
