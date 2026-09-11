import { setTimeout as delay } from 'node:timers/promises';
import { participantSignature, selectedCalendar } from './calendar-policy.mjs';

/** Track only the editor newly opened by this run, never an arbitrary named window. */
export function createCalendarEditor({ driver, initialWindows, read, checkpoint, onTarget, calendarName }) {
  let editorId, participants;
  const select = async (id, screenshot = false) => {
    await checkpoint();
    const windows = await driver.listWindows();
    const window = windows.find(w => String(w.windowId) === id);
    if (!window) throw new Error('飞书窗口已变化。');
    if (initialWindows.some(w => String(w.windowId) === id && w.title === '飞书')) {
      await driver.bind(id); onTarget(); return read(screenshot);
    }
    if (window.title !== '创建日程' || initialWindows.some(w => String(w.windowId) === id) || (editorId && editorId !== id)) throw new Error('只能进入本次新建的日程窗口。');
    if (String(driver.target?.windowId) !== id) { await driver.bind(id); onTarget(); }
    const state = await read(screenshot);
    if (!editorId) {
      const title = state.elements.find(e => e.role === 'AXTextField');
      if (!title) throw Object.assign(new Error('编辑器未就绪。'), { code: 'EDITOR_NOT_READY' });
      if (title.value?.trim() && title.value.trim() !== '添加主题') throw new Error('编辑器已有内容，不能覆盖。');
      editorId = id; participants = participantSignature(state);
    }
    return state;
  };
  return {
    select,
    get id() { return editorId; },
    assert(state, { requireCalendar = false } = {}) {
      if (!editorId || String(driver.target?.windowId) !== editorId || String(state?.windowId) !== editorId) throw new Error('请先进入本次新建的日程编辑窗口。');
      if (participantSignature(state) !== participants) throw new Error('参会人区域已变化，已停止填写。');
      if (requireCalendar && !selectedCalendar(state, calendarName)) throw new Error(`请先选择“${calendarName}”并关闭日历选择列表。`);
    },
    async wait(screenshot = false, timeoutMs = 4000) {
      const deadline = performance.now() + timeoutMs;
      do {
        await checkpoint();
        const candidates = (await driver.listWindows()).filter(w => w.title === '创建日程' && !initialWindows.some(old => String(old.windowId) === String(w.windowId)));
        if (candidates.length > 1) throw new Error('出现多个新日程窗口，请先确认要编辑的草稿。');
        if (candidates.length === 1) {
          try { return await select(String(candidates[0].windowId), screenshot); }
          catch (error) { if (error.code !== 'EDITOR_NOT_READY') throw error; }
        }
        await delay(100);
      } while (performance.now() < deadline);
      throw new Error('本次创建的日程窗口尚未出现；请观察当前状态，不要再次点击创建。');
    },
  };
}
