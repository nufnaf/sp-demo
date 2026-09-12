export function selectedCalendar(state, name) {
  const end = state.elements.findIndex(e => e.role === 'AXMenuBar');
  const elements = end < 0 ? state.elements : state.elements.slice(0, end);
  const save = elements.findIndex(e => e.role === 'AXButton' && e.label === '保存');
  if (save < 0 || !name) return false;
  const labels = elements.map((element, index) => ({ element, index })).filter(({ element }) => element.value === name || element.label === name);
  const fields = labels.filter(({ element, index }) => index < save && element.role === 'AXStaticText'
    && elements[index + 1]?.role === 'AXComboBox' && elements[index + 1].parentIndex === element.parentIndex);
  if (fields.length !== 1) return false;
  // Feishu exposes the selected field as a static label immediately followed
  // by its combobox, before Save. Picker options and the availability sidebar
  // are not the selected field, even when their text happens to match.
  // A personal calendar repeats its owner's name in the right availability
  // panel. Permit that duplicate only when geometry proves it is beyond the
  // left form's Save button. A popup option or ambiguous duplicate still fails.
  const saveFrame = elements[save].frame;
  return labels.every(({ element, index }) => index === fields[0].index
    || (index > save && saveFrame && element.frame && element.role === 'AXStaticText'
      && element.frame.x > saveFrame.x + saveFrame.w));
}
export function participantElements(state) {
  const title = state.elements.findIndex(e => e.role === 'AXTextField');
  const date = state.elements.findIndex(e => /^\d{4}年\d{1,2}月\d{1,2}日$/.test(e.value ?? ''));
  return title >= 0 && date > title ? state.elements.slice(title + 1, date) : [];
}
export function participantSignature(state) {
  return JSON.stringify(participantElements(state).map(e => [e.role, e.label ?? '', e.value ?? '']));
}
export function assertCalendarAction(state, action) {
  if (!state) throw new Error('请先观察飞书。');
  const element = state.elements.find(e => e.elementToken === action.elementToken);
  if (action.kind === 'setValue' && !['AXTextField', 'AXTextArea'].includes(element?.role)) throw new Error('只能编辑标题、时间和说明。');
  if (action.kind !== 'click') return;
  const gx = state.windowBounds?.x + action.x * state.windowBounds?.width / state.screenshotWidth;
  const gy = state.windowBounds?.y + action.y * state.windowBounds?.height / state.screenshotHeight;
  const forbidden = [...participantElements(state), ...state.elements.filter(e => /^(保存|发送|发送邀请|删除|确认删除)$/.test(e.label ?? ''))];
  if (forbidden.some(e => (action.elementToken && e.elementToken === action.elementToken)
    || (e.frame && gx >= e.frame.x && gx <= e.frame.x + e.frame.w && gy >= e.frame.y && gy <= e.frame.y + e.frame.h))) {
    throw new Error('不能修改实际参会人；保存会议请使用专用核验工具。');
  }
}
