import { renderedDescription } from './draft-validation.mjs';

const DATE = /^\d{4}年\d{1,2}月\d{1,2}日$/;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const one = (items, name) => {
  if (items.length !== 1) throw new Error(`${name}无法唯一识别（${items.length} 个匹配）。`);
  return items[0];
};
export function formElements(state) {
  const end = state.elements.findIndex(e => e.role === 'AXMenuBar');
  return end < 0 ? state.elements : state.elements.slice(0, end);
}
export function timeFields(state) {
  const elements = formElements(state);
  const dates = elements.filter(e => DATE.test(e.value ?? '') && e.frame).sort((a, b) => a.frame.x - b.frame.x);
  if (dates.length !== 2) throw new Error('无法识别同一日程的两个日期控件。');
  const times = elements.filter(e => ['AXStaticText', 'AXTextField'].includes(e.role) && TIME.test(e.value ?? '') && e.frame
    && Math.abs(e.frame.y - dates[0].frame.y) < 20 && e.frame.x > dates[0].frame.x && e.frame.x < dates[1].frame.x)
    .sort((a, b) => a.frame.x - b.frame.x);
  if (times.length !== 2) throw new Error('无法唯一识别表单中的开始和结束时间。');
  return times;
}
function titleField(state) {
  const elements = formElements(state);
  const firstDate = elements.findIndex(e => DATE.test(e.value ?? ''));
  if (firstDate < 0) throw new Error('当前不是已识别的日程表单。');
  return one(elements.slice(0, firstDate).filter(e => e.role === 'AXTextField'), '标题输入框');
}
function visible(state, element) {
  // AX-only observations omit screenshot geometry but still include the native
  // window frame. Visibility must not depend on requesting an image.
  const window = formElements(state).find(e => e.role === 'AXWindow')?.frame;
  const f = element?.frame, b = state.windowBounds ?? (window && { ...window, width: window.w, height: window.h });
  return !!(f && b && f.w > 5 && f.h > 10 && f.x >= b.x && f.y >= b.y
    && f.x + f.w <= b.x + b.width && f.y + f.h <= b.y + b.height);
}
function center(state, element) {
  if (!visible(state, element) || state.screenshotFrameValid !== true) throw new Error('控件不在当前可见画面内。');
  const f = element.frame, b = state.windowBounds;
  return { x: (f.x + f.w / 2 - b.x) * state.screenshotWidth / b.width,
    y: (f.y + f.h / 2 - b.y) * state.screenshotHeight / b.height };
}
function descriptionAreas(state) {
  const elements = formElements(state);
  const save = one(elements.filter(e => e.role === 'AXButton' && e.label === '保存' && e.frame), '保存按钮');
  return elements.filter(e => e.role === 'AXTextArea' && visible(state, e)
    && e.frame.x + e.frame.w <= save.frame.x + save.frame.w && e.frame.y + e.frame.h <= save.frame.y);
}
function scrollAnchor(state) {
  // A real visible left-form control grounds scrolling; never use the time grid.
  return one(formElements(state).filter(e => e.role === 'AXButton' && e.label === '添加会议室' && visible(state, e)), '左侧表单滚动位置');
}

/** Bounded recipes, not a general macro executor. Every action is re-grounded;
 * adapters enforce editor ownership, pause/stop and the native action policy.
 * No queue is held across the recipe, and no recipe can save or invite anyone.
 */
export async function editCalendarField({ field, value }, { read, act, checkpoint, expected, onTrace = () => {} }) {
  let state, stage = 'validate', completed = [];
  const started = performance.now();
  const trace = (type, extra = {}) => onTrace({ type, field, stage, elapsedMs: Math.round(performance.now() - started), ...extra });
  const inspect = async (screenshot = false) => { await checkpoint(); state = await read(screenshot); return state; };
  const step = async (label, build, screenshot = false) => {
    stage = label;
    await inspect(screenshot);
    const action = { ...build(state), snapshotId: state.snapshotId };
    const start = performance.now();
    state = await act(action);
    completed.push(label);
    trace('field_action', { kind: action.kind, durationMs: Math.round(performance.now() - start) });
  };
  try {
    const requested = field === 'description' ? expected.description : expected.times[field === 'startTime' ? 0 : 1];
    if (!['startTime', 'endTime', 'description'].includes(field) || typeof value !== 'string' || value !== requested) throw new Error('字段和值必须与本次会议请求完全一致。');
    if (field !== 'description' && !TIME.test(value)) throw new Error('时间必须为 HH:mm。');
    await inspect();
    if (field !== 'description') {
      const index = field === 'startTime' ? 0 : 1;
      if (timeFields(state)[index].role !== 'AXStaticText' || timeFields(state)[index].value !== value) {
        await step('打开时间输入框', current => ({ kind: 'click', count: 2, ...center(current, timeFields(current)[index]) }), true);
        if (timeFields(state)[index].role !== 'AXTextField') throw new Error('时间控件未进入编辑状态。');
        await step('写入时间', current => {
          const element = timeFields(current)[index];
          if (element.role !== 'AXTextField') throw new Error('时间输入框已变化。');
          return { kind: 'setValue', elementToken: element.elementToken, text: value };
        });
        await step('提交时间', current => ({ kind: 'click', count: 2, ...center(current, titleField(current)) }), true);
      }
      stage = '核验已提交时间';
      const times = timeFields(state);
      if (times[index].role !== 'AXStaticText' || times[index].value !== value) throw new Error('时间尚未失焦提交或提交后的值不符。');
      trace('field_verified', { skipped: completed.length === 0 });
      return { state, status: 'verified', field, value, skipped: completed.length === 0, completed,
        times: times.map(e => ({ value: e.value, committed: e.role === 'AXStaticText' })) };
    }

    // Scroll at most four times to expose an editor. The anchor is re-discovered
    // after each scroll; if it disappears, return control rather than guess.
    for (let scrolls = 0; scrolls <= 4; scrolls++) {
      if (renderedDescription(formElements(state), value)) break;
      const areas = descriptionAreas(state);
      if (areas.length > 1) throw new Error('存在多个说明输入框。');
      if (areas.length === 1) break;
      const expand = formElements(state).filter(e => e.role === 'AXButton' && e.label === '添加描述' && visible(state, e));
      if (expand.length > 1) throw new Error('存在多个添加描述按钮。');
      if (expand.length === 1) {
        await step('展开说明', current => ({ kind: 'click', elementToken: one(formElements(current).filter(e => e.role === 'AXButton' && e.label === '添加描述' && visible(current, e)), '添加描述').elementToken }));
        if (descriptionAreas(state).length === 1) break;
      }
      if (scrolls === 4) throw new Error('说明未在有限滚动范围内出现。');
      await step('显示说明区域', current => ({ kind: 'scroll', direction: 'down', amount: 6, ...center(current, scrollAnchor(current)) }), true);
    }
    if (!renderedDescription(formElements(state), value)) {
      await step('写入完整说明', current => ({ kind: 'setValue', elementToken: one(descriptionAreas(current), '说明输入框').elementToken, text: value }));
      // The non-interactive “或” between the two meeting-note buttons is a
      // visible blur target. Require both neighbors and their current geometry;
      // do not click a setting label or invent a fixed blank-screen coordinate.
      await step('提交说明', current => {
        const elements = formElements(current);
        const left = one(elements.filter(e => e.role === 'AXButton' && e.label === '创建会议纪要' && visible(current, e)), '会议纪要区域');
        const right = one(elements.filter(e => e.role === 'AXButton' && e.label === '关联文档作为会议纪要' && visible(current, e)), '会议纪要关联区域');
        const neutral = one(elements.filter(e => e.role === 'AXStaticText' && e.value === '或' && visible(current, e)
          && e.frame.x >= left.frame.x + left.frame.w && e.frame.x + e.frame.w <= right.frame.x
          && Math.abs(e.frame.y - left.frame.y) < 15), '会议纪要间的中性文字');
        return { kind: 'click', count: 2, ...center(current, neutral) };
      }, true);
    }
    stage = '核验已提交说明';
    if (!renderedDescription(formElements(state), value)) throw new Error('尚未确认说明全文的可见渲染内容。');
    trace('field_verified', { skipped: completed.length === 0 });
    return { state, status: 'verified', field, value, skipped: completed.length === 0, completed };
  } catch (error) {
    // Cancellation is rethrown by checkpoint, never converted into a recoverable
    // field failure or followed by another GUI action.
    trace('field_refused', { code: 'unconfirmed', completed });
    throw Object.assign(error, { field, stage, completed, state });
  }
}
