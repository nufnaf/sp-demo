const componentDefinitions = {
  approvals: {
    category: 'system', title: '待我确认', icon: 'check', accent: '#b7791f', description: '集中查看需要人工决定的动作',
    summary: '所有对外发送、日历变更和关键写入都会在执行前等待确认。',
    metrics: [{ value: '3', label: '等待确认', trend: '2 项今天到期', tone: 'warning' }],
    items: [
      { title: '发送集中面试邀请', detail: '招聘任务 · 需要对外发送', value: '今天', tone: 'warning' },
      { title: '确认 Q3 发布范围', detail: '产品发布 · 影响 2 项需求', value: '待决定', tone: 'warning' },
    ], sources: ['任务中心', '审批记录'],
  },
  goals: {
    category: 'system', title: '目标进度', icon: 'spark', accent: '#2d8060', description: '跟踪当前工作台的业务结果',
    summary: '聚合任务、里程碑和结果信号，优先显示偏离目标的事项。',
    metrics: [{ value: '68%', label: '总体完成度', trend: '+8% 本周', tone: 'positive' }],
    items: [
      { title: '核心目标保持推进', detail: '4 项关键结果中 3 项正常', value: '正常', tone: 'positive' },
      { title: '1 项结果存在风险', detail: '需要补充资源或调整期限', value: '关注', tone: 'warning' },
    ], sources: ['当前任务', '工作台产物'],
  },
  connections: {
    category: 'system', title: '数据源状态', icon: 'database', accent: '#4f6fab', description: '查看连接、同步和数据新鲜度',
    summary: '当前工作台使用的数据源与最近同步状态。',
    metrics: [{ value: '3/3', label: '数据源可用', trend: '刚刚同步', tone: 'positive' }],
    items: [
      { title: '飞书', detail: '日历、文档与任务', value: '正常', tone: 'positive' },
      { title: '业务系统', detail: '演示数据连接', value: '正常', tone: 'positive' },
    ], sources: ['连接中心'],
  },
  artifacts: {
    category: 'system', title: '最近产物', icon: 'file', accent: '#6d63a8', description: '汇总任务最近生成的文件和报告',
    summary: '最近七天由 Syntropic 任务生成并固定到工作台的产物。',
    metrics: [{ value: '6', label: '本周产物', trend: '2 个待审阅', tone: 'warning' }],
    items: [
      { title: '用户反馈洞察.html', detail: '来自用户反馈分析任务', value: '刚刚', tone: 'positive' },
      { title: 'Q3 发布 Brief', detail: '来自产品发布任务', value: '昨天' },
    ], sources: ['任务产物'],
  },
  'candidate-risk': {
    category: 'generated', title: '候选人风险', icon: 'user', accent: '#c25c45', description: '根据等待时间和沟通信号生成',
    summary: '3 位高匹配候选人将在 48 小时内进入高流失窗口。',
    metrics: [{ value: '3', label: '高风险候选人', trend: '+1 今天', tone: 'warning' }],
    items: [
      { title: '林然', detail: '系统设计面试等待 6 天', value: '48h', tone: 'danger' },
      { title: '许宁', detail: '评委时间尚未锁定', value: '2 天', tone: 'warning' },
      { title: '苏悦', detail: '最近回复意愿下降', value: '3 天', tone: 'warning' },
    ], sources: ['Moka', '飞书', '团队日历'],
  },
  'interview-capacity': {
    category: 'generated', title: '面试产能', icon: 'calendar', accent: '#36785f', description: '关联候选人漏斗和评委日历生成',
    summary: '未来十个工作日的系统设计面试产能不足。',
    metrics: [{ value: '23', label: '等待面试', trend: '仅 4 个时段', tone: 'warning' }],
    items: [
      { title: '核心评委时段', detail: '陈建、周禾等 4 位评委', value: '4', tone: 'warning' },
      { title: '可启用备用评委', detail: '具备 Agent 系统经验', value: '3', tone: 'positive' },
    ], sources: ['Moka', '团队日历'],
  },
  'release-risk': {
    category: 'generated', title: '产品发布风险', icon: 'chart', accent: '#c25c45', description: '根据需求、测试和发布计划生成',
    summary: '当前发布计划有 2 项高风险依赖需要在本周内解决。',
    metrics: [{ value: '2', label: '高风险事项', trend: '发布前 5 天', tone: 'warning' }],
    items: [
      { title: '长任务状态恢复', detail: '稳定性压测未达到门槛', value: '阻塞', tone: 'danger' },
      { title: '权限文案确认', detail: '等待法务与产品确认', value: '今天', tone: 'warning' },
    ], sources: ['飞书', '项目任务', '发布计划'],
  },
  feedback: {
    category: 'generated', title: '用户反馈趋势', icon: 'message', accent: '#4f6fab', description: '聚合讨论、客户群和研究记录生成',
    summary: '用户最关注任务进展可见性、失败恢复和结果可追溯性。',
    metrics: [{ value: '126', label: '有效反馈', trend: '+18 本周', tone: 'positive' }],
    items: [
      { title: '任务进展不可见', detail: '37 条反馈 · 高影响', value: '29%', tone: 'warning' },
      { title: '希望结果可追溯', detail: '28 条反馈 · 持续上升', value: '22%' },
      { title: '失败后缺少恢复入口', detail: '19 条反馈', value: '15%', tone: 'danger' },
    ], sources: ['飞书', '企业微信', '用户研究'],
  },
};

const nativeSystemComponents = {
  'task-widget': { title: '当前任务', icon: 'message', description: '进行中、待确认与已完成任务' },
  'schedule-widget': { title: '日历', icon: 'calendar', description: '近期日程、会议与专注时间' },
  'stock-widget': { title: '市场关注', icon: 'chart', description: '关注公司与市场变化' },
};

let activeComponentId = null;
let activeManagedComponentId = null;
let componentUndoTimer = 0;
let componentUndoSnapshot = null;

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function managedOverride(id) {
  const dynamic = dynamicItems.find((item) => item.id === id && item.type !== 'ai-card');
  if (dynamic) {
    dynamic.componentOverride ||= {};
    return dynamic.componentOverride;
  }
  const canvas = getCurrentCanvas();
  canvas.componentOverrides ||= {};
  canvas.componentOverrides[id] ||= {};
  return canvas.componentOverrides[id];
}

function managedComponentRecord(id) {
  const object = canvasObjects.find((item) => item.dataset.objectId === id) || document.querySelector(`[data-object-id="${id}"]`);
  if (!object || object.matches('.canvas-ai-card')) return null;
  const dynamic = dynamicItems.find((item) => item.id === id);
  const titleTarget = object.querySelector(':scope > header strong, :scope > header [data-managed-title], .object-name, .canvas-file-copy strong');
  if (titleTarget && !object.dataset.managedDefaultTitle) object.dataset.managedDefaultTitle = titleTarget.textContent.trim();
  const override = managedOverride(id);
  const defaultTitle = object.dataset.managedDefaultTitle || object.dataset.widgetName || dynamic?.title || id;
  return {
    id, object, dynamic, override, titleTarget,
    title: override.title || defaultTitle,
    defaultTitle,
    summary: override.summary || dynamic?.summary || object.dataset.managedDefaultSummary || '当前工作台的默认组件',
    sources: dynamic?.sources || [currentCanvasId === 'hr-recruiting' ? '招聘工作台模板' : currentCanvasId === 'product-release' ? '产品工作台模板' : '系统组件'],
    createdBy: dynamic ? 'template' : 'system',
  };
}

function applyManagedOverride(id) {
  const record = managedComponentRecord(id);
  if (!record) return;
  if (record.titleTarget) record.titleTarget.textContent = record.title;
  record.object.dataset.managedTitle = record.title;
  record.object.title = record.override.summary || '';
}

function installManagedComponentControls(root = document) {
  root.querySelectorAll?.('.canvas-object:not(.canvas-ai-card)').forEach((object) => {
    const id = object.dataset.objectId;
    if (!id) return;
    object.classList.add('managed-default-component');
    applyManagedOverride(id);
    // The hover menu is folded into the unified header three-dot menu, so any
    // legacy floating controls are removed here.
    object.querySelectorAll(':scope > [data-managed-menu], :scope > .managed-component-menu').forEach((node) => node.remove());
  });
}

function refreshManagedComponentControls() {
  installManagedComponentControls(canvasWorld);
  canvasObjects.filter((object) => !object.matches('.canvas-ai-card')).forEach((object) => applyManagedOverride(object.dataset.objectId));
}

function saveManagedRecord(record, changes) {
  Object.assign(record.override, changes, { updatedAt:new Date().toISOString(), version:(record.override.version || 0) + 1 });
  if (record.dynamic) saveDynamicItems(); else saveCanvasRegistry();
  applyManagedOverride(record.id);
}

function openManagedComponentDetail(record) {
  document.querySelector('.component-detail-layer')?.remove();
  const layer = document.createElement('div');
  layer.className = 'component-detail-layer';
  layer.dataset.managedId = record.id;
  layer.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="managedDetailTitle"><header><span><small>${record.createdBy === 'system' ? '系统默认组件' : '工作台模板组件'}</small><strong id="managedDetailTitle">查看与编辑组件</strong></span><button type="button" data-component-detail-close aria-label="关闭"><span data-icon="close"></span></button></header><div><label>组件名称<input data-managed-detail-title maxlength="30" /></label><label>组件说明<textarea data-managed-detail-summary maxlength="160"></textarea></label><section><strong>组件来源</strong><p>${record.sources.join(' · ')}</p><p>默认名称：${workspaceNameHTML(record.defaultTitle)}</p><p>当前配置版本：v${record.override.version || 0}</p></section></div><footer><button type="button" data-managed-detail-reset>恢复默认</button><button type="button" data-managed-detail-ai>用 Syntropic 修改</button><button class="primary" type="button" data-managed-detail-save>保存修改</button></footer></section>`;
  document.body.appendChild(layer); hydrateIcons(layer);
  layer.querySelector('[data-managed-detail-title]').value = record.title;
  layer.querySelector('[data-managed-detail-summary]').value = record.summary;
  requestAnimationFrame(() => layer.classList.add('visible'));
}

function focusManagedComponentInAI(record) {
  activeManagedComponentId = record.id;
  activeComponentId = null;
  aiInput.value = `@${record.title} `;
  setAIComposerExpanded(true); suggestions(false); aiInput.focus();
  aiInput.setSelectionRange(aiInput.value.length, aiInput.value.length);
  showToast(`已引用默认组件：${record.title}`);
}

function updateManagedComponentFromPrompt(record, prompt) {
  const clean = prompt.replace(new RegExp(`^@${escapeRegExp(record.title)}\\s*`), '').trim();
  if (/(删除|移除|取消固定)/.test(clean)) { activeManagedComponentId = null; removeManagedComponent(record); return true; }
  if (/(查看|来源|详情)/.test(clean)) { activeManagedComponentId = null; openManagedComponentDetail(record); return true; }
  const rename = clean.match(/(?:改名为|标题改成|标题为)[“"]?([^”"，。]{2,24})/);
  const changes = {};
  if (rename) changes.title = rename[1].trim();
  const instruction = clean.replace(rename?.[0] || '', '').trim();
  if (instruction) changes.summary = `已按对话要求调整：${instruction.replace(/[。]$/, '')}`;
  saveManagedRecord(record, changes);
  activeManagedComponentId = null;
  showToast(`${changes.title || record.title}已更新`);
  return true;
}

function componentItem(id) {
  return dynamicItems.find((item) => item.id === id && item.type === 'ai-card');
}

function componentPosition(width = 320, height = 260) {
  return blankCanvasPosition(width, height);
}

function componentFromDefinition(key, overrides = {}) {
  const definition = componentDefinitions[key];
  if (!definition) return null;
  const position = componentPosition();
  return {
    id: `component-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'ai-card', definitionKey: key,
    title: definition.title, icon: definition.icon, accent: definition.accent,
    description: definition.description, summary: definition.summary,
    metrics: definition.metrics.map((metric) => ({ ...metric })),
    items: definition.items.map((row) => ({ ...row })), sources: [...definition.sources],
    createdBy: definition.category === 'system' ? 'system' : 'syntropic',
    originTaskId: overrides.originTaskId || null, originPrompt: overrides.originPrompt || null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), updatedLabel: '刚刚更新',
    version: 1, ...position, ...overrides,
  };
}

function addComponentDefinition(key, overrides = {}) {
  const definition = componentDefinitions[key];
  if (!definition) return false;
  if (definition.category === 'system') {
    const existing = dynamicItems.find((item) => item.type === 'ai-card' && item.definitionKey === key);
    if (existing) {
      selectObject(canvasObjects.find((object) => object.dataset.objectId === existing.id));
      showToast(`${existing.title}已在当前工作台`);
      return true;
    }
  }
  const item = componentFromDefinition(key, overrides);
  addDynamicCanvasItem(item);
  showToast(`${item.title}已添加到工作台`);
  return true;
}

function refreshComponentObject(id) {
  const item = componentItem(id);
  const object = canvasObjects.find((entry) => entry.dataset.objectId === id);
  if (!item || !object) return;
  item.x = parseFloat(object.style.getPropertyValue('--object-x')) || item.x;
  item.y = parseFloat(object.style.getPropertyValue('--object-y')) || item.y;
  object.remove();
  canvasObjects = canvasObjects.filter((entry) => entry !== object);
  addDynamicCanvasItem(item, { persist: false });
  saveDynamicItems();
  saveLayout();
}

function inferComponentDefinition(prompt) {
  if (/候选人.*(风险|流失)|流失.*候选人/.test(prompt)) return 'candidate-risk';
  if (/面试.*(产能|时段|排期)/.test(prompt)) return 'interview-capacity';
  if (/(发布|上线).*(风险|阻塞)|风险.*发布/.test(prompt)) return 'release-risk';
  if (/(用户|客户).*(反馈|洞察)|反馈.*趋势/.test(prompt)) return 'feedback';
  if (/确认|审批/.test(prompt)) return 'approvals';
  if (/数据源|连接状态|同步状态/.test(prompt)) return 'connections';
  if (/目标|进度/.test(prompt)) return 'goals';
  if (/产物|文件|报告/.test(prompt)) return 'artifacts';
  return currentCanvasId === 'hr-recruiting' ? 'candidate-risk' : currentCanvasId === 'product-release' ? 'release-risk' : 'goals';
}

function isCreateComponentPrompt(prompt) {
  return /(生成|创建|添加|放一个|做一张|做一个).*(组件|卡片|看板)|把.*(放到|固定到).*(桌面|工作台)/.test(prompt);
}

function createComponentFromPrompt(prompt) {
  const key = inferComponentDefinition(prompt);
  const item = componentFromDefinition(key, { originPrompt: prompt, createdBy: 'syntropic' });
  const titleMatch = prompt.match(/(?:叫|标题为|命名为)[“"]?([^”"，。]{2,18})/);
  if (titleMatch) item.title = titleMatch[1].trim();
  addDynamicCanvasItem(item);
  showToast(`${item.title}已根据对话生成`);
  return true;
}

function taskComponentPayload(taskId, task, instruction = '') {
  const contextText = [task.title, task.description, task.goal, task.context, task.tool, instruction].filter(Boolean).join(' ');
  const key = inferComponentDefinition(contextText);
  const stateText = task.stateText || task.state || (task.tone === 'done' ? '已完成' : task.tone === 'review' ? '等待确认' : '执行中');
  const tone = /完成|正常|通过/.test(stateText) ? 'positive' : /确认|等待|风险|阻塞/.test(stateText) ? 'warning' : '';
  const latestEvent = Array.isArray(task.events) ? task.events.at(-1) : null;
  const title = String(task.title || '任务').replace(/已完成$/, '').trim();
  const summary = instruction
    ? `根据任务对话生成：${instruction.replace(/[。]$/, '')}`
    : task.description || task.goal || task.reply || task.why || '持续同步当前任务的状态、上下文与最新产物。';
  return {
    key,
    overrides: {
      title: `${title} · 任务组件`,
      description: '由具体任务对话生成，并随任务上下文持续更新',
      summary,
      metrics: [{ value: stateText, label: '当前状态', trend: '来自任务对话', tone }],
      items: [
        { title: task.tool || latestEvent?.[1] || '任务正在推进', detail: task.detail || latestEvent?.[2] || task.reply || task.next || '正在同步最新进展', value: '刚刚', tone },
        { title: '任务上下文', detail: task.context || task.goal || '当前工作台', value: '已关联' },
      ],
      sources: [...new Set([`任务：${task.title || taskId}`, task.context || task.goal, task.agent || 'Syntropic Agent'].filter(Boolean))],
      originTaskId: taskId,
      originPrompt: instruction || `从任务“${task.title || taskId}”生成桌面组件`,
      createdBy: 'task-conversation',
    },
  };
}

function createComponentFromTask(taskId, task, instruction = '') {
  const payload = taskComponentPayload(taskId, task, instruction);
  const existing = dynamicItems.find((item) => item.type === 'ai-card' && item.originTaskId === taskId);
  if (existing) {
    Object.assign(existing, payload.overrides, { updatedAt:new Date().toISOString(), updatedLabel:'刚刚从任务对话更新', version:(existing.version || 1) + 1 });
    refreshComponentObject(existing.id);
    showToast(`${existing.title}已从任务对话更新`);
    return { id:existing.id, title:existing.title, updated:true };
  }
  const item = componentFromDefinition(payload.key, payload.overrides);
  addDynamicCanvasItem(item);
  showToast(`${item.title}已生成到当前工作台`);
  return { id:item.id, title:item.title, updated:false };
}

function focusComponentById(id) {
  showDesktop();
  const object = canvasObjects.find((entry) => entry.dataset.objectId === id);
  if (!object) return false;
  selectObject(object);
  object.scrollIntoView?.({ behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'center', inline:'center' });
  showToast('已定位到任务生成的组件');
  return true;
}

function updateComponentFromPrompt(item, prompt) {
  const cleanPrompt = prompt.replace(new RegExp(`^@${escapeRegExp(item.title)}\\s*`), '').trim();
  const rename = cleanPrompt.match(/(?:改名为|标题改成|标题为)[“"]?([^”"，。]{2,24})/);
  if (rename) item.title = rename[1].trim();
  const filter = cleanPrompt.match(/只(?:看|显示)(.+)/);
  if (filter) item.summary = `当前筛选：${filter[1].replace(/[。]$/, '')}`;
  else if (!rename) item.summary = `已按你的要求更新：${cleanPrompt.replace(/[。]$/, '')}`;
  item.originPrompt = cleanPrompt;
  item.updatedAt = new Date().toISOString();
  item.updatedLabel = '刚刚由对话更新';
  item.version = (item.version || 1) + 1;
  refreshComponentObject(item.id);
  activeComponentId = null;
  showToast(`${item.title}已更新`);
  return true;
}

function handleReferencedComponentPrompt(item, prompt) {
  if (/(删除|移除|取消固定).*(组件|卡片)?/.test(prompt)) {
    activeComponentId = null;
    removeComponentWithUndo(item);
    return true;
  }
  if (/(复制|创建副本)/.test(prompt)) {
    const copy = JSON.parse(JSON.stringify(item));
    Object.assign(copy, componentPosition(), { id:`component-${Date.now()}-copy`, title:`${item.title} 副本`, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), version:1 });
    addDynamicCanvasItem(copy);
    activeComponentId = null;
    showToast('组件副本已创建');
    return true;
  }
  if (/(查看|来源|为什么|详情)/.test(prompt)) {
    activeComponentId = null;
    openComponentDetail(item);
    return true;
  }
  return updateComponentFromPrompt(item, prompt);
}

function handleComponentPrompt(prompt) {
  if (activeManagedComponentId) {
    const record = managedComponentRecord(activeManagedComponentId);
    if (record) return updateManagedComponentFromPrompt(record, prompt);
    activeManagedComponentId = null;
  }
  if (activeComponentId) {
    const item = componentItem(activeComponentId);
    if (item) return handleReferencedComponentPrompt(item, prompt);
    activeComponentId = null;
  }
  const mentioned = dynamicItems.find((item) => item.type === 'ai-card' && prompt.includes(`@${item.title}`));
  if (mentioned) return handleReferencedComponentPrompt(mentioned, prompt);
  const managedMention = canvasObjects
    .filter((object) => !object.matches('.canvas-ai-card'))
    .map((object) => managedComponentRecord(object.dataset.objectId))
    .find((record) => record && prompt.includes(`@${record.title}`));
  if (managedMention) return updateManagedComponentFromPrompt(managedMention, prompt);
  if (isCreateComponentPrompt(prompt)) return createComponentFromPrompt(prompt);
  return false;
}

function componentLibraryMarkup() {
  const systemCards = [
    ...Object.entries(nativeSystemComponents).map(([key, item]) => ({ key, ...item, native: true })),
    ...['approvals', 'goals', 'connections', 'artifacts'].map((key) => ({ key, ...componentDefinitions[key] })),
  ];
  const contextualKeys = currentCanvasId === 'hr-recruiting'
    ? ['candidate-risk', 'interview-capacity']
    : currentCanvasId === 'product-release' ? ['release-risk', 'feedback'] : ['feedback', 'release-risk'];
  const card = (item) => `<button type="button" data-library-component="${item.key}" data-native-component="${item.native ? 'true' : 'false'}"><span data-icon="${item.icon}"></span><span><strong>${item.title}</strong><small>${item.description}</small></span><em>添加</em></button>`;
  return `<section class="component-library-panel" role="dialog" aria-modal="true" aria-labelledby="componentLibraryTitle">
    <header><span><small>当前工作台</small><strong id="componentLibraryTitle">添加桌面组件</strong></span><button type="button" data-component-library-close aria-label="关闭"><span data-icon="close"></span></button></header>
    <div class="component-library-intro"><span data-icon="spark"></span><span><strong>也可以直接告诉 Syntropic</strong><small>例如：“生成一张候选人流失风险卡片，放到工作台。”</small></span><button type="button" data-component-library-ai>用对话生成</button></div>
    <section><header><strong>系统组件</strong><small>稳定能力，可按工作台添加或隐藏</small></header><div>${systemCards.map(card).join('')}</div></section>
    <section><header><strong>根据当前工作推荐</strong><small>由任务和数据生成，可继续通过对话修改</small></header><div>${contextualKeys.map((key) => card({ key, ...componentDefinitions[key] })).join('')}</div></section>
  </section>`;
}

function openComponentLibrary() {
  document.querySelector('.component-library-layer')?.remove();
  const layer = document.createElement('div');
  layer.className = 'component-library-layer';
  layer.innerHTML = componentLibraryMarkup();
  document.body.appendChild(layer);
  hydrateIcons(layer);
  requestAnimationFrame(() => layer.classList.add('visible'));
  layer.querySelector('[data-component-library-close]')?.focus();
}

function openComponentDetail(item) {
  document.querySelector('.component-detail-layer')?.remove();
  const layer = document.createElement('div');
  layer.className = 'component-detail-layer';
  layer.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="componentDetailTitle"><header><span><small>${item.createdBy === 'system' ? '系统组件' : '对话生成组件'}</small><strong id="componentDetailTitle">组件详情</strong></span><button type="button" data-component-detail-close aria-label="关闭"><span data-icon="close"></span></button></header><div><label>组件名称<input data-component-detail-title maxlength="30" /></label><label>说明<textarea data-component-detail-summary maxlength="160"></textarea></label><section><strong>来源与追踪</strong><p>${item.sources.length ? item.sources.join(' · ') : '尚未连接数据源'}</p><p>创建方式：${item.createdBy === 'system' ? '系统组件库' : 'Syntropic 对话'}</p><p>来源任务：${item.originTaskId || '当前对话'}</p><p>版本：v${item.version || 1}</p></section></div><footer><button type="button" data-component-detail-ai>用 Syntropic 修改</button><button class="primary" type="button" data-component-detail-save>保存修改</button></footer></section>`;
  document.body.appendChild(layer);
  hydrateIcons(layer);
  layer.querySelector('[data-component-detail-title]').value = item.title;
  layer.querySelector('[data-component-detail-summary]').value = item.summary || '';
  layer.dataset.componentId = item.id;
  requestAnimationFrame(() => layer.classList.add('visible'));
}

function focusComponentInAI(item) {
  activeComponentId = item.id;
  aiInput.value = `@${item.title} `;
  setAIComposerExpanded(true);
  suggestions(false);
  aiInput.focus();
  aiInput.setSelectionRange(aiInput.value.length, aiInput.value.length);
  showToast(`已引用组件：${item.title}`);
}

function showComponentUndo(snapshot) {
  componentUndoSnapshot = snapshot;
  clearTimeout(componentUndoTimer);
  document.querySelector('.component-undo')?.remove();
  const undo = document.createElement('div');
  undo.className = 'component-undo';
  const title = snapshot.title || snapshot.item?.title || snapshot.item?.componentOverride?.title || '组件';
  undo.innerHTML = `<span>“${workspaceNameHTML(title)}”已从桌面移除</span><button type="button" data-component-undo>撤销</button>`;
  document.body.appendChild(undo);
  requestAnimationFrame(() => undo.classList.add('visible'));
  componentUndoTimer = setTimeout(() => { undo.remove(); componentUndoSnapshot = null; }, 6000);
}

function removeComponentWithUndo(item) {
  const object = canvasObjects.find((entry) => entry.dataset.objectId === item.id);
  const snapshot = { item: JSON.parse(JSON.stringify(item)), workspaceId: currentCanvasId };
  if (object) {
    snapshot.item.x = parseFloat(object.style.getPropertyValue('--object-x')) || item.x;
    snapshot.item.y = parseFloat(object.style.getPropertyValue('--object-y')) || item.y;
  }
  if (removeDynamicCanvasItem(item.id, '组件已从桌面移除')) showComponentUndo(snapshot);
}

function restoreRemovedComponent() {
  const snapshot = componentUndoSnapshot;
  if (!snapshot) return;
  clearTimeout(componentUndoTimer);
  document.querySelector('.component-undo')?.remove();
  componentUndoSnapshot = null;
  if (snapshot.kind === 'native') {
    if (snapshot.workspaceId === currentCanvasId) toggleGlobalWidget(snapshot.widgetId);
    else {
      const canvas = canvases.find((item) => item.id === snapshot.workspaceId);
      if (canvas) { canvas.widgetIds ||= []; if (!canvas.widgetIds.includes(snapshot.widgetId)) canvas.widgetIds.push(snapshot.widgetId); saveCanvasRegistry(); }
    }
  } else if (snapshot.workspaceId === currentCanvasId) addDynamicCanvasItem(snapshot.item);
  else {
    const canvas = canvases.find((item) => item.id === snapshot.workspaceId);
    if (canvas) { canvas.dynamicItems.push(snapshot.item); saveCanvasRegistry(); }
  }
  showToast(`${snapshot.title || snapshot.item?.title || '组件'}已恢复`);
}

function removeManagedComponent(record) {
  if (record.dynamic) {
    const object = record.object;
    const snapshot = { kind:'dynamic-default', title:record.title, item:JSON.parse(JSON.stringify(record.dynamic)), workspaceId:currentCanvasId };
    snapshot.item.x = parseFloat(object.style.getPropertyValue('--object-x')) || record.dynamic.x;
    snapshot.item.y = parseFloat(object.style.getPropertyValue('--object-y')) || record.dynamic.y;
    if (removeDynamicCanvasItem(record.id, '默认组件已从桌面移除')) showComponentUndo(snapshot);
    return;
  }
  if (nativeSystemComponents[record.id]) {
    toggleGlobalWidget(record.id);
    showComponentUndo({ kind:'native', title:record.title, widgetId:record.id, workspaceId:currentCanvasId });
    return;
  }
  const canvas = getCurrentCanvas();
  canvas.hiddenObjects ||= [];
  canvas.hiddenObjects = [...new Set([...canvas.hiddenObjects, record.id])];
  saveCanvasRegistry(); performCanvasLoad(currentCanvasId);
  showToast('组件已从桌面隐藏');
}

function duplicateManagedComponent(record) {
  const definitionKey = currentCanvasId === 'hr-recruiting' ? 'candidate-risk' : currentCanvasId === 'product-release' ? 'release-risk' : 'goals';
  const copy = componentFromDefinition(definitionKey, {
    title:`${record.title} 副本`, summary:record.summary,
    sources:[...record.sources], originPrompt:`复制自默认组件：${record.title}`,
  });
  addDynamicCanvasItem(copy); showToast('已复制为可独立修改的新组件');
}

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-open-component-library]')) { openComponentLibrary(); return; }
  if (event.target.closest('[data-component-library-close]') || event.target === document.querySelector('.component-library-layer')) { document.querySelector('.component-library-layer')?.remove(); return; }
  if (event.target.closest('[data-component-library-ai]')) {
    document.querySelector('.component-library-layer')?.remove();
    aiInput.value = '生成一张桌面组件：'; setAIComposerExpanded(true); aiInput.focus();
    return;
  }
  const libraryItem = event.target.closest('[data-library-component]');
  if (libraryItem) {
    if (libraryItem.dataset.nativeComponent === 'true') toggleGlobalWidget(libraryItem.dataset.libraryComponent);
    else addComponentDefinition(libraryItem.dataset.libraryComponent);
    document.querySelector('.component-library-layer')?.remove();
    return;
  }
  const menuButton = event.target.closest('[data-component-menu]');
  if (menuButton) {
    event.stopPropagation();
    const menu = document.querySelector(`[data-component-menu-popover="${menuButton.dataset.componentMenu}"]`);
    const open = !menu.classList.contains('open');
    document.querySelectorAll('.component-action-menu.open').forEach((item) => {
      item.classList.remove('open');
      item.setAttribute('aria-hidden', 'true');
      item.closest('.canvas-object')?.classList.remove('menu-open');
    });
    menu.classList.toggle('open', open); menu.setAttribute('aria-hidden', String(!open));
    menu.closest('.canvas-object')?.classList.toggle('menu-open', open);
    return;
  }
  const actionButton = event.target.closest('[data-component-action]');
  if (actionButton) {
    event.stopPropagation();
    const item = componentItem(actionButton.dataset.componentId);
    if (!item) return;
    if (actionButton.dataset.componentAction === 'inspect') openComponentDetail(item);
    if (actionButton.dataset.componentAction === 'edit') focusComponentInAI(item);
    if (actionButton.dataset.componentAction === 'duplicate') {
      const copy = JSON.parse(JSON.stringify(item)); const position = componentPosition();
      Object.assign(copy, position, { id:`component-${Date.now()}-copy`, title:`${item.title} 副本`, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), version:1 });
      addDynamicCanvasItem(copy); showToast('组件副本已创建');
    }
    if (actionButton.dataset.componentAction === 'remove') removeComponentWithUndo(item);
    document.querySelectorAll('.component-action-menu.open').forEach((menu) => {
      menu.classList.remove('open');
      menu.setAttribute('aria-hidden', 'true');
      menu.closest('.canvas-object')?.classList.remove('menu-open');
    });
    return;
  }
  if (event.target.closest('[data-component-detail-close]') || event.target === document.querySelector('.component-detail-layer')) { document.querySelector('.component-detail-layer')?.remove(); return; }
  if (event.target.closest('[data-component-detail-ai]')) {
    const layer = event.target.closest('.component-detail-layer'); const item = componentItem(layer.dataset.componentId);
    layer.remove(); if (item) focusComponentInAI(item); return;
  }
  if (event.target.closest('[data-component-detail-save]')) {
    const layer = event.target.closest('.component-detail-layer'); const item = componentItem(layer.dataset.componentId);
    if (item) {
      item.title = layer.querySelector('[data-component-detail-title]').value.trim() || item.title;
      item.summary = layer.querySelector('[data-component-detail-summary]').value.trim();
      item.updatedLabel = '刚刚手动更新'; item.updatedAt = new Date().toISOString(); item.version = (item.version || 1) + 1;
      refreshComponentObject(item.id); showToast(`${item.title}已保存`);
    }
    layer.remove(); return;
  }
  if (event.target.closest('[data-component-undo]')) { restoreRemovedComponent(); return; }
  if (!event.target.closest('.component-action-menu, .component-menu-toggle')) document.querySelectorAll('.component-action-menu.open').forEach((menu) => {
    menu.classList.remove('open');
    menu.setAttribute('aria-hidden', 'true');
    menu.closest('.canvas-object')?.classList.remove('menu-open');
  });
});

document.addEventListener('click', (event) => {
  const menuButton = event.target.closest('[data-managed-menu]');
  if (menuButton) {
    event.stopPropagation();
    const menu = menuButton.parentElement.querySelector(`[data-managed-menu-popover="${menuButton.dataset.managedMenu}"]`);
    const open = !menu.classList.contains('open');
    document.querySelectorAll('.managed-component-menu.open').forEach((item) => { item.classList.remove('open'); item.setAttribute('aria-hidden', 'true'); });
    menu.classList.toggle('open', open); menu.setAttribute('aria-hidden', String(!open));
    return;
  }
  const action = event.target.closest('[data-managed-action]');
  if (action) {
    event.stopPropagation();
    const record = managedComponentRecord(action.dataset.managedId);
    if (!record) return;
    if (action.dataset.managedAction === 'inspect') openManagedComponentDetail(record);
    if (action.dataset.managedAction === 'ai') focusManagedComponentInAI(record);
    if (action.dataset.managedAction === 'duplicate') duplicateManagedComponent(record);
    if (action.dataset.managedAction === 'remove') removeManagedComponent(record);
    document.querySelectorAll('.managed-component-menu.open').forEach((menu) => menu.classList.remove('open'));
    return;
  }
  if (event.target.closest('[data-managed-detail-ai]')) {
    const layer = event.target.closest('.component-detail-layer');
    const record = managedComponentRecord(layer.dataset.managedId);
    layer.remove(); if (record) focusManagedComponentInAI(record); return;
  }
  if (event.target.closest('[data-managed-detail-save]')) {
    const layer = event.target.closest('.component-detail-layer');
    const record = managedComponentRecord(layer.dataset.managedId);
    if (record) {
      saveManagedRecord(record, {
        title:layer.querySelector('[data-managed-detail-title]').value.trim() || record.defaultTitle,
        summary:layer.querySelector('[data-managed-detail-summary]').value.trim(),
      });
      showToast('默认组件已更新');
    }
    layer.remove(); return;
  }
  if (event.target.closest('[data-managed-detail-reset]')) {
    const layer = event.target.closest('.component-detail-layer');
    const record = managedComponentRecord(layer.dataset.managedId);
    if (record) {
      Object.keys(record.override).forEach((key) => delete record.override[key]);
      if (record.dynamic) saveDynamicItems(); else saveCanvasRegistry();
      applyManagedOverride(record.id); showToast('组件已恢复默认配置');
    }
    layer.remove(); return;
  }
  if (!event.target.closest('.managed-component-menu')) document.querySelectorAll('.managed-component-menu.open').forEach((menu) => { menu.classList.remove('open'); menu.setAttribute('aria-hidden', 'true'); });
  if (event.target.closest('[data-workspace-select],[data-workspace-delete],[data-workspace-rename]')) setTimeout(refreshManagedComponentControls, 260);
});

const managedCanvasObserver = new MutationObserver(() => requestAnimationFrame(refreshManagedComponentControls));
managedCanvasObserver.observe(canvasWorld, { childList:true, subtree:false });

window.SyntropicComponents = {
  handlePrompt: handleComponentPrompt,
  openLibrary: openComponentLibrary,
  createFromTask: createComponentFromTask,
  focusById: focusComponentById,
};
refreshManagedComponentControls();
