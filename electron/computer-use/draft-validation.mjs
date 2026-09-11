// Phase-zero Feishu form verification, independent of the model's success claim.
const normalized = value => value.replace(/\u200b/g, '').replace(/\s+/g, ' ').trim();
export function renderedDescription(elements, description) {
  const expected = normalized(description);
  const visibleText = elements.filter(e => e.role === 'AXStaticText' && e.frame?.h > 10);
  if (visibleText.some(e => normalized(e.value ?? '') === expected)) return true;
  // Feishu's rich-text editor exposes each paragraph as a separate rendered
  // child. Never combine unrelated sidebar text or trust the editor value alone.
  return elements.some(editor => editor.role === 'AXTextArea' && editor.elementIndex !== undefined && editor.frame?.h > 10
    && normalized(visibleText.filter(e => e.parentIndex === editor.elementIndex
      && e.frame.x >= editor.frame.x && e.frame.x + e.frame.w <= editor.frame.x + editor.frame.w
      && e.frame.y >= editor.frame.y && e.frame.y + e.frame.h <= editor.frame.y + editor.frame.h)
      .map(e => e.value ?? '').join('\n')) === expected);
}
export function validateDraft(state, expected) {
  const end = state.elements.findIndex(element => element.role === 'AXMenuBar');
  const elements = end < 0 ? state.elements : state.elements.slice(0, end);
  const dates = elements.filter(e => /^\d{4}年\d{1,2}月\d{1,2}日$/.test(e.value ?? '') && e.frame);
  const times = elements.filter(e => /^\d{2}:\d{2}$/.test(e.value ?? '') && e.frame && dates.length === 2
    && Math.abs(e.frame.y - dates[0].frame.y) < 20
    && e.frame.x > dates[0].frame.x && e.frame.x < dates[1].frame.x);
  const issues = [];
  if (!elements.some(e => e.role === 'AXTextField' && e.value === expected.title)) issues.push('标题尚未匹配');
  if (dates.length !== 2 || dates.some(e => e.value !== expected.date)) issues.push('开始或结束日期尚未匹配');
  if (times.length !== 2 || times.some((e, i) => e.value !== expected.times[i] || e.role !== 'AXStaticText')) {
    issues.push('时间必须在真实指针失焦后变回 AXStaticText，并保持指定值；输入框中的值不算完成');
  }
  if (!renderedDescription(elements, expected.description)) {
    issues.push('说明尚未提交并显示在表单中；请离开说明编辑器并滚动查看');
  }
  if (!elements.some(e => e.role === 'AXButton' && e.label === '保存')) issues.push('当前不是可核对的未保存编辑器');
  return { passed: issues.length === 0, issues,
    dates: dates.map(e => e.value), times: times.map(e => ({ value: e.value, role: e.role })) };
}
