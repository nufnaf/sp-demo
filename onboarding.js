const userOnboardingKey = 'syntropic-user-onboarded-v1';
const userProfileKey = 'syntropic-user-profile-v1';
// Onboarding markers must survive across sessions in every mode, even where
// app state (demo) is intentionally ephemeral. Only "清除用户信息" removes them.
const onboardingStore = window.localStorage;

const onboardingRoles = [
  { id: 'hr', label: '人力资源 / 招聘', icon: 'recruiting', detail: '招聘、人才管理与组织效率' },
  { id: 'product', label: '产品 / 研发', icon: 'code', detail: '产品交付、研究与团队协作' },
  { id: 'founder', label: '管理者 / 创业者', icon: 'spark', detail: '业务目标、决策与跨团队推进' },
  { id: 'other', label: '其他', icon: 'user', detail: '从你的具体目标开始' },
];

const onboardingGoals = {
  hr: ['掌握招聘目标与进度', '提高候选人筛选效率', '缩短面试排期时间', '降低候选人流失风险'],
  product: ['推进产品发布', '整理用户研究', '跟踪项目风险', '协调跨团队任务'],
  founder: ['跟踪业务目标', '准备关键决策', '发现经营风险', '提高团队执行效率'],
  other: ['整理当前工作', '持续推进长期目标', '汇总多个数据源', '自动生成工作报告'],
};

const recruitingSources = [
  { id: 'moka', name: 'Moka', letter: 'M', color: '#6657d9', logo: './assets/apps/moka.png', detail: '候选人、职位与招聘阶段', imported: '已导入职位、候选人与招聘阶段' },
  { id: 'beisen', name: '北森', letter: '北', color: '#1684e8', logo: './assets/apps/beisen.ico', detail: '招聘流程、人才库与面试评价', imported: '已导入人才库、招聘流程与面试评价' },
  { id: 'lark', name: '飞书', letter: '飞', color: '#3378f6', logo: './assets/feishu-logo.png', detail: '日历、文档与候选人沟通', imported: '已导入日历、文档与沟通记录' },
];

const productSources = [
  { id: 'lark', name: '飞书', letter: '飞', color: '#3378f6', logo: './assets/feishu-logo.png', detail: '项目、文档、日历与团队讨论', imported: '已导入项目、文档与团队讨论' },
  { id: 'dingtalk', name: '钉钉', letter: '钉', color: '#1688ff', logo: './assets/apps/dingtalk.png', detail: '项目协作、审批与工作通知', imported: '已导入项目进展、审批与工作通知' },
  { id: 'wecom', name: '企业微信', letter: '企', color: '#2aab5f', logo: './assets/apps/wecom.png', detail: '客户群、用户反馈与团队沟通', imported: '已导入客户群、用户反馈与团队沟通' },
];

const onboardingState = {
  step: 'role', role: null, goals: [], customGoal: '', sources: new Set(),
};

function onboardingEscape(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function onboardingShell() {
  const layer = document.createElement('section');
  layer.className = 'first-run-onboarding';
  layer.setAttribute('aria-label', 'Syntropic 新用户引导');
  layer.innerHTML = `
    <header class="onboarding-topbar">
      <span class="onboarding-brand"><img src="./assets/syntropic-mark.png" alt="" /><strong>Syntropic <em>ai</em></strong></span>
      <button type="button" data-onboarding-skip>稍后设置</button>
    </header>
    <main class="onboarding-stage">
      <section class="onboarding-conversation" aria-live="polite"></section>
    </main>`;
  document.body.appendChild(layer);
  requestAnimationFrame(() => layer.classList.add('visible'));
  return layer;
}

function onboardingMessage(copy, type = 'agent') {
  return `<article class="onboarding-message ${type}">${type === 'agent' ? '<i class="onboarding-agent-mark"><img src="./assets/syntropic-mark.png" alt="" /></i>' : ''}<div>${copy}</div></article>`;
}

function setOnboardingProgress(layer, step) {
  layer.dataset.onboardingStage = String(step);
}

function appendOnboardingContent(layer, markup) {
  const conversation = layer.querySelector('.onboarding-conversation');
  conversation.insertAdjacentHTML('beforeend', markup);
  hydrateIcons(conversation);
  requestAnimationFrame(() => layer.scrollTo({ top: layer.scrollHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
}

function lockOnboardingControls(layer, selector) {
  layer.querySelectorAll(selector).forEach((control) => {
    control.disabled = true;
    control.setAttribute('aria-disabled', 'true');
  });
}

function onboardingGoalCopy() {
  const custom = onboardingState.customGoal.trim();
  return custom || onboardingState.goals.join('、');
}

function onboardingAvailableSources() {
  if (onboardingState.role === 'hr') return recruitingSources;
  if (onboardingState.role === 'product') return productSources;
  return [];
}

function onboardingSourceLogo(source) {
  return `<i class="onboarding-source-logo logo-${source.id}" style="--source-color:${source.color}">${source.logo ? `<img src="${source.logo}" alt="" />` : source.letter}</i>`;
}

function renderRoleStep(layer) {
  onboardingState.step = 'role';
  setOnboardingProgress(layer, 0);
  layer.querySelector('.onboarding-conversation').innerHTML = `
    ${onboardingMessage('<span class="onboarding-kicker">欢迎使用 Syntropic</span><h1>你好，我是 Syntropic。<br />先了解一下你，再为你创建合适的工作台。</h1><p>你目前主要从事什么工作？</p>')}
    <div class="onboarding-options role-options">${onboardingRoles.map((role) => `<button type="button" data-onboarding-role="${role.id}"><i data-icon="${role.icon}"></i><span><strong>${role.label}</strong><small>${role.detail}</small></span><em data-icon="arrow"></em></button>`).join('')}</div>`;
  hydrateIcons(layer);
  layer.querySelector('[data-onboarding-role]')?.focus();
}

function renderGoalStep(layer) {
  onboardingState.step = 'goal';
  setOnboardingProgress(layer, 1);
  const role = onboardingRoles.find((item) => item.id === onboardingState.role);
  const goals = onboardingGoals[onboardingState.role] || onboardingGoals.other;
  lockOnboardingControls(layer, '[data-onboarding-role]');
  appendOnboardingContent(layer, `
    ${onboardingMessage(`<p>${role.label}</p>`, 'user')}
    ${onboardingMessage(`<h2>明白了。你现在最希望改善什么？</h2><p>可以选择多个目标，也可以直接告诉我更具体的需求。</p>`)}
    <div class="onboarding-goals">${goals.map((goal) => `<button type="button" data-onboarding-goal="${goal}" aria-pressed="false"><i></i>${goal}</button>`).join('')}</div>
    <label class="onboarding-custom-goal"><span data-icon="message"></span><input type="text" maxlength="80" placeholder="例如：这个季度需要招聘 6 位 Agent 工程师" aria-label="具体工作目标" /></label>
    <footer class="onboarding-actions"><button class="primary" type="button" data-onboarding-goal-next disabled>发送</button></footer>`);
  layer.querySelector('[data-onboarding-goal]')?.focus();
}

function collapseOnboardingControls(layer) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  layer.querySelectorAll('.onboarding-goals, .onboarding-custom-goal, .recruiting-source-grid, .onboarding-actions').forEach((node) => {
    if (node.classList.contains('final')) return;
    node.classList.add('collapsing');
    setTimeout(() => node.remove(), reduceMotion ? 0 : 260);
  });
}

function renderIntegrationStep(layer) {
  onboardingState.step = 'integration';
  setOnboardingProgress(layer, 2);
  const goalCopy = onboardingGoalCopy();
  lockOnboardingControls(layer, '[data-onboarding-role]');
  collapseOnboardingControls(layer);
  if (!['hr', 'product'].includes(onboardingState.role)) {
    appendOnboardingContent(layer, onboardingMessage(`<p>${onboardingEscape(goalCopy)}</p>`, 'user'));
    renderWorkspaceGeneration(layer);
    return;
  }
  const isHR = onboardingState.role === 'hr';
  const availableSources = onboardingAvailableSources();
  appendOnboardingContent(layer, `
    ${onboardingMessage(`<p>${onboardingEscape(goalCopy)}</p>`, 'user')}
    ${onboardingMessage(`<h2>${isHR ? '连接招聘系统，我才能基于完整数据持续推进。' : '连接协作系统，我会把产品上下文组织到一起。'}</h2><p>${isHR ? '选择你正在使用的招聘系统。' : '选择团队正在使用的协作与沟通工具。'}</p>`)}
    <div class="recruiting-source-grid">${availableSources.map((source) => `<button type="button" data-onboarding-source="${source.id}" aria-pressed="false">${onboardingSourceLogo(source)}<span><strong>${source.name}</strong><small>${source.detail}</small></span><em>选择</em></button>`).join('')}</div>
    <footer class="onboarding-actions"><span><button type="button" data-onboarding-skip-import>暂不导入</button><button class="primary" type="button" data-onboarding-import disabled>连接并导入</button></span></footer>`);
  layer.querySelector('[data-onboarding-source]')?.focus();
}

function renderImportProgress(layer) {
  onboardingState.step = 'import';
  const selected = onboardingAvailableSources().filter((source) => onboardingState.sources.has(source.id));
  collapseOnboardingControls(layer);
  const sourceCopy = selected.map((source) => source.name).join('、');
  appendOnboardingContent(layer, `
    ${onboardingMessage(`<p>连接 ${onboardingEscape(sourceCopy)} 并导入数据</p>`, 'user')}
    ${onboardingMessage(`<h2>正在整理你的${onboardingState.role === 'hr' ? '招聘' : '产品'}上下文</h2><p>${onboardingState.role === 'hr' ? '我会统一候选人、职位、面试与日历信息' : '我会统一需求、项目、文档、用户反馈与团队讨论'}，并保留每条结论的数据来源。</p>`)}
    <section class="onboarding-import-list">${selected.map((source) => `<article data-import-source="${source.id}">${onboardingSourceLogo(source)}<span><strong>${source.name}</strong><small>等待导入</small></span><em><b></b></em></article>`).join('')}</section>`);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  selected.forEach((source, index) => {
    setTimeout(() => {
      const row = layer.querySelector(`[data-import-source="${source.id}"]`);
      if (!row) return;
      row.classList.add('running');
      row.querySelector('small').textContent = '正在读取演示数据…';
      setTimeout(() => {
        row.classList.remove('running');
        row.classList.add('done');
        row.querySelector('small').textContent = source.imported;
        row.querySelector('em').innerHTML = '<span data-icon="check"></span>';
        hydrateIcons(row);
        if (index === selected.length - 1) setTimeout(() => renderWorkspaceGeneration(layer), reduceMotion ? 0 : 450);
      }, reduceMotion ? 30 : 900);
    }, reduceMotion ? index * 50 : index * 720);
  });
}

function renderWorkspaceGeneration(layer) {
  onboardingState.step = 'generate';
  setOnboardingProgress(layer, 3);
  const isHR = onboardingState.role === 'hr';
  const isProduct = onboardingState.role === 'product';
  const workspaceLabel = isHR ? '招聘工作台' : isProduct ? '产品工作台' : '我的工作台';
  const workspaceDescription = isHR
    ? '招聘工作台，持续跟踪目标、招聘进展、候选人风险和需要确认的外部动作'
    : isProduct
      ? '产品工作台，持续跟踪需求进展、发布风险、用户反馈和跨团队协作'
      : '与你当前目标匹配的工作台';
  const agentPromise = isHR
    ? '发现偏航 · 准备方案 · 持续跟踪结果'
    : isProduct
      ? '跟踪需求 · 识别风险 · 推进产品发布'
      : '组织任务 · 跟踪进度 · 提醒确认';
  const sourceNames = onboardingAvailableSources().filter((source) => onboardingState.sources.has(source.id)).map((source) => source.name);
  lockOnboardingControls(layer, '[data-onboarding-source], [data-onboarding-import], [data-onboarding-skip-import]');
  appendOnboardingContent(layer, `
    ${onboardingMessage(`<h2>信息已经准备好了</h2><p>我会创建一个${workspaceDescription}。</p>`)}
    <section class="onboarding-workspace-preview">
      <header><span><img src="./assets/syntropic-mark.png" alt="" /><strong>${workspaceLabel}</strong></span><em>即将创建</em></header>
      <div><article><small>你的目标</small><strong>${onboardingEscape(onboardingGoalCopy() || '持续推进当前工作')}</strong></article><article><small>数据来源</small><strong>${sourceNames.length ? sourceNames.join(' · ') : isProduct ? '需求 · 反馈 · 发布计划' : '稍后添加'}</strong></article><article><small>Syntropic 会做什么</small><strong>${agentPromise}</strong></article></div>
    </section>
    <footer class="onboarding-actions final"><button type="button" data-onboarding-skip>跳过，直接进入工作台</button><button class="primary" type="button" data-onboarding-generate>生成${workspaceLabel}</button></footer>`);
  layer.querySelector('[data-onboarding-generate]')?.focus();
}

function onboardingWorkspaceLabel() {
  if (onboardingState.role === 'hr') return '招聘工作台';
  if (onboardingState.role === 'product') return '产品工作台';
  return '我的工作台';
}

function renderWorkspaceBuilding(layer) {
  onboardingState.step = 'building';
  setOnboardingProgress(layer, 4);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  layer.querySelectorAll('[data-onboarding-skip]').forEach((control) => control.setAttribute('hidden', ''));
  const sourceNames = onboardingAvailableSources().filter((source) => onboardingState.sources.has(source.id)).map((source) => source.name);
  const goalCopy = onboardingGoalCopy();
  const steps = [
    { id: 'goal', text: goalCopy ? `围绕“${onboardingEscape(goalCopy)}”拆解工作场景` : '解析你的目标与工作场景' },
    { id: 'sources', text: sourceNames.length ? `整合 ${sourceNames.join('、')} 的数据上下文` : '梳理当前可用的演示数据' },
    { id: 'components', text: '据此生成组件、推进任务与桌面布局' },
    { id: 'ready', text: '校验生成结果并准备工作台' },
  ];
  appendOnboardingContent(layer, `
    ${onboardingMessage('<p>生成工作台</p>', 'user')}
    ${onboardingMessage(`<h2>正在根据你的引导生成专属工作台</h2><p>这不是预制模板——以下每一项都会结合你刚才的选择实时生成，请稍候。</p>`)}
    <section class="onboarding-build-list">${steps.map((step) => `<article data-build-step="${step.id}" class="waiting"><em><b></b></em><span>${step.text}</span></article>`).join('')}</section>`);
  const rows = [...layer.querySelectorAll('[data-build-step]')];
  rows.reduce((chain, row) => chain.then(() => {
    row.classList.remove('waiting');
    row.classList.add('running');
    return new Promise((resolve) => setTimeout(() => {
      row.classList.remove('running');
      row.classList.add('done');
      row.querySelector('em').innerHTML = '<span data-icon="check"></span>';
      hydrateIcons(row);
      resolve();
    }, reduceMotion ? 20 : 760 + Math.random() * 320));
  }), Promise.resolve()).then(() => setTimeout(() => completeUserOnboarding(layer), reduceMotion ? 0 : 480));
}

function completeUserOnboarding(layer) {
  const isHR = onboardingState.role === 'hr';
  const isProduct = onboardingState.role === 'product';
  onboardingStore.setItem(userOnboardingKey, 'true');
  onboardingStore.setItem(userProfileKey, JSON.stringify({
    role: onboardingState.role,
    goals: onboardingState.goals,
    customGoal: onboardingState.customGoal,
    sources: [...onboardingState.sources],
    completedAt: new Date().toISOString(),
  }));
  window.SyntropicApps?.installFromOnboarding?.([...onboardingState.sources]);
  let target;
  if (syntropicMode === 'demo') {
    const templateId = isHR ? 'hr-recruiting' : isProduct ? 'product-release' : 'personal-focus';
    target = workspaceCanvasTemplates().find((canvas) => canvas.id === templateId) || workspaceCanvasTemplates()[0];
    canvases = [target];
  } else {
    target = isHR
      ? canvases.find((canvas) => canvas.id === 'hr-recruiting')
      : isProduct
        ? canvases.find((canvas) => canvas.id === 'product-release')
        : getCurrentCanvas();
  }
  if (target) target.name = isHR ? '招聘工作台' : isProduct ? '产品工作台' : '我的工作台';
  saveCanvasRegistry();
  if (target && target.id !== currentCanvasId) performCanvasLoad(target.id);
  else renderWorkspaceList();
  layer.classList.add('leaving');
  setTimeout(() => {
    layer.remove();
    document.documentElement.classList.remove('first-run-boot');
    showDesktop();
    if (isHR) openHRRecruitingApp();
    showToast(`已根据你的引导生成${isHR ? '招聘' : isProduct ? '产品' : '个人'}工作台`);
  }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 420);
}

function skipUserOnboarding(layer) {
  onboardingStore.setItem(userOnboardingKey, 'skipped');
  layer.classList.add('leaving');
  setTimeout(() => {
    layer.remove();
    document.documentElement.classList.remove('first-run-boot');
    showDesktop();
    showToast('已跳过设置，你可以随时从演示数据面板重新体验');
  }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300);
}

function bindUserOnboarding(layer) {
  layer.addEventListener('click', (event) => {
    const role = event.target.closest('[data-onboarding-role]');
    if (role) {
      role.classList.add('selected');
      onboardingState.role = role.dataset.onboardingRole;
      onboardingState.goals = [];
      onboardingState.customGoal = '';
      onboardingState.sources.clear();
      renderGoalStep(layer);
      return;
    }
    const goal = event.target.closest('[data-onboarding-goal]');
    if (goal) {
      const selected = onboardingState.goals.includes(goal.dataset.onboardingGoal);
      onboardingState.goals = selected ? onboardingState.goals.filter((item) => item !== goal.dataset.onboardingGoal) : [...onboardingState.goals, goal.dataset.onboardingGoal];
      goal.setAttribute('aria-pressed', String(!selected));
      goal.classList.toggle('selected', !selected);
      const input = layer.querySelector('.onboarding-custom-goal input');
      if (input) {
        input.value = onboardingState.goals.join('、');
        onboardingState.customGoal = input.value;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        input.closest('.onboarding-custom-goal')?.classList.remove('goal-inserted');
        requestAnimationFrame(() => input.closest('.onboarding-custom-goal')?.classList.add('goal-inserted'));
      }
      updateGoalContinue(layer);
      return;
    }
    const source = event.target.closest('[data-onboarding-source]');
    if (source) {
      const id = source.dataset.onboardingSource;
      if (onboardingState.sources.has(id)) onboardingState.sources.delete(id); else onboardingState.sources.add(id);
      const selected = onboardingState.sources.has(id);
      source.classList.toggle('selected', selected);
      source.setAttribute('aria-pressed', String(selected));
      source.querySelector('em').textContent = selected ? '已选择' : '选择';
      layer.querySelector('[data-onboarding-import]').disabled = !onboardingState.sources.size;
      return;
    }
    if (event.target.closest('[data-onboarding-goal-next]')) renderIntegrationStep(layer);
    if (event.target.closest('[data-onboarding-import]')) renderImportProgress(layer);
    if (event.target.closest('[data-onboarding-skip-import]')) {
      appendOnboardingContent(layer, onboardingMessage('<p>暂时跳过数据导入</p>', 'user'));
      collapseOnboardingControls(layer);
      renderWorkspaceGeneration(layer);
    }
    if (event.target.closest('[data-onboarding-generate]')) renderWorkspaceBuilding(layer);
    if (event.target.closest('[data-onboarding-skip]')) skipUserOnboarding(layer);
  });
  layer.addEventListener('input', (event) => {
    if (!event.target.matches('.onboarding-custom-goal input')) return;
    onboardingState.customGoal = event.target.value.trim();
    updateGoalContinue(layer);
  });
}

function updateGoalContinue(layer) {
  const next = layer.querySelector('[data-onboarding-goal-next]');
  if (next) next.disabled = !onboardingState.goals.length && !onboardingState.customGoal;
}

function startUserOnboarding() {
  onboardingState.step = 'role';
  onboardingState.role = null;
  onboardingState.goals = [];
  onboardingState.customGoal = '';
  onboardingState.sources.clear();
  const layer = onboardingShell();
  bindUserOnboarding(layer);
  renderRoleStep(layer);
}

if (syntropicFirstRun && !onboardingStore.getItem(userOnboardingKey)) {
  startUserOnboarding();
}
