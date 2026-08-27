// One codebase, two isolated experiences. Demo state lives in its own
// namespace and persists across refreshes; debug mode shares plain storage.
const syntropicModeParam = new URLSearchParams(location.search).get('mode');
const syntropicMode = syntropicModeParam === 'debug' ? 'debug' : 'demo';

// Namespaced view over localStorage so both modes stay isolated while every
// change survives reloads. Keys are stored internally as `<prefix><key>`.
function createNamespacedStorage(prefix) {
  const base = window.localStorage;
  return {
    getItem: (key) => base.getItem(`${prefix}${key}`),
    setItem: (key, value) => base.setItem(`${prefix}${key}`, String(value)),
    removeItem: (key) => base.removeItem(`${prefix}${key}`),
    prefixedKey: (key) => `${prefix}${key}`,
  };
}

const demoStoragePrefix = 'syntropic-demo/';
const localStorage = syntropicMode === 'demo'
  ? createNamespacedStorage(demoStoragePrefix)
  : window.localStorage;
const syntropicStatePrefixes = ['solo-', 'relay-', 'syntropic-'];
document.documentElement.dataset.syntropicMode = syntropicMode;
document.body.classList.add(`mode-${syntropicMode}`);

// Capture first-run state before the workspace registry creates its defaults.
// The onboarding marker is stored in persistent storage regardless of mode, so
// guidance runs once; "清除用户信息" (Debug console) restores the new-user state.
const syntropicFirstRun = !window.localStorage.getItem('syntropic-user-onboarded-v1');
// Hide the desktop behind the onboarding layer until the flow completes, so a
// first-run refresh never flashes the workspace before the conversation starts.
if (syntropicFirstRun) document.documentElement.classList.add('first-run-boot');

// Persist demo progress between visits. Schema migrations are explicit so a
// refresh never unexpectedly destroys a user's workspace or task progress.
const syntropicStorageVersionKey = 'syntropic-storage-version';
const syntropicStorageVersion = '1';
if (localStorage.getItem(syntropicStorageVersionKey) !== syntropicStorageVersion) {
  localStorage.setItem(syntropicStorageVersionKey, syntropicStorageVersion);
}

const icons = {
  chevron: '<path d="m8 10 4 4 4-4"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
  message: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/>',
  file: '<path d="M6 2h8l4 4v16H6Z"/><path d="M14 2v5h5"/><path d="M9 13h6M9 17h6"/>',
  plug: '<path d="m12 22 1-5-4-1 6-8-1 5 4 1Z"/><path d="M5 4v4M9 4v4M3 8h8v2a4 4 0 0 1-4 4v5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  'insert-object': '<rect x="3" y="7" width="11" height="11" rx="2"/><path d="M7 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v7"/><path d="M18 15v6M15 18h6"/>',
  'annotation-arrow': '<path d="M5 19 19 5"/><path d="M11 5h8v8"/>',
  screen: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8M12 18v4"/>',
  mic: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8"/>',
  'arrow-up': '<path d="m6 10 6-6 6 6M12 4v16"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
  sidebar: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9 4v16"/>',
  blocks: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><path d="M17 14v6M14 17h6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-2.91 1.21V21h-4v-.08a1.7 1.7 0 0 0-2.91-1.21l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.29 7.1l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 10 3.08V3h4v.08a1.7 1.7 0 0 0 2.91 1.21l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  minimize: '<path d="M5 12h14"/>',
  expand: '<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  doc: '<path d="M5 3h14v18H5Z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  browser: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20M6 6.5h.01M9 6.5h.01"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/>',
  arrow: '<path d="m9 18 6-6-6-6"/>',
  folder: '<path d="M3 5h7l2 2h9v12H3Z"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  forward: '<path d="m9 18 6-6-6-6"/>',
  refresh: '<path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M6.1 8a7 7 0 0 1 11.5-2L20 8M4 16l2.4 2a7 7 0 0 0 11.5-2"/>',
  pointer: '<path d="m5 3 6.5 16 2.1-6.2L20 10Z"/>',
  hand: '<path d="M7 11V7a2 2 0 0 1 4 0v3-5a2 2 0 0 1 4 0v5-3a2 2 0 0 1 4 0v7c0 5-3 8-8 8h-1c-2 0-3.4-1-4.5-2.5L2.7 16a2 2 0 0 1 3-2.6L7 14"/>',
  minus: '<path d="M5 12h14"/>',
  arrange: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  move: '<path d="m12 2 3 3-3 3M12 2 9 5M12 22l3-3-3-3M12 22l-3-3M2 12l3-3 3 3M2 12l3 3M22 12l-3-3-3 3M22 12l-3 3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  spark: '<path d="m12 3 1.5 4.2L18 9l-4.5 1.8L12 15l-1.5-4.2L6 9l4.5-1.8Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z"/>',
  edit: '<path d="M4 20h5l11-11a2.8 2.8 0 0 0-4-4L5 16Z"/><path d="m14 7 4 4M4 12h5"/>',
  code: '<path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14"/>',
  chart: '<path d="M4 19V9M10 19V5M16 19v-7M22 19V3"/><path d="m3 8 6-4 6 5 6-6"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 20"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/>',
  user: '<circle cx="10" cy="8" r="4"/><path d="M3 21a7 7 0 0 1 14 0M17 11l4 4M21 11l-4 4"/>',
  recruiting: '<circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M18 10v7M14.5 13.5h7"/>',
  presentation: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22l4-4 4 4M8 9h8M8 13h5"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  wallet: '<path d="M3 6h16v14H3Z"/><path d="M3 8V5a2 2 0 0 1 2-2h12M14 11h7v5h-7Z"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15M15 6v15"/>',
  news: '<path d="M4 4h16v16H4Z"/><path d="M8 8h8M8 12h3M13 12h3M8 16h8"/>',
  text: '<path d="M5 5h14M12 5v14M8 19h8"/>',
  widget: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M3 10h18M10 10v11"/><path d="M14 6h3M6 14h1M6 17h1"/>',
  pin: '<path d="M9 3h6l-1 5 3 3v2H7v-2l3-3Z"/><path d="M12 13v8"/>',
  'pin-off': '<path d="M9 3h6l-.7 3.5M16.4 10.4l.6.6v2H9.6M12 16v5M4 4l16 16"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.4 9.3a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.2-2.6 3.7"/><path d="M12 17h.01"/>',
};

function icon(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.blocks}</svg>`;
}

function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((node) => { node.innerHTML = icon(node.dataset.icon); });
}

hydrateIcons();

const taskData = {
  'task-completed': {
    state: 'done', stateText: '已完成', title: '竞品定价分析已完成', description: '已完成 12 个来源的价格对比，并生成带引用的分析报告。', agent: 'Syntropic Agent', letter: 'S', context: '竞品定价分析.html',
    user: '分析竞品最近的定价变化，完成后通知我查看结果。',
    reply: '分析已经完成。8 家竞品中有 3 家调整了 AI 功能的套餐归属，基础套餐的 AI 能力覆盖率明显上升。',
    tool: '竞品定价分析.html 已生成', detail: '已核验 12 个来源，所有结论都可以追溯到原始页面。'
  },
  'task-pricing': {
    state: 'running', stateText: '执行中', title: '分析竞品最近的定价变化', description: '研究主要竞品过去 90 天的套餐、折扣与功能调整，生成带来源的对比报告。', agent: 'Syntropic Agent', letter: 'S', context: '竞品名单与分析框架.md',
    user: '分析竞品最近的定价变化，重点关注 AI 功能是否开始进入基础套餐。',
    reply: '我已经建立了 8 家竞品的价格基线。目前正在核对官网定价页、帮助中心和发布公告，避免把短期促销误判为正式调价。',
    tool: 'Browser 正在浏览 12 个来源', detail: '已完成 8/12，发现 3 家竞品调整了 AI 功能的套餐归属。'
  },
  'task-launch': {
    state: 'review', stateText: '等待确认', title: '准备 Q3 产品发布材料', description: '根据产品 Brief 生成发布邮件、内部 FAQ 和客户演示稿。', agent: 'Syntropic Agent', letter: 'S', context: 'Q3 产品发布 Brief',
    user: '按照 Brief 准备对内和对外的发布材料，语气简洁，不要营销腔。',
    reply: '三份材料已经生成。我把产品价值统一成“让团队从对话直接进入交付”，并保留了法务需要确认的两处能力表述。',
    tool: '文档与幻灯片已生成', detail: '发布邮件、内部 FAQ、12 页客户演示稿等待确认。'
  },
  'task-weekly': {
    state: 'scheduled', stateText: '已计划', title: '生成本周业务复盘', description: '汇总本周任务、会议和关键业务指标，生成管理层复盘。', agent: 'Syntropic Agent', letter: 'S', context: '本周业务数据',
    user: '每周四 18:00 自动生成业务复盘，异常指标要给出解释。',
    reply: '定时任务已经就绪。18:00 将读取已授权的数据源，完成后把报告固定到桌面并通知你确认。',
    tool: '定时任务等待执行', detail: '下一次运行：今天 18:00。'
  },
  'task-roadmap': {
    state: 'review', stateText: '等待确认', title: '更新产品路线图优先级', description: '结合反馈、研发成本和发布目标，更新下一阶段路线图。', agent: 'Syntropic Agent', letter: 'S', context: '产品路线图',
    user: '根据本周反馈重新评估路线图优先级，先给我确认再更新。',
    reply: '我整理了 6 项优先级调整建议，其中 2 项会影响 Q3 发布范围，需要你确认。',
    tool: '路线图建议已生成', detail: '等待确认后写回产品路线图。'
  },
  'task-release-check': {
    state: 'running', stateText: '执行中', title: '校验发布清单', description: '检查发布前的权限、文案、埋点和回滚准备。', agent: 'Syntropic Agent', letter: 'S', context: 'Q3 发布清单',
    user: '检查发布清单，发现阻塞项立即告诉我。',
    reply: '发布检查正在进行。权限与文案已通过，正在核对数据埋点和回滚方案。',
    tool: '正在执行发布检查', detail: '已完成 14/18 项，暂未发现阻塞问题。'
  },
  'task-hr-review': {
    state: 'running', stateText: '执行中', title: '诊断 Agent 工程师招聘瓶颈', description: '关联候选人漏斗、面试评价和评委日历，识别影响批量招聘的瓶颈。', agent: 'Syntropic Recruiter', letter: 'S', context: 'Agent 工程师招聘计划',
    user: '持续维护 6 位 Agent 工程师的招聘目标，发现偏航时先准备推进方案。',
    reply: '我发现候选人供给充足，但系统设计面试的评委产能不足，并且当前评价标准过度偏向通用后端能力。',
    tool: '招聘瓶颈正在诊断', detail: '23 位候选人等待系统设计面试，未来 10 个工作日只有 4 个可用评委时段。'
  },
  'task-hr-outreach': {
    state: 'review', stateText: '等待确认', title: '扩充 Agent 面试产能', description: '邀请备用评委，并为候选人与评委组织两个集中面试日。', agent: 'Syntropic Recruiter', letter: 'S', context: '面试产能推进方案',
    user: '外部邀请和日历变更由我确认，其他准备工作可以直接推进。',
    reply: '我找到了 3 位具备 Agent 系统经验的备用评委，并匹配出周四、周五 12 个共同可用时段。',
    tool: '邀请与日历方案已准备', detail: '尚未发送邀请，也没有创建外部会议。'
  },
  'task-hr-monitor': {
    state: 'scheduled', stateText: '持续跟踪', title: '持续跟踪团队招聘结果', description: '按每个 HC 跟踪候选人、面试产能、Offer 和到岗风险。', agent: 'Syntropic Recruiter', letter: 'S', context: '招聘 6 位 Agent 工程师 · 10 月 31 日',
    user: '持续跟踪到 6 位工程师全部到岗，不要在单个候选人推进后结束。',
    reply: '我会持续维护每个 HC 的漏斗与时间风险，并在面试产能、候选人回复或 Offer 结果变化时组织下一步。',
    tool: '招聘目标监控中', detail: '下一检查点：明天 10:00。'
  }
};

const seededTaskIds = new Set(Object.keys(taskData));
const visibleGeneralTaskIdsKey = 'syntropic-visible-task-ids-v1';
let visibleGeneralTaskIds;
try {
  const storedVisibleTaskIds = JSON.parse(localStorage.getItem(visibleGeneralTaskIdsKey) || 'null');
  visibleGeneralTaskIds = new Set(Array.isArray(storedVisibleTaskIds)
    ? storedVisibleTaskIds.filter((id) => taskData[id])
    : syntropicMode === 'debug' ? [...seededTaskIds] : []);
} catch {
  visibleGeneralTaskIds = new Set(syntropicMode === 'debug' ? [...seededTaskIds] : []);
}

function saveVisibleGeneralTasks() {
  localStorage.setItem(visibleGeneralTaskIdsKey, JSON.stringify([...visibleGeneralTaskIds]));
}

function visibleGeneralTaskEntries() {
  return Object.entries(taskData).filter(([id]) => visibleGeneralTaskIds.has(id));
}

const plugins = [
  { id: 'lark', name: '飞书', maker: 'ByteDance', color: '#2c6bed', letter: 'L', logo: './assets/feishu-logo.png', desc: '搜索并使用文档、会议、任务和多维表格。' },
  { id: 'notion', name: 'Notion', maker: 'Notion Labs', color: '#eeeeeb', letter: 'N', logo: './assets/notion-logo.svg', dark: true, desc: '让 Syntropic 访问团队知识库与项目文档。' },
  { id: 'moka', name: 'Moka', maker: 'Moka', color: '#6657d9', letter: 'M', logo: './assets/apps/moka.png', desc: '连接候选人、职位、招聘阶段和人才库。' },
  { id: 'beisen', name: '北森', maker: 'Beisen', color: '#1684e8', letter: '北', logo: './assets/apps/beisen.ico', desc: '连接招聘流程、人才库和面试评价。' },
  { id: 'dingtalk', name: '钉钉', maker: 'Alibaba', color: '#1688ff', letter: '钉', logo: './assets/apps/dingtalk.png', desc: '连接项目协作、审批和工作通知。' },
  { id: 'wecom', name: '企业微信', maker: 'Tencent', color: '#2aab5f', letter: '企', logo: './assets/apps/wecom.png', desc: '连接客户群、用户反馈和团队沟通。' },
  { id: 'slack', name: 'Slack', maker: 'Salesforce', color: '#4a154b', letter: 'S', logo: './assets/apps/slack.png', desc: '搜索频道、总结讨论并发送协作消息。' },
  { id: 'github', name: 'GitHub', maker: 'GitHub', color: '#30343b', letter: 'G', logo: './assets/apps/github.svg', desc: '读取仓库、Issue、Pull Request 与代码变更。' },
  { id: 'drive', name: 'Google Drive', maker: 'Google', color: '#3d8b68', letter: 'D', logo: './assets/apps/google-drive.png', desc: '连接云端文件、表格和团队共享空间。' },
  { id: 'linear', name: 'Linear', maker: 'Linear', color: '#5b5ce2', letter: 'L', logo: './assets/apps/linear.png', desc: '管理产品问题、项目进度和团队路线图。' },
  { id: 'figma', name: 'Figma', maker: 'Figma', color: '#e75b42', letter: 'F', logo: './assets/apps/figma.png', desc: '读取设计稿、评论和组件上下文。' },
  { id: 'salesforce', name: 'Salesforce', maker: 'Salesforce', color: '#1796d2', letter: 'S', logo: './assets/apps/salesforce.svg', desc: '查询客户、商机和销售活动数据。' },
  { id: 'calendar', name: 'Google Calendar', maker: 'Google', color: '#4b75df', letter: '31', logo: './assets/apps/google-calendar.svg', desc: '查看日程、安排会议和分析时间分配。' }
];

const installedAppsKey = 'syntropic-installed-apps-v1';

function loadInstalledAppIds() {
  const stored = localStorage.getItem(installedAppsKey);
  if (stored !== null) {
    try { return new Set(JSON.parse(stored).filter((id) => plugins.some((plugin) => plugin.id === id))); } catch { return new Set(); }
  }
  try {
    const profile = JSON.parse(localStorage.getItem('syntropic-user-profile-v1') || 'null');
    return new Set((profile?.sources || []).filter((id) => plugins.some((plugin) => plugin.id === id)));
  } catch { return new Set(); }
}

const installedAppIds = loadInstalledAppIds();

// The dock's right section shows the components that belong to the current
// workspace (its dynamic items), not globally installed data-source apps.
const workspaceComponentLabels = {
  'hr-goal': '招聘目标', 'hr-agent-status': 'Agent 状态', 'hr-schedule': '今日日程', 'hr-pipeline': '候选人管道',
  'hr-insight-card': '洞察卡片', 'hr-insights': '招聘洞察', 'hr-activity': '最新动态', 'hr-artifact': '产出物', 'hr-files': '文件库',
  'product-goal': '需求目标', 'product-progress': '项目进展', 'product-risks': '风险跟踪', 'product-activity': '产品动态',
  text: '文本', 'hero-text': '标语', 'section-label': '分组标题', image: '图片', file: '文件',
  'document-preview': '文档预览', zone: '分组', note: '便签',
};

const workspaceComponentIcons = {
  'hr-goal': 'chart', 'product-goal': 'chart', 'product-progress': 'chart',
  'hr-schedule': 'calendar', 'hr-pipeline': 'user', 'hr-insights': 'spark', 'hr-insight-card': 'spark',
  'hr-activity': 'message', 'product-activity': 'message', 'product-risks': 'doc',
  'hr-artifact': 'doc', 'hr-files': 'folder', text: 'text', 'hero-text': 'text',
  'section-label': 'pin', image: 'image', file: 'doc', 'document-preview': 'doc', zone: 'grid', note: 'edit',
};

function workspaceComponentIcon(item) {
  const icon = workspaceComponentIcons[item.type] || 'blocks';
  return `<span class="workspace-component-icon" data-icon="${icon}"></span>`;
}

function renderDockWorkspaceComponents() {
  const container = document.querySelector('#dockInstalledApps');
  const divider = document.querySelector('#installedAppsDivider');
  if (!container || !divider) return;
  const canvas = getCurrentCanvas();
  const items = (canvas?.dynamicItems || []).filter((item) => !['app', 'arrow'].includes(item.type));
  const minimized = new Set(canvas?.minimizedItems || []);
  const recruitingWindow = canvas?.id === 'hr-recruiting' ? findWorkspaceWindow('hr-recruiting-app', canvas.id) : null;
  const recruitingVisible = Boolean(recruitingWindow?.classList.contains('open'));
  // 人才招聘 is a persistent workspace component, so its Dock icon follows
  // the same contract as every card: always present, with a minimized state.
  const appEntryMarkup = canvas?.id === 'hr-recruiting'
    ? `<button class="dock-item mini-app workspace-component workspace-window-entry${recruitingVisible ? '' : ' minimized'}" type="button" data-dock-app="hr-recruiting-app" data-label="人才招聘${recruitingVisible ? '' : '（已最小化）'}" aria-label="${recruitingVisible ? '人才招聘' : '恢复人才招聘窗口'}"><span class="workspace-component-icon" data-icon="recruiting"></span></button>`
    : '';
  divider.hidden = !items.length && !appEntryMarkup;
  container.innerHTML = appEntryMarkup + items.map((item) => {
    const label = item.title || workspaceComponentLabels[item.type] || '组件';
    const state = minimized.has(item.id) ? ' minimized' : '';
    return `<button class="dock-item mini-app workspace-component${state}" type="button" data-workspace-component="${workspaceNameHTML(item.id)}" data-label="${workspaceNameHTML(label)}${minimized.has(item.id) ? '（已最小化）' : ''}" aria-label="${workspaceNameHTML(label)}">${workspaceComponentIcon(item)}</button>`;
  }).join('');
  hydrateIcons(container);
}

// Every dynamic component gets a unified header: info on the left, minimize
// and a three-dot "more" menu on the right. innerHTML refreshes re-run this.
function attachMinimizeControl(object) {
  const itemId = object.dataset.objectId;
  const header = object.querySelector(':scope > header');
  const menuButton = object.querySelector('[data-component-menu]');
  const menuPopover = object.querySelector('[data-component-menu-popover]');
  const removeButton = object.querySelector('.dynamic-remove');
  object.querySelector(':scope > .component-header-actions')?.remove();

  const minimizeButton = document.createElement('button');
  minimizeButton.type = 'button';
  minimizeButton.className = 'dynamic-minimize';
  minimizeButton.title = '最小化组件';
  minimizeButton.setAttribute('aria-label', '最小化组件');
  minimizeButton.innerHTML = '<span data-icon="minimize"></span>';
  minimizeButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    minimizeCanvasObject(itemId);
  });

  // Generated cards use the same action host and popover geometry as every
  // template component. Their data attributes stay intact for CRUD dispatch.
  if (menuButton) {
    const actions = document.createElement('span');
    actions.className = 'component-header-actions';
    menuButton.classList.add('component-menu-toggle');
    menuPopover?.classList.add('component-action-menu');
    actions.append(minimizeButton, menuButton);
    if (menuPopover) actions.appendChild(menuPopover);
    header?.appendChild(actions);
    hydrateIcons(actions);
    return;
  }
  // Bare text-like objects keep the compact control next to their remove button.
  if (!header) {
    if (removeButton) removeButton.insertAdjacentElement('beforebegin', minimizeButton);
    else object.appendChild(minimizeButton);
    hydrateIcons(minimizeButton);
    return;
  }
  const actions = document.createElement('span');
  actions.className = 'component-header-actions';
  actions.appendChild(minimizeButton);
  const moreButton = document.createElement('button');
  moreButton.type = 'button';
  moreButton.className = 'component-more-toggle component-menu-toggle';
  moreButton.title = '更多操作';
  moreButton.setAttribute('aria-label', '更多操作');
  moreButton.innerHTML = '<span data-icon="more"></span>';
  const menu = document.createElement('div');
  menu.className = 'component-header-menu component-action-menu';
  // Managed (template/system) capabilities live here now — the old hover menu
  // dispatch in components.js handles these data-managed-action buttons.
  menu.innerHTML = `
    <button type="button" data-managed-action="inspect" data-managed-id="${itemId}"><span data-icon="search"></span>查看与编辑</button>
    <button type="button" data-managed-action="ai" data-managed-id="${itemId}"><span data-icon="spark"></span>用 Syntropic 修改</button>
    <button type="button" data-managed-action="duplicate" data-managed-id="${itemId}"><span data-icon="plus"></span>复制为新组件</button>
    <button type="button" data-header-action="minimize"><span data-icon="minimize"></span>最小化</button>
    <button type="button" data-header-action="remove"><span data-icon="close"></span>从桌面移除</button>`;
  actions.appendChild(moreButton);
  actions.appendChild(menu);
  header.appendChild(actions);
  hydrateIcons(actions);
}

document.querySelector('#dockInstalledApps')?.addEventListener('click', (event) => {
  const appButton = event.target.closest('[data-dock-app]');
  if (appButton) {
    if (appButton.dataset.dockApp === 'hr-recruiting-app') {
      const recruitingWindow = findWorkspaceWindow('hr-recruiting-app');
      if (recruitingWindow?.classList.contains('open')) hideWorkspaceWindow(recruitingWindow, { minimized:true });
      else openHRRecruitingApp();
    }
    return;
  }
  const button = event.target.closest('[data-workspace-component]');
  if (!button) return;
  const itemId = button.dataset.workspaceComponent;
  // Dock icons toggle the component: minimized -> restore, visible -> minimize.
  if (button.classList.contains('minimized')) restoreWorkspaceComponent(itemId);
  else minimizeCanvasObject(itemId);
});

function minimizeCanvasObject(itemId) {
  const canvas = getCurrentCanvas();
  if (canvas) {
    canvas.minimizedItems ||= [];
    if (!canvas.minimizedItems.includes(itemId)) canvas.minimizedItems.push(itemId);
    saveCanvasRegistry();
  }
  const object = canvasObjects.find((entry) => entry.dataset.objectId === itemId);
  if (object) {
    canvasObjects = canvasObjects.filter((entry) => entry !== object);
    object.classList.add('leaving');
    setTimeout(() => object.remove(), 180);
  }
  renderDockWorkspaceComponents();
  showToast('组件已最小化，在 Dock 点击图标可恢复');
}

function restoreWorkspaceComponent(itemId) {
  const canvas = getCurrentCanvas();
  if (!canvas) return;
  canvas.minimizedItems = (canvas.minimizedItems || []).filter((id) => id !== itemId);
  saveCanvasRegistry();
  const item = (canvas.dynamicItems || []).find((entry) => entry.id === itemId);
  if (item && !canvasObjects.some((entry) => entry.dataset.objectId === itemId)) {
    addDynamicCanvasItem({ ...item, ...(canvas.layout?.[itemId] || {}) }, { persist: false });
  }
  renderDockWorkspaceComponents();
  focusWorkspaceComponent(itemId);
}

function focusWorkspaceComponent(itemId) {
  const canvas = getCurrentCanvas();
  const item = canvas?.dynamicItems?.find((entry) => entry.id === itemId);
  if (!item) return;
  const position = canvas.layout?.[itemId] || item;
  const scale = canvasView.scale || 1;
  canvasView.x = Math.round(desktopViewportSize().width / 2 - (Number(position.x) + 160) * scale);
  canvasView.y = Math.round(desktopViewportSize().height / 2 - (Number(position.y) + 90) * scale);
  applyCanvasView();
  const node = document.querySelector(`.dynamic-canvas-object[data-object-id="${itemId}"]`);
  if (node) {
    node.classList.add('dock-focus');
    setTimeout(() => node.classList.remove('dock-focus'), 1500);
  }
}

// Three-dot menus on component headers: toggle, action dispatch, outside close.
// While a menu is open its host object is raised so sibling components can no
// longer paint over the popover (every canvas object is its own stacking context).
function closeComponentHeaderMenu(menu) {
  menu.classList.remove('open');
  menu.setAttribute('aria-hidden', 'true');
  menu.closest('.canvas-object')?.classList.remove('menu-open');
}

document.addEventListener('click', (event) => {
  const toggle = event.target.closest('.component-more-toggle');
  const openMenus = document.querySelectorAll('.component-action-menu.open');
  if (toggle) {
    const own = toggle.parentElement.querySelector('.component-action-menu');
    openMenus.forEach((menu) => { if (menu !== own) closeComponentHeaderMenu(menu); });
    if (own) {
      const opening = !own.classList.contains('open');
      own.classList.toggle('open');
      own.setAttribute('aria-hidden', String(!opening));
      own.closest('.canvas-object')?.classList.toggle('menu-open', opening);
    }
    return;
  }
  const windowAction = event.target.closest('.window-header-menu [data-window-menu-action]');
  if (windowAction) {
    const win = windowAction.closest('.os-window');
    closeComponentHeaderMenu(windowAction.closest('.component-header-menu'));
    if (!win) return;
    if (windowAction.dataset.windowMenuAction === 'close') {
      win.remove();
      syncWorkspaceWindows();
      renderDockWorkspaceComponents();
      showToast('窗口已关闭');
    } else {
      hideWorkspaceWindow(win, { minimized:true });
    }
    return;
  }
  const action = event.target.closest('.component-header-menu [data-header-action]');
  if (action) {
    const object = action.closest('.dynamic-canvas-object');
    closeComponentHeaderMenu(action.closest('.component-header-menu'));
    if (!object) return;
    if (action.dataset.headerAction === 'minimize') minimizeCanvasObject(object.dataset.objectId);
    if (action.dataset.headerAction === 'remove') removeDynamicCanvasItem(object.dataset.objectId, '组件已从桌面移除');
    return;
  }
  openMenus.forEach(closeComponentHeaderMenu);
});

function setAppInstalled(id, installed, { silent = false } = {}) {
  const plugin = plugins.find((item) => item.id === id);
  if (!plugin) return false;
  if (installed) installedAppIds.add(id); else installedAppIds.delete(id);
  localStorage.setItem(installedAppsKey, JSON.stringify([...installedAppIds]));
  if (!silent) showToast(installed ? `${plugin.name}已安装` : `${plugin.name}已卸载`);
  return true;
}

function installAppsFromOnboarding(ids = []) {
  ids.filter((id) => plugins.some((plugin) => plugin.id === id)).forEach((id) => installedAppIds.add(id));
  localStorage.setItem(installedAppsKey, JSON.stringify([...installedAppIds]));
}

window.SyntropicApps = {
  installFromOnboarding: installAppsFromOnboarding,
  isInstalled: (id) => installedAppIds.has(id),
  setInstalled: setAppInstalled,
};

const launchpadApps = [
  { name: '代码审查', icon: 'code', color: 'linear-gradient(145deg,#4e63dd,#3546a8)', category: '产品开发', action: 'placeholder' },
  { name: 'API 构建', icon: 'terminal', color: 'linear-gradient(145deg,#3d8d7b,#286b5d)', category: '产品开发', action: 'placeholder' },
  { name: '调试助手', icon: 'terminal', color: 'linear-gradient(145deg,#45596f,#29394b)', category: '产品开发', action: 'placeholder' },
  { name: 'GitHub', letter: 'G', color: 'linear-gradient(145deg,#42474f,#25292e)', category: '产品开发', open: 'source-github' },
  { name: 'Linear', letter: 'L', color: 'linear-gradient(145deg,#7167ee,#5146ce)', category: '产品开发', open: 'source-linear' },

  { name: '深度调研', icon: 'search', color: 'linear-gradient(145deg,#38a5bd,#267b95)', category: '调研设计', action: 'browser' },
  { name: '数据分析', icon: 'chart', color: 'linear-gradient(145deg,#23a37a,#187b5c)', category: '调研设计', action: 'placeholder' },
  { name: '图表生成', icon: 'chart', color: 'linear-gradient(145deg,#3e8edf,#286cb5)', category: '调研设计', action: 'placeholder' },
  { name: 'Figma', letter: 'F', color: 'linear-gradient(145deg,#ff6c55,#e54c3b)', category: '调研设计', open: 'source-figma' },
  { name: '用户访谈', icon: 'user', color: 'linear-gradient(145deg,#d26a9e,#a8497c)', category: '调研设计', action: 'placeholder' },

  { name: '写作助手', icon: 'edit', color: 'linear-gradient(145deg,#627eea,#4961c8)', category: '内容创作', action: 'placeholder' },
  { name: '邮件撰写', icon: 'mail', color: 'linear-gradient(145deg,#5a9be6,#3979c8)', category: '内容创作', action: 'placeholder' },
  { name: 'PPT 生成', icon: 'presentation', color: 'linear-gradient(145deg,#e36d57,#c84a39)', category: '内容创作', action: 'placeholder' },
  { name: '会议纪要', icon: 'message', color: 'linear-gradient(145deg,#29a6a2,#1b7f7c)', category: '内容创作', action: 'placeholder' },
  { name: '图片生成', icon: 'image', color: 'linear-gradient(145deg,#a56ce3,#7c4fc0)', category: '内容创作', action: 'placeholder' },

  { name: '任务', icon: 'message', color: 'linear-gradient(145deg,#5c8bf2,#3d6ed9)', category: '效率提升', action: 'all-tasks' },
  { name: '定时任务', icon: 'clock', color: 'linear-gradient(145deg,#f1a04f,#dc7c28)', category: '效率提升', action: 'schedule' },
  { name: 'Syntropic Browser', icon: 'globe', color: 'linear-gradient(145deg,#4db4d4,#318dab)', category: '效率提升', action: 'browser' },
  { name: '应用市场', icon: 'blocks', color: 'linear-gradient(145deg,#7886f5,#5a67de)', category: '效率提升', action: 'market' },
  { name: '飞书', letter: 'L', color: 'linear-gradient(145deg,#3f7df3,#2762d9)', category: '效率提升', open: 'source-lark' },

  { name: '日程规划', icon: 'calendar', color: 'linear-gradient(145deg,#ef675f,#d84b45)', category: '生活服务', action: 'placeholder' },
  { name: '出行规划', icon: 'map', color: 'linear-gradient(145deg,#49a583,#317b64)', category: '生活服务', action: 'placeholder' },
  { name: '健康助手', icon: 'heart', color: 'linear-gradient(145deg,#f26f83,#d95068)', category: '生活服务', action: 'placeholder' },
  { name: '智能记账', icon: 'wallet', color: 'linear-gradient(145deg,#43ae8a,#2c8769)', category: '生活服务', action: 'placeholder' },
  { name: '新闻摘要', icon: 'news', color: 'linear-gradient(145deg,#65758b,#465568)', category: '生活服务', action: 'placeholder' },
];

const windowLayer = document.querySelector('#windowLayer');
let topZ = 80;
let windowOffset = 0;

function shell(id, title, titleIcon, body, className = '', size = {}, options = {}) {
  const workspaceId = currentCanvasId || 'default';
  const existing = findWorkspaceWindow(id, workspaceId);
  if (existing) {
    existing.classList.add('open');
    existing.classList.remove('workspace-hidden');
    existing.dataset.minimized = 'false';
    existing.setAttribute('aria-hidden', 'false');
    front(existing);
    renderDockWorkspaceComponents();
    return existing;
  }
  const win = document.createElement('article');
  win.className = `os-window ${className}`;
  win.dataset.window = id;
  win.dataset.workspaceId = workspaceId;
  win.style.setProperty('--x', size.x || `${13 + (windowOffset % 4) * 2.4}vw`);
  win.style.setProperty('--y', size.y || `${5 + (windowOffset % 4) * 2.2}vh`);
  win.style.setProperty('--w', size.w || '980px');
  win.style.setProperty('--h', size.h || '680px');
  windowOffset += 1;
  const headerControls = options.headerControls ? `
      <div class="window-header-actions">
        <button type="button" class="dynamic-minimize" data-window-action="minimize" title="最小化" aria-label="最小化窗口"><span data-icon="minimize"></span></button>
        <button type="button" class="component-more-toggle component-menu-toggle" title="更多操作" aria-label="更多操作"><span data-icon="more"></span></button>
        <div class="component-header-menu component-action-menu window-header-menu" aria-hidden="true">
          <button type="button" data-window-menu-action="minimize"><span data-icon="minimize"></span>最小化窗口</button>
          <button type="button" data-window-menu-action="close"><span data-icon="close"></span>关闭窗口</button>
        </div>
      </div>` : '';
  win.innerHTML = `
    <header class="window-bar">
      <div class="traffic"><button type="button" data-window-action="close" aria-label="关闭"></button><button type="button" data-window-action="minimize" aria-label="最小化"></button><button type="button" data-window-action="expand" aria-label="全屏"></button></div>
      <div class="window-title"><span data-icon="${titleIcon}"></span>${title}</div>
      <div class="window-spacer">${headerControls}</div>
    </header>
    <div class="window-body">${body}</div>`;
  windowLayer.appendChild(win);
  syncWorkspaceWindows();
  hydrateIcons(win);
  bindWindow(win);
  requestAnimationFrame(() => {
    win.classList.add('open');
    win.dataset.minimized = 'false';
    win.setAttribute('aria-hidden', 'false');
    front(win);
    renderDockWorkspaceComponents();
  });
  return win;
}

function findWorkspaceWindow(id, workspaceId = currentCanvasId) {
  return [...windowLayer.querySelectorAll('.os-window')].find((win) => win.dataset.window === id && win.dataset.workspaceId === workspaceId) || null;
}

function syncWorkspaceWindows() {
  const currentWindows = [];
  windowLayer.querySelectorAll('.os-window').forEach((win) => {
    const belongsToCurrentWorkspace = win.dataset.workspaceId === currentCanvasId;
    win.classList.toggle('workspace-hidden', !belongsToCurrentWorkspace);
    if (!belongsToCurrentWorkspace) win.classList.remove('front');
    win.setAttribute('aria-hidden', String(!belongsToCurrentWorkspace || !win.classList.contains('open')));
    if (belongsToCurrentWorkspace && win.classList.contains('open')) currentWindows.push(win);
  });
  if (currentWindows.length) {
    const frontmost = currentWindows.reduce((top, win) => Number(win.style.zIndex || 0) > Number(top.style.zIndex || 0) ? win : top);
    front(frontmost);
  }
}

function front(win) {
  windowLayer.querySelectorAll('.os-window').forEach((item) => item.classList.remove('front'));
  win.classList.add('front');
  win.style.zIndex = String(++topZ);
}

function hideWorkspaceWindow(win, { minimized = false } = {}) {
  if (!win) return;
  win.classList.remove('open', 'front');
  win.dataset.minimized = String(minimized);
  win.setAttribute('aria-hidden', 'true');
  renderDockWorkspaceComponents();
}

function bindWindow(win) {
  win.addEventListener('pointerdown', () => front(win));
  win.querySelectorAll('[data-window-action="close"]').forEach((button) => button.addEventListener('click', () => hideWorkspaceWindow(win)));
  win.querySelectorAll('[data-window-action="minimize"]').forEach((button) => button.addEventListener('click', () => hideWorkspaceWindow(win, { minimized:true })));
  const toggleExpanded = () => {
    const expanded = win.classList.toggle('expanded');
    if (expanded) {
      win.dataset.restore = JSON.stringify({ x: win.style.left, y: win.style.top, w: win.style.width, h: win.style.height });
      Object.assign(win.style, { left: '10px', top: '8px', width: 'calc(100vw - 20px)', height: 'calc(100vh - 170px)' });
    } else {
      const restore = JSON.parse(win.dataset.restore || '{}');
      Object.assign(win.style, { left: restore.x || '', top: restore.y || '', width: restore.w || '', height: restore.h || '' });
    }
  };
  win.querySelector('[data-window-action="expand"]').addEventListener('click', (event) => {
    event.stopPropagation();
    toggleExpanded();
  });
  const bar = win.querySelector('.window-bar');
  bar.addEventListener('dblclick', (event) => {
    if (!event.target.closest('button')) toggleExpanded();
  });
  bar.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button') || win.classList.contains('expanded')) return;
    const rect = win.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    bar.setPointerCapture(event.pointerId);
    const move = (moveEvent) => {
      const x = Math.max(0, Math.min(innerWidth - 130, rect.left + moveEvent.clientX - startX));
      const y = Math.max(44, Math.min(innerHeight - 140, rect.top + moveEvent.clientY - startY));
      win.style.left = `${x}px`;
      win.style.top = `${y - 44}px`;
    };
    const end = () => {
      bar.removeEventListener('pointermove', move);
      bar.removeEventListener('pointerup', end);
      bar.removeEventListener('pointercancel', end);
    };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);
  });

  ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'].forEach((direction) => {
    const handle = document.createElement('span');
    handle.className = `window-resize-handle resize-${direction}`;
    handle.dataset.resizeDirection = direction;
    handle.setAttribute('aria-hidden', 'true');
    win.appendChild(handle);
  });
  win.addEventListener('pointerdown', (event) => {
    const handle = event.target.closest('[data-resize-direction]');
    if (!handle || win.classList.contains('expanded')) return;
    event.preventDefault();
    event.stopPropagation();
    front(win);
    const direction = handle.dataset.resizeDirection;
    const bounds = windowLayer.getBoundingClientRect();
    const rect = win.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = rect.left - bounds.left;
    const startTop = rect.top - bounds.top;
    const startWidth = rect.width;
    const startHeight = rect.height;
    const computed = getComputedStyle(win);
    const minWidth = Math.min(parseFloat(computed.minWidth) || 560, bounds.width);
    const minHeight = Math.min(parseFloat(computed.minHeight) || 420, bounds.height);
    handle.setPointerCapture(event.pointerId);
    win.classList.add('resizing');
    let finished = false;

    const resize = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      let left = startLeft;
      let top = startTop;
      let width = startWidth;
      let height = startHeight;
      if (direction.includes('e')) width = Math.max(minWidth, Math.min(startWidth + dx, bounds.width - startLeft));
      if (direction.includes('s')) height = Math.max(minHeight, Math.min(startHeight + dy, bounds.height - startTop));
      if (direction.includes('w')) {
        left = Math.max(0, Math.min(startLeft + dx, startLeft + startWidth - minWidth));
        width = startWidth + startLeft - left;
      }
      if (direction.includes('n')) {
        top = Math.max(0, Math.min(startTop + dy, startTop + startHeight - minHeight));
        height = startHeight + startTop - top;
      }
      Object.assign(win.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
    };
    const finish = () => {
      if (finished) return;
      finished = true;
      win.classList.remove('resizing');
      win.removeEventListener('pointermove', resize);
      win.removeEventListener('pointerup', finish);
      win.removeEventListener('pointercancel', finish);
      handle.removeEventListener('lostpointercapture', finish);
    };
    win.addEventListener('pointermove', resize);
    win.addEventListener('pointerup', finish);
    win.addEventListener('pointercancel', finish);
    handle.addEventListener('lostpointercapture', finish);
  });
}

function taskListMarkup(activeId) {
  return visibleGeneralTaskEntries().map(([id, task]) => `
    <button class="task-list-item${id === activeId ? ' selected' : ''}" type="button" data-task-select="${id}">
      <i class="agent-face">${task.letter}</i><span><strong>${task.title}</strong><small>${task.agent}</small></span>
    </button>`).join('');
}

function generalTaskRecommendations() {
  const ids = currentCanvasId === 'product-release'
    ? ['task-release-check', 'task-roadmap', 'task-launch']
    : ['task-pricing', 'task-weekly', 'task-release-check'];
  return ids.map((id) => [id, taskData[id]]).filter(([, task]) => task);
}

function generalTaskEmptyMarkup() {
  const recommendations = generalTaskRecommendations();
  return `<main class="task-recommendation-panel">
    <span class="task-recommendation-mark"><i data-icon="spark"></i></span>
    <small>SYNTROPIC 推荐</small><h2>还没有任务，从一个目标开始</h2>
    <p>我会根据当前工作台、已连接的数据源和你的角色推荐适合持续推进的任务。</p>
    <section>${recommendations.map(([id, task]) => `<article><span data-icon="${id === 'task-weekly' ? 'clock' : id === 'task-roadmap' ? 'chart' : 'spark'}"></span><div><strong>${task.title}</strong><small>${task.description}</small></div><button type="button" data-task-recommend="${id}">开始任务</button></article>`).join('')}</section>
  </main>`;
}

function taskConversationMarkup(task, taskId) {
  return `<section class="task-conversation-panel">
    <header class="conversation-head"><span><strong>${task.title}</strong><small>${task.agent}</small></span><div class="task-head-actions"><span>自动保存 · 可随时接管</span><button type="button" data-task-create-component="${taskId}"><span data-icon="blocks"></span>生成组件</button></div></header>
    <div class="message-stream task-message-stream" data-task-message-stream>
      <div class="message user">${task.user}</div>
      <div class="message agent"><i class="agent-face">${task.letter}</i><div><p>${task.reply}</p><div class="tool-call"><header><span data-icon="browser"></span><strong>${task.tool}</strong><time>刚刚</time></header><p>${task.detail}</p></div></div></div>
      <div class="message agent"><i class="agent-face">${task.letter}</i><div><p>任务会持续在后台推进。需要判断或确认时，我会把它带回桌面。</p></div></div>
    </div>
    <div class="typing-row"><div class="typing-box"><input data-task-input autocomplete="off" placeholder="继续任务，或让它生成桌面组件…" aria-label="继续当前任务" /><button type="button" data-task-send aria-label="发送消息"><span data-icon="arrow-up"></span></button></div></div>
  </section>`;
}

function renderTaskPanel(win, id) {
  const entries = visibleGeneralTaskEntries();
  const activeId = visibleGeneralTaskIds.has(id) ? id : entries[0]?.[0] || '';
  const task = activeId ? taskData[activeId] : null;
  win.dataset.activeTask = activeId;
  win.querySelector('.task-center-body').innerHTML = `
    <aside class="task-list-panel"><header><span data-icon="message"></span><strong>任务</strong><small>${entries.length}</small></header><nav>${taskListMarkup(activeId)}${entries.length ? '' : '<span class="task-list-empty">暂无任务</span>'}</nav></aside>
    ${task ? taskConversationMarkup(task, activeId) : generalTaskEmptyMarkup()}`;
  hydrateIcons(win);
}

function startRecommendedGeneralTask(win, id) {
  const task = taskData[id];
  if (!task) return;
  visibleGeneralTaskIds.add(id);
  if (syntropicMode === 'demo') {
    task.state = 'running';
    task.stateText = '执行中';
    task.reply = '任务已经创建。我正在读取当前工作台和已授权的数据源，并制定第一轮执行计划。';
    task.tool = '正在同步任务上下文';
    task.detail = '完成上下文整理后，我会持续更新进度并在需要确认时通知你。';
  }
  saveVisibleGeneralTasks();
  updateTaskExperienceCounts();
  renderTaskPanel(win, id);
  showToast(`“${task.title}”已开始`);
}

function taskRequestsComponent(message) {
  return /(生成|创建|做一张|做一个|放到|固定到).*(组件|卡片|看板|桌面)|(?:组件|卡片).*(生成|创建|放到|固定到)/.test(message);
}

function createTaskComponent(win, taskId, task, instruction = '', variant = 'default') {
  const result = window.SyntropicComponents?.createFromTask?.(taskId, task, instruction);
  if (!result) { showToast('组件能力正在加载，请稍后再试'); return false; }
  const stream = win.querySelector(variant === 'hr' ? '[data-hr-message-stream]' : '[data-task-message-stream]');
  if (!stream) return true;
  const reply = document.createElement('div');
  if (variant === 'hr') {
    reply.className = 'hr-codex-message agent entering';
    reply.innerHTML = `<i class="hr-agent-avatar">S</i><div><p>${result.updated ? '已根据这段任务对话更新外部组件。' : '已根据这段任务对话生成外部组件，并放到当前工作台。'}</p><section class="hr-codex-tool-card task-component-result"><header><span><i data-icon="blocks"></i><strong>${workspaceNameHTML(result.title)}</strong></span><em>${result.updated ? 'UPDATED' : 'CREATED'}</em></header><footer><span>来源：当前任务对话</span><button type="button" data-task-component-view="${result.id}">回到桌面查看 <i data-icon="arrow"></i></button></footer></section></div>`;
  } else {
    reply.className = 'message agent entering task-component-message';
    reply.innerHTML = `<i class="agent-face">S</i><div><p>${result.updated ? '已根据当前对话更新桌面组件。' : '已生成外部组件，并放到当前工作台。'}</p><div class="tool-call task-component-result"><header><span data-icon="blocks"></span><strong>${workspaceNameHTML(result.title)}</strong><time>${result.updated ? '已更新' : '已生成'}</time></header><p>保留了任务、Agent、上下文和本次生成指令。</p><button type="button" data-task-component-view="${result.id}">回到桌面查看 <span data-icon="arrow"></span></button></div></div>`;
  }
  stream.append(reply); hydrateIcons(reply); stream.scrollTop = stream.scrollHeight;
  return true;
}

function sendTaskMessage(win) {
  const input = win.querySelector('[data-task-input]');
  const stream = win.querySelector('[data-task-message-stream]');
  const taskId = win.dataset.activeTask;
  const task = taskData[taskId];
  const message = input?.value.trim();
  if (!message || !stream || !task) return;
  const userMessage = document.createElement('div');
  userMessage.className = 'message user entering'; userMessage.textContent = message;
  stream.append(userMessage); input.value = ''; stream.scrollTop = stream.scrollHeight;
  if (taskRequestsComponent(message)) { createTaskComponent(win, taskId, task, message); return; }
  const reply = document.createElement('div');
  reply.className = 'message agent entering';
  reply.innerHTML = '<i class="agent-face">S</i><div><p>收到。我会把这条要求加入当前任务；你也可以直接让我把当前结果生成成桌面组件。</p></div>';
  stream.append(reply); stream.scrollTop = stream.scrollHeight;
  showToast('消息已发送给 Agent');
}

function openTask(id) {
  const win = shell('task-center', '任务', 'message', '<div class="task-center-body"></div>', 'task-window task-center-window', { w: '1040px', h: '680px', x: '12vw', y: '4vh' });
  renderTaskPanel(win, id);
  if (win.dataset.taskCenterBound) return;
  win.dataset.taskCenterBound = 'true';
  win.addEventListener('click', (event) => {
    const taskButton = event.target.closest('[data-task-select]');
    if (taskButton) { renderTaskPanel(win, taskButton.dataset.taskSelect); return; }
    const recommendation = event.target.closest('[data-task-recommend]');
    if (recommendation) { startRecommendedGeneralTask(win, recommendation.dataset.taskRecommend); return; }
    const createButton = event.target.closest('[data-task-create-component]');
    if (createButton) { createTaskComponent(win, createButton.dataset.taskCreateComponent, taskData[createButton.dataset.taskCreateComponent]); return; }
    const viewButton = event.target.closest('[data-task-component-view]');
    if (viewButton) {
      win.querySelector('[data-window-action="close"]')?.click();
      setTimeout(() => window.SyntropicComponents?.focusById?.(viewButton.dataset.taskComponentView), 180);
      return;
    }
    if (event.target.closest('[data-task-send]')) sendTaskMessage(win);
  });
  win.addEventListener('keydown', (event) => {
    if (event.target.matches('[data-task-input]') && event.key === 'Enter') { event.preventDefault(); sendTaskMessage(win); }
  });
}

const feedbackInsightViews = {
  theme: {
    caption: '来自 126 条跨系统反馈，主题支持多标签归类。',
    items: [
      ['流程频繁中断', 42, '42 条反馈 · 影响交付与审批'],
      ['任务进展不可见', 35, '35 条反馈 · 管理者重复追问'],
      ['跨工具信息断层', 29, '29 条反馈 · 文档与任务脱节'],
      ['权限确认耗时', 20, '20 条反馈 · 外部协作受阻'],
    ],
  },
  source: {
    caption: '已在用户授权范围内读取并保留原始引用。',
    items: [
      ['客服工单', 64, '64 条 · 飞书服务台'],
      ['客户群反馈', 31, '31 条 · 飞书群聊'],
      ['用户访谈', 18, '18 场 · 飞书妙记'],
      ['产品数据', 13, '13 个异常 · 数据看板'],
    ],
  },
  trend: {
    caption: '最近四周，任务进展可见性相关反馈持续上升。',
    items: [
      ['第 1 周', 19, '19 条有效反馈'],
      ['第 2 周', 27, '27 条有效反馈'],
      ['第 3 周', 34, '34 条有效反馈'],
      ['本周', 46, '46 条有效反馈'],
    ],
  },
};

function feedbackArtifactMarkup() {
  return `<div class="artifact-window-body feedback-artifact-body">
    <main class="artifact-page feedback-artifact-page"><article>
      <span class="eyebrow">Syntropic · CONNECTED WORKFLOW INTELLIGENCE</span>
      <h2>把跨系统办公数据变成下一步行动</h2>
      <p class="lede">Syntropic 在授权范围内连接飞书会议、客服工单、客户群与产品数据，自动完成归集、去重、主题聚类和证据回溯，把分散的工作上下文整理成团队可以直接执行的洞察。</p>
      <section class="workflow-source-strip" aria-label="演示办公数据">
        <span><i data-icon="message"></i><b>飞书妙记</b><small>18 场访谈</small></span>
        <span><i data-icon="file"></i><b>客服工单</b><small>64 条记录</small></span>
        <span><i data-icon="message"></i><b>客户群</b><small>31 条反馈</small></span>
        <span><i data-icon="chart"></i><b>产品数据</b><small>13 个异常</small></span>
      </section>
      <section class="report-metrics connected-metrics">
        <div><span>有效工作信号</span><strong>126</strong><small>已去重并关联原始证据</small></div>
        <div><span>高影响问题</span><strong>3</strong><small>覆盖 68% 活跃客户</small></div>
        <div><span>建议行动</span><strong>7</strong><small>已按影响与成本排序</small></div>
      </section>
      <section class="interactive-insight" data-feedback-insight>
        <header>
          <span><b>客户反馈洞察</b><small>切换视角，探索模拟工作数据</small></span>
          <span class="insight-view-switcher" role="group" aria-label="图表视角">
            <button class="selected" type="button" data-insight-view="theme" aria-pressed="true">主题</button>
            <button type="button" data-insight-view="source" aria-pressed="false">来源</button>
            <button type="button" data-insight-view="trend" aria-pressed="false">趋势</button>
          </span>
        </header>
        <div class="insight-chart" data-insight-chart></div>
        <footer><span data-insight-caption></span><span>悬停或聚焦查看明细</span></footer>
      </section>
      <section class="insight-actions" aria-label="关键洞察与行动建议">
        <article><span>01</span><div><b>先解决“任务完成但团队不知道”</b><p>将任务状态、产物和审批结果自动回写到项目群与工作台，减少重复追问。</p></div><em>高影响</em></article>
        <article><span>02</span><div><b>让产物保留来源与决策链路</b><p>文档、数据与任务保持双向引用，任何结论都能回到原始会议、工单或指标。</p></div><em>本周可做</em></article>
        <article><span>03</span><div><b>在跨工具交接前自动补齐上下文</b><p>Syntropic 在任务流转时汇总相关记录、权限与待确认项，再交给下一位协作者。</p></div><em>建议试点</em></article>
      </section>
    </article></main>
  </div>`;
}

function renderFeedbackInsightChart(win, view = 'theme') {
  const data = feedbackInsightViews[view] || feedbackInsightViews.theme;
  const max = Math.max(...data.items.map((item) => item[1]));
  const chart = win.querySelector('[data-insight-chart]');
  if (!chart) return;
  chart.innerHTML = data.items.map(([label, value, detail]) => `
    <div class="insight-bar-row" tabindex="0" aria-label="${label}，${detail}">
      <span>${label}</span><i><b style="--bar-width:${Math.round((value / max) * 100)}%"></b></i><strong>${value}</strong><small>${detail}</small>
    </div>`).join('');
  win.querySelector('[data-insight-caption]').textContent = data.caption;
}

function bindFeedbackInsightChart(win) {
  if (win.dataset.feedbackInsightBound) return;
  win.dataset.feedbackInsightBound = 'true';
  renderFeedbackInsightChart(win);
  win.addEventListener('click', (event) => {
    const button = event.target.closest('[data-insight-view]');
    if (!button) return;
    win.querySelectorAll('[data-insight-view]').forEach((item) => {
      const selected = item === button;
      item.classList.toggle('selected', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    renderFeedbackInsightChart(win, button.dataset.insightView);
  });
}

function openArtifact(id) {
  const titleMap = { 'artifact-report': '竞品定价分析.html', 'artifact-brief': '产品发布 Brief', 'artifact-deck': '发布策略演示', 'artifact-feedback': '用户反馈洞察.html' };
  const isFeedback = id === 'artifact-feedback';
  const heading = id === 'artifact-brief' ? 'Q3 产品发布 Brief' : id === 'artifact-deck' ? 'One team. One launch.' : '竞品定价正在发生结构性变化';
  const lede = 'Syntropic 汇总了桌面任务中的上下文，并保留了所有原始来源。核心套餐标价基本稳定，但 AI 能力正在从高阶增值项进入基础版本。';
  const metrics = '<div><span>跟踪竞品</span><strong>8</strong></div><div><span>确认调价</span><strong>3</strong></div><div><span>引用来源</span><strong>12</strong></div>';
  const standardBody = `
    <div class="artifact-window-body">
      <main class="artifact-page"><article>
        <span class="eyebrow">Syntropic · COMPETITIVE INTELLIGENCE</span>
        <h2>${heading}</h2>
        <p class="lede">${lede}</p>
        <section class="report-metrics">${metrics}</section>
        <section class="report-graph"><header><span>AI 功能在基础套餐中的覆盖率</span><span>近 90 天</span></header><div class="graph-lines"><i style="--v:31%"></i><i style="--v:56%"></i><i style="--v:43%"></i><i style="--v:72%"></i><i style="--v:88%"></i></div></section>
      </article></main>
      <aside class="artifact-inspector"><h3>产物信息</h3><p>由 Syntropic Agent 根据任务上下文自动生成，并直接呈现在当前工作台。</p><div class="inspector-block"><strong>来源</strong><p>12 个网页</p><p>2 份内部文档</p><p>竞品基线表格</p></div><div class="inspector-block"><strong>可用操作</strong><p>继续编辑</p><p>导出为 PDF</p><p>分享给团队</p></div></aside>
    </div>`;
  const body = isFeedback ? feedbackArtifactMarkup() : standardBody;
  const win = shell(id, titleMap[id] || 'Syntropic 产物', 'file', body, 'artifact-window', { x: '12vw', y: '4vh', w: '1050px', h: '700px' });
  if (isFeedback) bindFeedbackInsightChart(win);
  let pinButton = win.querySelector('[data-artifact-pin]');
  if (!pinButton) {
    pinButton = document.createElement('button');
    pinButton.type = 'button';
    pinButton.className = 'window-pin-button';
    pinButton.dataset.artifactPin = id;
    win.querySelector('.window-spacer').appendChild(pinButton);
    pinButton.addEventListener('click', (event) => {
      event.stopPropagation();
      const pinned = toggleArtifactPin(id);
      if (pinned) closeWindowAfterPin(win);
    });
  }
  updateDocumentPinButtons();
}

function pluginCard(plugin) {
  return `<button class="plugin-card" type="button" data-plugin="${plugin.id}"><header>${pluginLogoMarkup(plugin)}<span><h3>${plugin.name}</h3><small>${plugin.maker}</small></span></header><p>${plugin.desc}</p></button>`;
}

function pluginLogoMarkup(plugin, className = 'plugin-icon') {
  if (!plugin.logo) {
    return `<span class="${className}" style="--plugin-color:${plugin.color};${plugin.dark ? 'color:#111' : ''}">${plugin.letter}</span>`;
  }
  return `<span class="${className} app-logo-frame logo-${plugin.id}"><img src="${plugin.logo}" alt="" /></span>`;
}

function marketBody() {
  return `<div class="market-body">
    <aside class="market-sidebar"><strong>应用市场</strong><button class="selected"><span data-icon="blocks"></span>发现</button><button><span data-icon="database"></span>数据源</button><button><span data-icon="plug"></span>办公应用</button><button><span data-icon="browser"></span>Agent 工具</button><hr/><button><span data-icon="folder"></span>已安装</button></aside>
    <main class="market-content">
      <section class="market-home"><header class="market-top"><h2>扩展 Syntropic</h2><label class="market-search"><span data-icon="search"></span><input placeholder="搜索应用与数据源" /></label></header><p class="market-intro">连接团队正在使用的工具，让 Agent 在授权范围内理解上下文并完成工作。</p>
        <article class="featured-plugin" data-plugin="lark">${pluginLogoMarkup(plugins.find((item) => item.id === 'lark'))}<h3>让工作上下文自然流入 Syntropic</h3><p>连接飞书文档、会议、任务与多维表格。Agent 可以搜索、引用和更新内容，并保留每一次操作记录。</p><button type="button">查看飞书插件</button></article>
        <header class="market-section-title"><strong>团队常用</strong><span>查看全部</span></header><div class="plugin-grid">${plugins.map(pluginCard).join('')}</div>
      </section>
      <section class="plugin-detail"></section>
    </main>
  </div>`;
}

function renderPluginDetail(win, pluginId) {
  const plugin = plugins.find((item) => item.id === pluginId) || plugins[0];
  const content = win.querySelector('.market-content');
  const detail = win.querySelector('.plugin-detail');
  detail.innerHTML = `
    <button class="detail-back" type="button"><span data-icon="chevron"></span>返回应用市场</button>
    <header class="plugin-hero">${pluginLogoMarkup(plugin)}<div><h2>${plugin.name}</h2><p>${plugin.maker} · 演示插件</p></div><button class="install-button${installedAppIds.has(plugin.id) ? ' installed' : ''}" type="button">${installedAppIds.has(plugin.id) ? '已安装' : '安装'}</button></header>
    <nav class="detail-tabs"><button class="selected">概览</button><button>权限与数据</button><button>更新记录</button></nav>
    <div class="detail-layout"><section class="plugin-screenshot"><header class="source-header">${pluginLogoMarkup(plugin)}${plugin.name} 工作空间</header><div class="source-demo"><div><strong>产品知识库</strong><span>128 个页面<br/>2 分钟前同步</span></div><div><strong>本周项目</strong><span>24 个任务<br/>实时同步</span></div><div><strong>团队动态</strong><span>8 个频道<br/>刚刚更新</span></div></div></section><aside class="detail-copy"><h3>在 Syntropic 中使用 ${plugin.name}</h3><p>${plugin.desc} 连接后，你可以在全局 AI 中直接引用这些上下文，也可以让任务 Agent 在后台调用。</p><div class="permission-list"><strong>权限始终由你控制</strong><p>只访问你选择的空间</p><p>所有写入操作可审计</p><p>随时暂停或断开连接</p></div></aside></div>`;
  hydrateIcons(detail);
  content.classList.add('detail-mode');
  detail.querySelector('.detail-back').addEventListener('click', () => content.classList.remove('detail-mode'));
  const install = detail.querySelector('.install-button');
  install.addEventListener('click', () => {
    const installed = !installedAppIds.has(plugin.id);
    setAppInstalled(plugin.id, installed);
    install.classList.toggle('installed', installed);
    install.textContent = installed ? '已安装' : '安装';
  });
}

function openMarket() {
  const win = shell('market', 'Syntropic 应用市场', 'blocks', marketBody(), 'market-window');
  if (win.dataset.bound) return;
  win.dataset.bound = 'true';
  win.addEventListener('click', (event) => {
    const plugin = event.target.closest('[data-plugin]');
    if (plugin) renderPluginDetail(win, plugin.dataset.plugin);
  });
  const search = win.querySelector('.market-search input');
  search.addEventListener('input', () => {
    const query = search.value.toLowerCase();
    win.querySelector('.plugin-grid').innerHTML = plugins.filter((plugin) => `${plugin.name}${plugin.desc}${plugin.maker}`.toLowerCase().includes(query)).map(pluginCard).join('');
  });
}

const larkDocuments = [
  { id: 'hr-agent-engineer-jd', title: 'Agent 工程师 · JD v3', type: '文档', icon: 'doc', owner: '招聘团队', updated: '刚刚', space: '人才招聘', starred: true, summary: 'Syntropic 根据候选人漏斗和入职工程师表现，准备了 1 项关键调整。' },
  { id: 'launch-brief', title: 'Q3 产品发布 Brief', type: '文档', icon: 'doc', owner: 'J', updated: '3 分钟前', space: '产品发布', starred: true, summary: '明确 Q3 发布目标、核心叙事、目标用户与跨团队交付节奏。' },
  { id: 'pricing', title: '竞品定价变化分析', type: '多维表格', icon: 'chart', owner: 'Syntropic Agent', updated: '8 分钟前', space: '竞品研究', starred: true, summary: '跟踪 8 家竞品近 90 天的套餐、折扣和 AI 能力调整。' },
  { id: 'feedback', title: '客户反馈汇总 · 7 月', type: '文档', icon: 'doc', owner: '周然', updated: '今天 16:20', space: '客户洞察', summary: '汇总 24 场客户访谈和工单反馈，提炼产品机会。' },
  { id: 'roadmap', title: 'Syntropic 产品路线图', type: '电子表格', icon: 'file', owner: 'J', updated: '今天 14:05', space: '产品规划', summary: '记录下半年关键里程碑、负责人、依赖关系与风险。' },
  { id: 'launch-faq', title: '产品发布 FAQ', type: '知识库', icon: 'folder', owner: '林悦', updated: '昨天', space: '产品发布', summary: '面向销售、客户成功与支持团队的统一发布问答。' },
  { id: 'weekly', title: '本周项目进展', type: '文档', icon: 'doc', owner: 'Syntropic Agent', updated: '昨天', space: '团队周报', summary: '自动汇总本周任务、会议决策与待确认事项。' },
  { id: 'interviews', title: '用户访谈记录', type: '知识库', icon: 'folder', owner: '陈墨', updated: '周二', space: '用户研究', summary: '按用户角色整理的访谈原文、洞察标签与机会点。' },
  { id: 'meeting', title: '发布评审会议纪要', type: '妙记', icon: 'message', owner: '飞书妙记', updated: '周一', space: '产品发布', summary: '记录发布评审中的关键结论、分歧和后续行动项。' },
];

function larkDocumentRows(documents) {
  if (!documents.length) return `<div class="lark-empty"><span data-icon="search"></span><strong>没有找到文档</strong><p>尝试搜索其他名称、空间或所有者。</p></div>`;
  return `<div class="lark-list-head"><span aria-hidden="true"></span><span>文件</span><span>所有者</span><span>最近更新</span><span aria-hidden="true"></span></div>${documents.map((doc) => `
    <button class="lark-doc-row" type="button" data-lark-doc="${doc.id}">
      <span class="lark-doc-icon ${doc.icon}"><span data-icon="${doc.icon}"></span></span>
      <span class="lark-doc-copy"><strong>${doc.title}${doc.starred ? '<i>★</i>' : ''}</strong><small>${doc.type} · ${doc.space}</small></span>
      <span class="lark-owner">${doc.owner}</span><time>${doc.updated}</time><span class="lark-row-arrow" data-icon="arrow"></span>
    </button>`).join('')}`;
}

function larkDocumentsFor(section, query = '') {
  const normalized = query.trim().toLowerCase();
  return larkDocuments.filter((doc) => {
    const inSection = section === '我的空间' ? doc.owner === 'J' : section === '与我共享' ? doc.owner !== 'J' : section === '收藏' ? doc.starred : true;
    return inSection && (!normalized || `${doc.title}${doc.type}${doc.owner}${doc.space}`.toLowerCase().includes(normalized));
  });
}

function renderLarkHome(win, section = '最近使用') {
  if (section === '会议') {
    renderLarkMeetings(win);
    return;
  }
  const main = win.querySelector('.lark-main');
  win.dataset.larkSection = section;
  win.querySelectorAll('[data-lark-section]').forEach((button) => button.classList.toggle('selected', button.dataset.larkSection === section));
  main.innerHTML = `<header class="lark-home-header"><div><span>飞书文档</span><h2>${section}</h2></div><label class="lark-search"><span data-icon="search"></span><input placeholder="搜索飞书文档" autocomplete="off" /></label></header><section class="lark-list" id="larkDocList">${larkDocumentRows(larkDocumentsFor(section))}</section>`;
  hydrateIcons(main);
}

function larkDocumentPreviewBody(documentId) {
  const doc = larkDocuments.find((item) => item.id === documentId) || larkDocuments[0];
  if (doc.id === 'hr-agent-engineer-jd') return `<div class="lark-preview-body hr-lark-preview">
    <article class="lark-document"><header><span class="lark-doc-icon doc"><span data-icon="doc"></span></span><div><h1>${doc.title}</h1><p>${doc.owner} · 更新于 ${doc.updated} · Syntropic 可在授权范围内引用</p></div></header><p class="lark-document-lede">${doc.summary}</p><hr/><h2>职位使命</h2><p>构建可在真实业务环境中可靠运行的 Agent 系统，包括工具调用、上下文工程、评估与可观测性。</p><h2>Syntropic 建议的修改</h2><section class="hr-jd-diff"><p><del>5 年以上后端经验，精通算法与大型分布式系统</del></p><p><ins>有生产级 Agent 系统经验，能够设计工具编排、评估体系和可靠性机制</ins></p></section><aside class="lark-callout"><strong>为什么调整</strong><p>近期被淘汰候选人中有 8 位具备生产级 Agent 项目经验；已入职高绩效工程师的共同信号集中在工具编排、评估和故障恢复，而不是通用算法年限。</p></aside><h2>关键职责</h2><ul><li>构建 Agent 工具调用与执行框架</li><li>设计离线评估、在线监控和故障恢复机制</li><li>与产品团队共同把 Agent 部署到真实工作流</li></ul></article></div>`;
  return `<div class="lark-preview-body">
    <article class="lark-document"><header><span class="lark-doc-icon ${doc.icon}"><span data-icon="${doc.icon}"></span></span><div><h1>${doc.title}</h1><p>${doc.owner} · ${doc.space} · 更新于 ${doc.updated}</p></div></header><p class="lark-document-lede">${doc.summary}</p><hr/><h2>目标与背景</h2><p>团队需要在同一个上下文中理解当前进展、关键判断和后续动作。本文档由项目成员持续维护，并允许 Syntropic 在授权范围内检索和引用。</p><aside class="lark-callout"><strong>本次需要确认</strong><p>核心叙事是否足够清晰，以及发布前的跨团队依赖是否已经全部关闭。</p></aside><h2>关键事项</h2><ul><li>完成发布范围与目标用户确认</li><li>同步市场、销售与客户成功团队的交付节奏</li><li>所有对外材料在发布评审后统一更新</li></ul><h2>下一步</h2><p>负责人将在本周完成最终评审。Syntropic 会持续跟踪相关任务，并在出现阻塞时提醒项目成员。</p></article></div>`;
}

function openLarkDocumentWindow(documentId) {
  const doc = larkDocuments.find((item) => item.id === documentId) || larkDocuments[0];
  const win = shell(`lark-document-${doc.id}`, doc.title, doc.icon, larkDocumentPreviewBody(doc.id), 'lark-preview-window', { w: '760px', h: '650px', x: '34vw', y: '7vh' });
  let pinButton = win.querySelector('[data-document-pin]');
  if (!pinButton) {
    pinButton = document.createElement('button');
    pinButton.type = 'button';
    pinButton.className = 'window-pin-button';
    pinButton.dataset.documentPin = doc.id;
    win.querySelector('.window-spacer').appendChild(pinButton);
    pinButton.addEventListener('click', (event) => {
      event.stopPropagation();
      const pinned = toggleLarkDocumentPin(doc.id);
      if (pinned) closeWindowAfterPin(win);
    });
  }
  updateDocumentPinButtons();
  win.dataset.previewBound = 'true';
}

function openLarkApp() {
  const body = `<div class="lark-app-body"><aside class="lark-sidebar"><div class="lark-account"><span class="app-brand-logo"><img src="./assets/feishu-logo.png" alt="" /></span><span><strong>飞书</strong><small><i></i>Syntropic 已连接</small></span></div><nav><button class="selected" type="button" data-lark-section="最近使用"><span data-icon="clock"></span>最近使用</button><button type="button" data-lark-section="会议"><span data-icon="calendar"></span>会议</button><button type="button" data-lark-section="我的空间"><span data-icon="folder"></span>我的空间</button><button type="button" data-lark-section="与我共享"><span data-icon="user"></span>与我共享</button><button type="button" data-lark-section="收藏"><span data-icon="spark"></span>收藏</button></nav><footer><span data-icon="settings"></span><span><strong>连接与权限</strong><small>8 个空间已授权</small></span></footer></aside><main class="lark-main"></main></div>`;
  const win = shell('source-lark', '飞书', 'doc', body, 'source-window lark-window', { w: '980px', h: '650px', x: '16vw', y: '5vh' });
  // Opening the data source always returns to its browser; documents own their windows.
  renderLarkHome(win, win.dataset.larkSection || '最近使用');
  if (win.dataset.larkBound) return win;
  win.dataset.larkBound = 'true';
  win.addEventListener('click', (event) => {
    const section = event.target.closest('[data-lark-section]');
    const documentRow = event.target.closest('[data-lark-doc]');
    if (section) renderLarkHome(win, section.dataset.larkSection);
    if (documentRow) openLarkDocumentWindow(documentRow.dataset.larkDoc);
  });
  win.addEventListener('input', (event) => {
    if (!event.target.closest('.lark-search')) return;
    const list = win.querySelector('#larkDocList');
    list.innerHTML = larkDocumentRows(larkDocumentsFor(win.dataset.larkSection || '最近使用', event.target.value));
    hydrateIcons(list);
  });
  return win;
}

const larkMeetings = [
  { time: '10:00', title: '产品发布周会', duration: '45 分钟', group: '产品发布', people: '李兰、林悦、周然等 6 人', state: '进行中' },
  { time: '14:00', title: '客户反馈评审', duration: '30 分钟', group: '用户研究', people: '李兰、客户成功团队等 5 人', state: '待开始' },
  { time: '16:30', title: 'GTM 同步会', duration: '45 分钟', group: '市场协作', people: '李兰、市场与销售团队等 8 人', state: '待开始' },
];

function renderLarkMeetings(win) {
  win.dataset.larkSection = '会议';
  win.querySelectorAll('[data-lark-section]').forEach((button) => button.classList.toggle('selected', button.dataset.larkSection === '会议'));
  win.querySelector('.lark-main').innerHTML = `<header class="lark-home-header"><div><span>飞书会议</span><h2>今日会议</h2></div><span class="lark-meeting-count">${larkMeetings.length} 场</span></header><section class="lark-meeting-list"><header><span>时间</span><span>会议</span><span>参与人</span><span>状态</span></header>${larkMeetings.map((meeting) => `<button class="lark-meeting-row" type="button"><time>${meeting.time}<small>${meeting.duration}</small></time><span><strong>${meeting.title}</strong><small>${meeting.group}</small></span><span class="lark-meeting-people">${meeting.people}</span><i class="${meeting.state === '进行中' ? 'live' : ''}">${meeting.state}</i><span data-icon="arrow"></span></button>`).join('')}</section>`;
  hydrateIcons(win);
}

function openLarkMeetings() {
  const win = openLarkApp();
  renderLarkMeetings(win);
}

function openSource(id) {
  const source = id.replace('source-', '');
  if (source === 'lark') {
    openLarkApp();
    return;
  }
  const plugin = plugins.find((item) => item.id === source) || plugins[0];
  const rows = ['产品发布工作台', 'Q3 产品发布 Brief', '竞品分析资料库', '客户反馈汇总', '本周项目进展'];
  const accountLogo = pluginLogoMarkup(plugin, 'app-brand-logo source-brand-logo');
  const body = `<div class="source-window-body"><aside class="source-panel"><div class="source-account">${accountLogo}<span><strong>${plugin.name}</strong><span>已连接 · 实时同步</span></span></div><nav class="source-nav"><button class="selected"><span data-icon="folder"></span>最近使用</button><button><span data-icon="search"></span>搜索</button><button><span data-icon="database"></span>所有数据</button><button><span data-icon="settings"></span>连接设置</button></nav></aside><main class="source-content"><h2>${plugin.name}</h2><p>浏览并打开已授权的应用内容。</p><div class="data-list">${rows.map((row, index) => `<div class="data-row"><span data-icon="${index % 2 ? 'doc' : 'folder'}"></span><span><strong>${row}</strong><small>${index % 2 ? '文档' : '空间'}</small></span><time>${index + 2} 分钟前</time></div>`).join('')}</div></main></div>`;
  shell(id, plugin.name, 'database', body, 'source-window', { w: '860px', h: '590px' });
}

function openSchedule() {
  const items = [['18:00', '生成本周业务复盘', '每周四 · Syntropic Agent'], ['09:00', '整理今日待办与日程', '每个工作日 · Syntropic Agent'], ['17:30', '汇总客户反馈', '每周五 · Syntropic Agent']];
  const body = `<main class="schedule-body"><h2>定时任务</h2><p>让 Agent 在合适的时间开始工作，完成后把结果带回桌面。</p><div class="schedule-list">${items.map(([time,title,meta]) => `<article class="schedule-item"><span class="schedule-time">${time}</span><span><strong>${title}</strong><small>${meta}</small></span><button class="toggle" type="button" aria-label="启用定时任务"></button></article>`).join('')}</div></main>`;
  shell('schedule', '定时任务', 'clock', body, '', { w: '700px', h: '520px', x: '22vw', y: '9vh' });
}

function openBrowser() {
  const body = `<div class="browser-body"><header class="browser-toolbar"><button><span data-icon="back"></span></button><button><span data-icon="forward"></span></button><button><span data-icon="refresh"></span></button><div class="browser-address">syntropic://research/competitor-pricing</div></header><main class="browser-page"><span class="eyebrow">SYNTROPIC BROWSER · AGENT RESEARCH</span><h2>竞品定价研究</h2><p>这个浏览器同时服务于你和 Agent。Agent 浏览过的页面、摘录和引用会保留在任务上下文中。</p><section class="browser-results"><div><strong>Acme Pricing</strong><span>Pro 套餐价格保持不变，AI 摘要进入基础版。</span></div><div><strong>Northstar Update</strong><span>7 月起取消 AI 助手的独立附加费。</span></div><div><strong>Orbit Help Center</strong><span>企业版增加自动化额度，标价未调整。</span></div></section></main></div>`;
  shell('browser', 'Syntropic Browser', 'globe', body, '', { w: '940px', h: '620px' });
}

function openFinder() {
  const items = [
    ['folder', '产品资料', 'folder-type'], ['folder', '客户项目', 'folder-type'], ['folder', '设计资源', 'folder-type'],
    ['file', 'Q3 产品发布 Brief.pdf', 'pdf-type'], ['image', '产品架构图.png', 'image-type'], ['doc', '用户访谈记录.md', 'doc-type'],
    ['presentation', '发布策略演示.key', 'deck-type'], ['file', '竞品定价分析.xlsx', 'sheet-type'],
  ];
  const body = `<div class="finder-body">
    <aside class="finder-sidebar">
      <section><strong>个人收藏</strong><button class="selected"><span data-icon="clock"></span>最近使用</button><button><span data-icon="folder"></span>桌面</button><button><span data-icon="doc"></span>文稿</button><button><span data-icon="folder"></span>下载</button></section>
      <section><strong>iCloud</strong><button><span data-icon="database"></span>iCloud 云盘</button><button><span data-icon="folder"></span>共享</button></section>
      <section><strong>位置</strong><button><span data-icon="screen"></span>建的 Mac</button></section>
    </aside>
    <main class="finder-main">
      <header class="finder-toolbar"><div><button aria-label="后退"><span data-icon="back"></span></button><button aria-label="前进"><span data-icon="forward"></span></button></div><strong>最近使用</strong><div class="finder-tools"><button aria-label="图标视图"><span data-icon="grid"></span></button><label><span data-icon="search"></span><input placeholder="搜索" /></label></div></header>
      <section class="finder-content"><div class="finder-grid">${items.map(([icon,name,type]) => `<button class="finder-item" type="button" data-finder-item="${name}"><span class="finder-file-icon ${type}"><span data-icon="${icon}"></span></span><strong>${name}</strong><small>${icon === 'folder' ? '文件夹' : '今天 14:20'}</small></button>`).join('')}</div></section>
      <footer class="finder-status">8 个项目 · 本机文件</footer>
    </main>
  </div>`;
  const win = shell('finder', 'Finder', 'folder', body, 'finder-window', { w: '920px', h: '610px', x: '18vw', y: '6vh' });
  if (win.dataset.finderBound) return;
  win.dataset.finderBound = 'true';
  win.addEventListener('dblclick', (event) => {
    const item = event.target.closest('[data-finder-item]');
    if (item) showToast(`已在 Finder 中打开「${item.dataset.finderItem}」`);
  });
}

function openSettings() {
  const body = `<main class="settings-body"><h2>Syntropic 设置</h2><p>管理 Agent 的行为、通知和数据访问范围。</p><div class="schedule-list"><article class="schedule-item"><span data-icon="screen"></span><span><strong>桌面与工作空间</strong><small>桌面布局、默认空间和产物固定规则</small></span><span data-icon="arrow"></span></article><article class="schedule-item"><span data-icon="plug"></span><span><strong>应用与权限</strong><small>管理插件、数据范围和写入权限</small></span><span data-icon="arrow"></span></article><article class="schedule-item"><span data-icon="bell"></span><span><strong>通知</strong><small>只在需要确认或产物完成时提醒</small></span><span data-icon="arrow"></span></article></div></main>`;
  shell('settings', '系统设置', 'settings', body, '', { w: '680px', h: '500px', x: '25vw', y: '10vh' });
}

function showDesktop() {
  closeLaunchpad();
  windowLayer.querySelectorAll('.os-window.open').forEach((win) => {
    if (win.dataset.workspaceId === currentCanvasId) {
      // 人才招聘 is the recruiting workspace's primary desktop card, not a
      // transient app window. Returning from a task-generated component should
      // close the task conversation without removing this workspace surface.
      const isWorkspaceSurface = currentCanvasId === 'hr-recruiting'
        && win.dataset.window === 'hr-recruiting-app';
      if (isWorkspaceSurface) return;
      win.classList.remove('open');
      win.setAttribute('aria-hidden', 'true');
    }
  });
  showToast('已回到 Syntropic 桌面');
}

const notificationCenter = document.querySelector('#notificationCenter');
const notificationButton = document.querySelector('.notification-button');
const notificationCard = notificationCenter.querySelector('.notification-card');
const mobilePreviewHint = document.querySelector('#mobilePreviewHint');

mobilePreviewHint?.querySelector('[data-mobile-preview-dismiss]')?.addEventListener('click', () => {
  mobilePreviewHint.hidden = true;
});

function setNotificationCenter(open) {
  notificationCenter.classList.toggle('open', open);
  notificationCenter.setAttribute('aria-hidden', String(!open));
  notificationButton.setAttribute('aria-expanded', String(open));
}

function showNotification({ openId, title, status, summary, action = '查看', proactive = false }) {
  notificationCard.dataset.open = openId;
  notificationCard.querySelector('[data-notification-title]').textContent = title;
  notificationCard.querySelector('[data-notification-status]').textContent = status;
  notificationCard.querySelector('[data-notification-time]').textContent = '现在';
  notificationCard.querySelector('[data-notification-summary]').textContent = summary;
  notificationCard.querySelector('[data-notification-open]').textContent = action;
  notificationCard.classList.toggle('ai-proactive', proactive);
  notificationButton.classList.add('has-alert');
  notificationButton.setAttribute('aria-label', `通知，${title}，${status}`);
  requestAnimationFrame(() => setNotificationCenter(true));
}

function showTaskCompletionNotification(taskId, title, summary) {
  showNotification({ openId:taskId, title, status:'已完成', summary });
}

notificationCenter.addEventListener('click', (event) => {
  if (!event.target.closest('.notification-card')) return;
  setNotificationCenter(false);
  notificationButton.classList.remove('has-alert');
  notificationButton.setAttribute('aria-label', '通知');
});

document.addEventListener('pointerdown', (event) => {
  if (notificationCenter.classList.contains('open') && !event.target.closest('#notificationCenter,[data-action="notifications"]')) setNotificationCenter(false);
});

document.addEventListener('click', (event) => {
  const dockItem = event.target.closest('.dock-item');
  if (launchpad.classList.contains('open') && dockItem && !dockItem.matches('[data-action="launchpad"]')) {
    closeLaunchpad();
  }
  const canvasPin = event.target.closest('[data-canvas-pin]');
  if (canvasPin) {
    event.preventDefault();
    toggleArtifactPin(canvasPin.dataset.canvasPin);
    return;
  }
  const open = event.target.closest('[data-open]');
  if (open) {
    openItem(open.dataset.open);
    return;
  }
  const actionTarget = event.target.closest('[data-action]');
  const action = actionTarget?.dataset.action;
  if (!action) return;
  if (action === 'desktop') showDesktop();
  if (action === 'launchpad') openLaunchpad();
  if (action === 'market') openMarket();
  if (action === 'schedule') openSchedule();
  if (action === 'lark-meetings') openLarkMeetings();
  if (action === 'browser') openBrowser();
  if (action === 'finder') openFinder();
  if (action === 'settings') openSettings();
  if (action === 'all-tasks') {
    if (currentCanvasId === 'hr-recruiting') openHRTasks(defaultHRTaskId());
    else openTask(currentCanvasId === 'product-release' ? 'task-completed' : 'task-pricing');
  }
  if (action === 'all-files') openArtifact('artifact-report');
  if (action === 'notifications') setNotificationCenter(!notificationCenter.classList.contains('open'));
  if (action === 'placeholder') showToast(`${actionTarget.dataset.appName || '这个应用'} 是当前原型中的占位应用`);
});

function openItem(id) {
  if (id.startsWith('task-')) openTask(id);
  else if (id.startsWith('artifact-')) openArtifact(id);
  else if (id.startsWith('hr-')) openHRItem(id);
  else if (id.startsWith('product-')) openProductItem(id);
  else if (id.startsWith('source-')) openSource(id);
  else if (id.startsWith('lark-document-')) openLarkDocumentWindow(id.replace('lark-document-', ''));
}

const hrDemoStateKey = 'solo-hr-demo-state-v2';
let hrDemoState = localStorage.getItem(hrDemoStateKey) || 'insight';
const hrCreatedTasksKey = 'relay-hr-created-task-ids-v1';
const initialHRCreatedTasks = syntropicMode === 'demo'
  ? []
  : hrDemoState === 'insight'
    ? ['hr-task-monitor']
    : ['hr-task-review', 'hr-task-followup', 'hr-task-interview', 'hr-task-monitor'];
let hrCreatedTaskIds;
try {
  const storedTaskIds = JSON.parse(localStorage.getItem(hrCreatedTasksKey) || 'null');
  hrCreatedTaskIds = new Set(Array.isArray(storedTaskIds) ? storedTaskIds : initialHRCreatedTasks);
} catch {
  hrCreatedTaskIds = new Set(initialHRCreatedTasks);
}
const hrTaskCreatedAt = new Map();
let hrReplyTimer = 0;
const hrUserTaskDefinitions = {};
let hrActiveRecruitingRole = 'agent';
let hrActiveRecruitingStage = 'interview';
let proactiveInsightPublished = false;
let proactiveInsightPublishedAt = 0;
let proactiveInsightTimer = 0;

const hrRecruitingReality = {
  goal: { role:'Agent 工程师', hires:6, deadline:'10 月 31 日', budget:'现有薪资预算内' },
  pipeline: { pool:128, screened:32, technical:23, final:5, offer:2 },
  candidates: [
    { name:'林然', initial:'林', company:'前字节跳动', role:'Agent 平台工程师', signal:'工具编排与运行时', status:'等待系统设计面试' },
    { name:'赵一帆', initial:'赵', company:'前 Anthropic', role:'基础设施工程师', signal:'评估与可观测性', status:'等待面试反馈' },
    { name:'许宁', initial:'许', company:'某企业 AI 平台', role:'Agent 架构师', signal:'多 Agent 可靠性', status:'可重新评估' },
    { name:'苏悦', initial:'苏', company:'某 AI 创业公司', role:'核心工程师', signal:'Agent 故障恢复', status:'可重新评估' },
  ],
  interviewers: [
    { name:'陈建', team:'Agent Infra', availability:'周四 15:00–17:00' },
    { name:'周禾', team:'Developer Platform', availability:'周五 10:00–12:00' },
    { name:'贺言', team:'Model Runtime', availability:'已接受备用评委邀请' },
    { name:'宋澜', team:'Reliability', availability:'已接受备用评委邀请' },
  ],
  sources: [
    { name:'飞书招聘', detail:'128 份候选人记录', updated:'刚刚', icon:'user' },
    { name:'团队日历', detail:'8 位评委可用时间', updated:'2 分钟前', icon:'calendar' },
    { name:'招聘文档', detail:'JD v3 · 面试评价表', updated:'12 分钟前', icon:'doc' },
  ],
  milestones: { detected:'今天 16:28', candidateReply:'今天 16:41', interviewDays:'8 月 27–28 日' },
};

const hrCandidateIdsByName = {
  '林然':'linran', '赵一帆':'zhaoyifan', '许宁':'xuning', '苏悦':'suyue', '周衡':'zhouheng',
  '唐瑾':'tangjin', '陈知':'chenzhi', '高越':'gaoyue', '方舟':'fangzhou',
  '沈嘉':'shenjia', '周临':'zhoulin', '顾言':'guyan', '程曦':'chengxi'
};
const hrCandidateDirectory = {};

const hrCandidateProfiles = {
  linran: {
    match:'92%', location:'上海', experience:'7 年', availability:'2 周内', education:'浙江大学 · 计算机科学',
    summary:'负责过生产级 Agent 工具编排平台与运行时，覆盖权限边界、长任务状态恢复和多工具失败重试；经历与团队当前的可靠性建设重点高度匹配。',
    skills:['工具编排','Agent Runtime','权限与沙箱','故障恢复'],
    history:[
      { company:'字节跳动', role:'Agent 平台工程师', period:'2022–至今', detail:'主导内部 Agent 工具执行框架，支撑 20+ 业务团队接入。' },
      { company:'阿里云', role:'分布式系统工程师', period:'2019–2022', detail:'负责工作流调度、状态一致性和任务恢复。' },
    ],
    progress:[['简历评估','已通过','生产级工具编排经验明确'],['技术初面','已通过','系统取舍与故障分析表现突出'],['系统设计','待排期','等待锁定共同时间']],
    feedback:'技术深度与业务落地能力均高于当前候选人中位数；需要在系统设计面进一步验证大规模并发下的隔离策略。',
    risk:'已等待 6 天，候选人同时在推进另一家公司的终面。', nextAction:'优先锁定周四或周五的系统设计面试。'
  },
  zhaoyifan: {
    match:'94%', location:'北京', experience:'8 年', availability:'1 个月内', education:'清华大学 · 软件工程',
    summary:'长期建设大模型评估、可观测性与线上质量体系，能够把离线评测、线上反馈和回归诊断串成完整闭环。',
    skills:['Agent 评估','可观测性','回归诊断','数据平台'],
    history:[
      { company:'Anthropic', role:'基础设施工程师', period:'2023–2026', detail:'参与 Agent 评估与生产可观测性平台建设。' },
      { company:'Google Cloud', role:'高级软件工程师', period:'2018–2023', detail:'负责分布式追踪与服务质量基础设施。' },
    ],
    progress:[['简历评估','已通过','评估与可观测性经验稀缺'],['技术面试','已完成','3 位评委中 2 位强烈推荐'],['反馈汇总','进行中','缺 1 份可靠性评委反馈']],
    feedback:'在指标设计、退化检测和评估数据治理方面表现突出；需补充验证其对工具执行层和权限边界的理解。',
    risk:'反馈已等待 4 小时，延迟可能影响后续终面安排。', nextAction:'今天 16:10 前回收最后一份评价并生成决策摘要。'
  },
  xuning: {
    match:'89%', location:'杭州', experience:'9 年', availability:'3 周内', education:'上海交通大学 · 计算机技术',
    summary:'现任企业 AI 平台 Agent 架构师，负责多 Agent 协作、状态管理与降级方案；被旧版年限标准低估，但生产可靠性信号明显。',
    skills:['多 Agent 系统','可靠性','状态管理','性能优化'],
    history:[
      { company:'某企业 AI 平台', role:'Agent 架构师', period:'2021–至今', detail:'设计多 Agent 协作平台和生产降级机制，日均执行 30 万次任务。' },
      { company:'网易', role:'平台工程师', period:'2017–2021', detail:'建设实时任务平台与容量治理体系。' },
    ],
    progress:[['简历评估','重新校准','按 JD v3 重新识别生产经验'],['案例复核','已完成','多 Agent 可靠性命中关键能力'],['技术面试','建议恢复','候选人窗口剩余 3 天']],
    feedback:'实际架构经验与岗位高度相关，尤其擅长状态一致性和失败降级；需要验证其英文技术沟通与跨团队推动能力。',
    risk:'候选人窗口预计 3 天后收窄，尚未重新建立联系。', nextAction:'今天完成校准并由 HR 重新联系候选人。'
  },
  suyue: {
    match:'87%', location:'深圳', experience:'6 年', availability:'随时', education:'华中科技大学 · 软件工程',
    summary:'在 AI 创业公司负责 Agent 故障恢复与线上稳定性，具备从早期原型推进到生产系统的完整经验。',
    skills:['故障恢复','线上稳定性','工具调用','快速迭代'],
    history:[{ company:'某 AI 创业公司', role:'核心工程师', period:'2022–至今', detail:'负责 Agent 执行引擎、故障恢复和线上值班体系。' }],
    progress:[['简历评估','已通过','生产故障处理经验突出'],['标准校准','已通过','符合 JD v3'],['HR 初筛','待确认','等待安排沟通']],
    feedback:'适合高不确定性的工程环境，建议重点验证系统化设计能力。',
    risk:'候选人同时接触多家早期团队。', nextAction:'24 小时内完成 HR 初筛。'
  },
  shenjia: {
    match:'91%', location:'上海', experience:'8 年', availability:'1 个月内', education:'复旦大学 · 信息管理',
    summary:'连续负责两代企业级 Agent 产品，从场景定义、评估体系到商业化落地均有完整经验；擅长把模型能力转化为可验证的用户结果。',
    skills:['Agent 产品策略','企业工作流','产品评估','跨团队推进'],
    history:[
      { company:'某头部 AI 公司', role:'Agent 产品负责人', period:'2022–至今', detail:'带领 12 人团队交付企业 Agent 平台，覆盖知识、客服和数据分析场景。' },
      { company:'字节跳动', role:'高级产品经理', period:'2018–2022', detail:'负责协作产品的智能化能力与增长实验。' },
    ],
    progress:[['履历评估','已通过','企业 Agent 产品闭环经验完整'],['产品案例面','已通过','问题定义与指标设计表现突出'],['终面决策','待确认','关键评价已齐']],
    feedback:'用户问题拆解、技术边界判断和组织推动能力均达到负责人要求；需要最终确认其对中长期平台战略的取舍。',
    risk:'已完成全部面试，决策等待超过 2 天。', nextAction:'今天合并评价并完成终面决策。'
  },
  zhoulin: {
    match:'89%', location:'北京', experience:'7 年', availability:'3 周内', education:'北京大学 · 软件工程',
    summary:'兼具开发者平台和商业化经验，曾从零搭建 AI API 产品体系；对开发者体验、定价和生态增长有系统认知。',
    skills:['开发者平台','API 产品','商业化','生态运营'],
    history:[
      { company:'某云计算公司', role:'开发者产品负责人', period:'2021–至今', detail:'负责 AI API 平台、开发者控制台与商业化策略。' },
      { company:'美团', role:'平台产品经理', period:'2019–2021', detail:'建设内部开发者工具与服务治理产品。' },
    ],
    progress:[['履历评估','已通过','开发者平台经验匹配'],['产品案例面','已完成','商业判断评价存在分歧'],['评价校准','进行中','等待统一负责人评价重点']],
    feedback:'平台产品基本功扎实，开发者同理心突出；面试官对其企业场景深度和商业化节奏存在不同判断。',
    risk:'评价口径未对齐，候选人已等待 4 天。', nextAction:'组织 30 分钟评价校准并形成统一决策卡。'
  },
  guyan: {
    match:'93%', location:'深圳', experience:'9 年', availability:'2 周内', education:'中山大学 · 市场营销',
    summary:'主导过开发者工具从社区增长到企业转化的完整 PLG 路径，能够连接产品使用、内容生态和收入目标。',
    skills:['PLG','开发者增长','生命周期运营','商业化'],
    history:[
      { company:'某开发者工具公司', role:'增长负责人', period:'2021–至今', detail:'将月活开发者从 18 万提升至 75 万，并建立企业转化漏斗。' },
      { company:'腾讯', role:'高级增长经理', period:'2017–2021', detail:'负责云产品开发者增长、内容生态和渠道合作。' },
    ],
    progress:[['履历评估','已通过','PLG 与开发者增长高度匹配'],['业务面试','已通过','增长模型与团队管理表现突出'],['Offer 条件','待确认','薪酬方案等待决策']],
    feedback:'能把增长策略落实到产品机制和数据模型，具备负责人所需的经营意识；薪酬预期略高于当前预算带。',
    risk:'候选人手中已有另一份 Offer，决策窗口剩余 48 小时。', nextAction:'确认薪酬弹性并在今天发出正式方案。'
  },
  chengxi: {
    match:'88%', location:'杭州', experience:'8 年', availability:'1 个月内', education:'南京大学 · 经济学',
    summary:'长期负责企业 SaaS 增长与商业化，在线索培育、销售协同和客户扩张方面经验完整，适合加强企业增长能力。',
    skills:['企业增长','GTM','收入运营','客户扩张'],
    history:[
      { company:'某企业 SaaS 公司', role:'商业化增长负责人', period:'2020–至今', detail:'建立从市场线索到续费扩张的收入运营体系。' },
      { company:'阿里巴巴', role:'增长策略专家', period:'2017–2020', detail:'负责企业服务客户分层、渠道策略和转化分析。' },
    ],
    progress:[['履历评估','已通过','企业增长经验完整'],['业务面试','已完成','GTM 能力获得一致认可'],['候选人沟通','持续中','等待薪酬范围更新']],
    feedback:'企业销售协同和收入运营能力突出；相较顾言，开发者社区和产品自助增长经验较弱。',
    risk:'保持沟通中，但薪酬范围迟迟未更新。', nextAction:'本周内同步预算结论并安排最终沟通。'
  },
};

function registerHRCandidate(candidate) {
  const id = hrCandidateIdsByName[candidate.name] || `candidate-${Object.keys(hrCandidateDirectory).length + 1}`;
  hrCandidateDirectory[id] = { ...hrCandidateDirectory[id], ...candidate, id };
  return id;
}

hrRecruitingReality.candidates.forEach((candidate) => registerHRCandidate({
  avatar:candidate.initial, name:candidate.name, detail:`${candidate.company} · ${candidate.role}`,
  state:candidate.status, next:'查看招聘进展', source:'飞书招聘',
  ...(hrCandidateProfiles[hrCandidateIdsByName[candidate.name]] || {})
}));

[
  { id:'shenjia', avatar:'沈', name:'沈嘉', detail:'Agent 产品策略与体验', state:'终面待决策', next:'今天需要处理', source:'招聘系统' },
  { id:'zhoulin', avatar:'周', name:'周临', detail:'开发者平台与商业化', state:'评价分歧', next:'本周内跟进', source:'招聘系统' },
  { id:'guyan', avatar:'顾', name:'顾言', detail:'PLG 与开发者增长', state:'薪酬待确认', next:'今天需要处理', source:'招聘系统' },
  { id:'chengxi', avatar:'程', name:'程曦', detail:'企业增长与商业化', state:'保持沟通', next:'本周内跟进', source:'招聘系统' },
].forEach((candidate) => registerHRCandidate({ ...candidate, ...hrCandidateProfiles[candidate.id] }));

function getHRInsightDefinitions() {
  const active = hrDemoState !== 'insight';
  const replied = hrDemoState === 'reply';
  const scheduled = hrDemoState === 'scheduled';
  const insights = [
    { id:'capacity', tone:scheduled ? 'opportunity' : 'risk', label:scheduled ? '推进更新' : '关键偏航', time:'刚刚', title:scheduled ? '集中面试日已排期，招聘节奏正在恢复' : replied ? '共同时间已匹配，等待发送邀请' : active ? 'Syntropic 正在恢复系统设计面试产能' : '不是候选人不足，是面试产能限制了招聘结果', summary:scheduled ? '12 场系统设计面试已安排在 8 月 27–28 日，Syntropic 将继续跟踪候选人回复、评价与后续轮次。' : replied ? '6 位候选人与陈建、周禾等 4 位评委的共同时间已经找到。' : active ? '8 位候选人已重新评估，备用评委与集中面试日正在协调。' : '23 位候选人等待系统设计面试，未来十天仅有 4 个核心评委时段。', sources:'飞书招聘 · 团队日历 · 面试评价表', task:'hr-task-review' },
    { id:'signals', tone:'opportunity', label:'人才机会', time:'12 分钟前', title:'林然等 8 位候选人值得重新评估', summary:'当前标准高估通用后端年限，低估工具编排、评估与可靠性经验。', sources:'飞书招聘 · JD v3 · 入职表现', task:'hr-task-followup' },
    { id:'window', tone:'trend', label:'流失信号', time:'今天 15:46', title:'11 位候选人正在进入高流失窗口', summary:'历史数据表明等待超过 7 天后回复率明显下降，林然等候选人已接近这一节点。', sources:'飞书沟通 · 团队日历', task:'hr-task-interview' },
    { id:'product-decision', tone:'risk', label:'决策阻塞', time:'8 分钟前', title:'不是候选人不足，是决策标准没有对齐', summary:'5 位面试官使用 3 套评价重点，2 位终面候选人已等待 4 天。', sources:'飞书招聘 · 面试评价表', task:'hr-task-product-decision' },
    { id:'growth-compensation', tone:'trend', label:'Offer 风险', time:'15 分钟前', title:'高匹配候选人正在被薪酬带推向流失窗口', summary:'2 位候选人期望超出预算，Syntropic 已准备市场对标与决策方案。', sources:'飞书招聘 · 候选人沟通 · 薪酬数据', task:'hr-task-growth-offer' },
  ];
  if (proactiveInsightPublished) insights.unshift({
    id:'proactive-window', tone:'risk', label:'主动洞察', time:'刚刚',
    title:'3 位高匹配候选人的面试窗口将在 48 小时内关闭',
    summary:'Syntropic 关联候选人回复与评委日历后发现窗口风险，并已自动创建保护任务。',
    sources:'飞书招聘 · 候选人沟通 · 团队日历', task:'hr-task-proactive-window',
  });
  return insights;
}

function hrInsightPageMarkup(insightId = 'capacity') {
  const insight = getHRInsightDefinitions().find((item) => item.id === insightId) || getHRInsightDefinitions()[0];
  if (insight.id === 'product-decision') return hrRoleInsightMarkup('product');
  if (insight.id === 'growth-compensation') return hrRoleInsightMarkup('growth');
  const taskCreated = hrCreatedTaskIds.has(insight.task);
  const sourceStrip = `<section class="hr-browser-source-strip"><header><strong>判断依据</strong><small>仅使用已授权数据</small></header><div>${hrRecruitingReality.sources.map((source) => `<span><i data-icon="${source.icon}"></i><span><strong>${source.name}</strong><small>${source.detail} · ${source.updated}</small></span></span>`).join('')}</div></section>`;
  const action = `<section class="hr-browser-action"><span><i data-icon="spark"></i><span><small>Syntropic 建议的下一步</small><strong>${insight.id === 'capacity' ? '重评候选人、补充评委，并组织 Agent 集中面试日' : insight.id === 'signals' ? '将这 8 位候选人加入机会清单，持续保护面试窗口' : '立即锁定共同时间，创建集中面试日'}</strong></span></span><button type="button" data-hr-action="${taskCreated ? 'open-insight-task' : 'create-insight-task'}" data-task-id="${insight.task}">${taskCreated ? '查看任务' : insight.id === 'capacity' ? '按建议恢复招聘节奏' : '创建任务'} <i data-icon="arrow"></i></button></section>`;
  if (insight.id === 'proactive-window') return `<article class="hr-browser-page risk">
    <header><span class="hr-browser-kicker"><i></i>Syntropic 主动洞察 · 刚刚</span><span>已自动创建推进任务</span></header>
    <h1>3 位高匹配候选人的<br />面试窗口将在 48 小时内关闭</h1><p class="hr-browser-lede">Syntropic 持续关联候选人沟通、招聘进展与评委日历后发现：等待时间正在快速消耗林然、许宁与苏悦的有效窗口。</p>
    <section class="hr-browser-metrics"><article><strong>3</strong><span>位高匹配候选人<br />进入风险窗口</span></article><article><strong>48h</strong><span>剩余有效<br />推进时间</span></article><article><strong>2</strong><span>个可锁定的<br />评委时段</span></article></section>
    <section class="hr-browser-causal"><span>候选人仍有意愿</span><i data-icon="arrow"></i><span>面试排期未锁定</span><i data-icon="arrow"></i><strong>窗口即将关闭</strong></section>
    <section class="hr-browser-note"><i data-icon="spark"></i><span><strong>Syntropic 已主动开始处理</strong><small>已自动创建“保护高匹配候选人的面试窗口”任务，正在核对候选人与评委的共同时间；涉及发出邀请时仍会等待你的确认。</small></span></section>${action}${sourceStrip}
    <footer>主动监测 · 依据最近 20 秒同步的数据变化 · 每条结论均可追溯</footer></article>`;
  if (insight.id === 'signals') return `<article class="hr-browser-page opportunity">
    <header><span class="hr-browser-kicker"><i></i>${insight.label} · ${insight.time}</span><span>Syntropic 洞察 · 可追溯</span></header>
    <h1>8 位候选人被旧标准低估</h1><p class="hr-browser-lede">Syntropic 将候选人经历与团队中高绩效 Agent 工程师的真实工作信号进行对照，发现当前标准正在错过生产级经验。</p>
    <section class="hr-signal-compare"><div><small>当前标准更关注</small><strong>通用后端年限</strong><span><i style="width:86%"></i></span><em>算法背景</em></div><div class="better"><small>高绩效更相关</small><strong>生产级 Agent 能力</strong><span><i style="width:94%"></i></span><em>工具编排 · 评估 · 故障恢复</em></div></section>
    <section class="hr-browser-callout"><strong>可重新评估的候选人</strong><div>${hrRecruitingReality.candidates.slice(0,3).map((candidate) => `<span class="hr-evidence-person"><i>${candidate.initial}</i>${candidate.name}</span>`).join('')}<span>+5</span></div><button type="button" data-open="hr-shortlist">查看候选人</button></section>${action}${sourceStrip}
    <footer>分析版本 3 · 更新于今天 16:28 · 每条结论均可追溯</footer></article>`;
  if (insight.id === 'window') return `<article class="hr-browser-page trend">
    <header><span class="hr-browser-kicker"><i></i>${insight.label} · ${insight.time}</span><span>Syntropic 洞察 · 可追溯</span></header>
    <h1>面试等待正在消耗候选人窗口</h1><p class="hr-browser-lede">Syntropic 关联近三个月候选人沟通与面试排期后发现：进入系统设计面试后，等待时间是回复率下降的主要前置信号。</p>
    <section class="hr-wait-chart"><header><strong>候选人回复率</strong><small>按等待天数分组</small></header><div><span><i style="height:88%"></i><small>1–3 天</small><b>88%</b></span><span><i style="height:72%"></i><small>4–6 天</small><b>72%</b></span><span class="risk"><i style="height:49%"></i><small>7–10 天</small><b>49%</b></span><span class="risk"><i style="height:31%"></i><small>10 天以上</small><b>31%</b></span></div></section>
    <section class="hr-browser-note"><i data-icon="calendar"></i><span><strong>林然、许宁等 11 位候选人即将进入高流失区间</strong><small>如果在 8 月 27–28 日创建集中面试日，其中 8 位仍可在有效窗口内完成系统设计面试。</small></span></section>${action}${sourceStrip}
    <footer>分析版本 2 · 已排除节假日和主动暂停流程的候选人</footer></article>`;
  const scheduled = hrDemoState === 'scheduled';
  const active = hrDemoState !== 'insight';
  return `<article class="hr-browser-page ${scheduled ? 'opportunity' : 'risk'}">
    <header><span class="hr-browser-kicker"><i></i>${insight.label} · ${insight.time}</span><span>Syntropic 洞察 · 可追溯</span></header>
    <h1>${scheduled ? '集中面试日已排期，招聘节奏正在恢复' : active ? '共同时间已匹配，等待你的确认' : '面试产能正在限制招聘结果'}</h1><p class="hr-browser-lede">${insight.summary}</p>
    <section class="hr-browser-metrics">${scheduled ? '<article><strong>12</strong><span>场系统设计<br />面试已安排</span></article><article><strong>6</strong><span>位候选人<br />收到邀请</span></article><article><strong>4</strong><span>位核心评委<br />完成排期</span></article>' : '<article><strong>23</strong><span>位候选人等待<br />系统设计面试</span></article><article><strong>4</strong><span>个未来十天可用的<br />核心评委时段</span></article><article><strong>2</strong><span>个 HC 可能<br />偏离目标日期</span></article>'}</section>
    <section class="hr-browser-causal">${scheduled ? '<span>识别产能瓶颈</span><i data-icon="arrow"></i><span>集中面试已排期</span><i data-icon="arrow"></i><strong>等待面试与评价</strong>' : '<span>候选人供给正常</span><i data-icon="arrow"></i><span>系统设计面试堆积</span><i data-icon="arrow"></i><strong>招聘结果延期</strong>'}</section>
    <section class="hr-browser-note"><i data-icon="spark"></i><span><strong>${scheduled ? 'Syntropic 将继续推进' : '这不是 sourcing 问题'}</strong><small>${scheduled ? '邀请发送只是恢复招聘节奏的一步。接下来将跟踪候选人回复、面试评价、终面与 Offer 风险。' : '继续增加候选人只会扩大队列。优先协调陈建、周禾等评委的时间，能更快恢复 6 个 HC 的招聘节奏。'}</small></span></section>${scheduled ? '' : action}${sourceStrip}
    <footer>分析版本 4 · 最近更新于今天 16:28</footer></article>`;
}

function hrInsightWindowMarkup(activeId = 'capacity') {
  const insights = getHRInsightDefinitions();
  const active = insights.find((item) => item.id === activeId) || insights[0];
  return `<div class="hr-insight-browser">
    <div class="hr-insight-browser-body">
      <aside class="hr-insight-library"><header><span><strong>AI 洞察</strong><small>${insights.length} 条最新发现</small></span><i class="hr-solo-pulse"></i></header><nav>${insights.map((item) => `<button class="${item.id === active.id ? 'selected' : ''}" type="button" data-hr-insight-select="${item.id}"><i class="${item.tone}"></i><span><em>${item.label}</em><strong>${item.title}</strong><small>${item.time} · ${item.sources}</small></span></button>`).join('')}</nav></aside>
      <main class="hr-insight-document" data-hr-insight-document>${hrInsightPageMarkup(active.id)}</main>
    </div>
  </div>`;
}

function hrEvidenceMarkup() {
  return `<div class="hr-detail-eyebrow"><span></span>今天 16:28 主动发现</div>
    <h2>候选人供给充足，<br />面试产能正在限制招聘结果</h2>
    <p class="hr-detail-lede">Syntropic 关联招聘漏斗、面试评价和团队日历后发现：系统设计面试已形成堆积，当前评价标准也在错过具备生产级 Agent 经验的人。</p>
    <section class="hr-evidence-grid">
      <article><strong>23</strong><span>位候选人等待<br />系统设计面试</span></article>
      <article><strong>4</strong><span>个未来十天可用的<br />核心评委时段</span></article>
      <article><strong>8</strong><span>位具备 Agent 经验的<br />候选人可重新评估</span></article>
    </section>
    <section class="hr-causal-row"><span>候选人已就绪</span><i data-icon="arrow"></i><span>系统设计面试堆积</span><i data-icon="arrow"></i><span class="warning">2 个 HC 可能延期</span></section>
    <footer class="hr-detail-actions"><button class="hr-secondary-button" type="button" data-open="hr-jd">查看依据</button><button class="hr-primary-button" type="button" data-hr-action="show-plan">查看推进计划 <i data-icon="arrow"></i></button></footer>`;
}

function hrPlanMarkup() {
  return `<div class="hr-detail-eyebrow"><span></span>Syntropic 已准备好下一步</div>
    <h2>按建议恢复招聘节奏</h2>
    <p class="hr-detail-lede">Syntropic 已把评委日历、候选人窗口和评价标准组织成一套推进方案。内部整理将自动执行，对外邀请只需一次确认。</p>
    <section class="hr-plan-list">
      <article><i class="ready" data-icon="calendar"></i><span><strong>创建 Agent 集中面试日</strong><small>集中 12 场系统设计面试，减少零散协调成本</small></span><em>待授权</em></article>
      <article><i class="ready" data-icon="user"></i><span><strong>重新评估 8 位候选人</strong><small>按生产级 Agent 能力校准，保护高匹配候选人窗口</small></span><em class="automatic">自动</em></article>
      <article><i class="ready" data-icon="edit"></i><span><strong>更新 JD 与评价标准</strong><small>突出工具编排、评估与可靠性，降低通用年限权重</small></span><em class="automatic">自动</em></article>
      <article><i data-icon="clock"></i><span><strong>持续维护 6 个 HC</strong><small>按候选人窗口、面试产能和 Offer 结果动态补位</small></span><em class="automatic">持续</em></article>
    </section>
    <footer class="hr-detail-actions"><button class="hr-secondary-button" type="button" data-hr-action="back-evidence">返回依据</button><button class="hr-primary-button approve" type="button" data-hr-action="approve-plan"><i data-icon="spark"></i> 按建议恢复招聘节奏</button></footer>`;
}

function hrPlanProgressMarkup() {
  const scheduled = hrDemoState === 'scheduled';
  const replied = hrDemoState === 'reply' || scheduled;
  return `<div class="hr-detail-eyebrow success"><span></span>${scheduled ? 'Syntropic 正在推进' : replied ? '需要你决定' : 'Syntropic 正在推进'}</div>
    <h2>${scheduled ? '集中面试日已排期' : replied ? '共同时间已匹配，等待发送邀请' : '团队招聘推进计划已开始执行'}</h2>
    <p class="hr-detail-lede">${scheduled ? '12 场系统设计面试已安排在 8 月 27–28 日。Syntropic 将继续跟踪候选人回复、面试评价与后续轮次。' : replied ? 'Syntropic 已找到 6 位候选人与 4 位评委的共同时间。发送外部邀请前，需要你确认。' : '你可以继续工作。Syntropic 正在重评候选人、更新评价标准并协调面试时间。'}</p>
    <section class="hr-progress-list">
      <article class="running"><i data-icon="clock"></i><span><strong>持续维护招聘目标</strong><small>${scheduled ? '下一检查点：首场面试结束后回收评价' : '继续跟踪候选人、面试、Offer 与到岗风险'}</small></span><b>持续</b></article>
      <article class="${replied ? 'done' : 'running'}"><i data-icon="user"></i><span><strong>补充 Agent 面试评委</strong><small>${replied ? '2 位备用评委已响应' : '3 份邀请已发送'}</small></span><b>${replied ? '已响应' : '跟踪中'}</b></article>
      <article class="${scheduled ? 'done' : replied ? 'ready' : 'waiting'}"><i data-icon="calendar"></i><span><strong>创建集中面试日</strong><small>${scheduled ? '12 场面试邀请已发送' : replied ? '6 位候选人与 4 位评委时间已匹配' : '正在合并候选人与评委日历'}</small></span><b>${scheduled ? '已排期' : replied ? '需确认' : '推进中'}</b></article>
      <article class="running"><i data-icon="clock"></i><span><strong>${scheduled ? '等待面试并回收评价' : '持续维护 6 个 HC'}</strong><small>${scheduled ? '面试结束后自动组织终面与 Offer 下一步' : '下一检查点：明天 10:00'}</small></span><b>持续</b></article>
    </section>
    <footer class="hr-detail-actions"><button class="hr-secondary-button" type="button" data-hr-action="reset-demo">重新演示</button>${replied && !scheduled ? '<button class="hr-primary-button" type="button" data-hr-action="confirm-interview">确认发送邀请 <i data-icon="arrow"></i></button>' : '<button class="hr-primary-button quiet" type="button" data-window-action="close-view">回到工作台</button>'}</footer>`;
}

function renderHRInsightBrowser(win, insightId) {
  win.dataset.activeHrInsight = insightId;
  win.querySelector('.window-body').innerHTML = hrInsightWindowMarkup(insightId);
  const libraryHidden = win.dataset.hrInsightLibraryHidden === 'true';
  if (libraryHidden) win.querySelector('.hr-insight-browser-body')?.classList.add('library-hidden');
  const sidebarToggle = win.querySelector('[data-hr-insight-toggle-library]');
  sidebarToggle?.classList.toggle('active', !libraryHidden);
  sidebarToggle?.setAttribute('aria-expanded', String(!libraryHidden));
  sidebarToggle?.setAttribute('aria-label', libraryHidden ? '显示洞察列表' : '隐藏洞察列表');
  hydrateIcons(win);
}

function openHRInsight(insightId = 'capacity') {
  const win = shell('hr-insight', 'Syntropic Insights', 'spark', hrInsightWindowMarkup(insightId), 'hr-window hr-preview-window hr-insight-window', { w: '1120px', h: '720px', x: '11vw', y: '3vh' });
  win.setAttribute('aria-label', 'Syntropic Insights');
  let sidebarToggle = win.querySelector('[data-hr-insight-toggle-library]');
  if (!sidebarToggle) {
    sidebarToggle = document.createElement('button');
    sidebarToggle.type = 'button';
    sidebarToggle.className = 'hr-window-sidebar-toggle hr-insight-sidebar-toggle';
    sidebarToggle.dataset.hrInsightToggleLibrary = '';
    sidebarToggle.setAttribute('aria-label', '隐藏洞察列表');
    sidebarToggle.setAttribute('aria-expanded', 'true');
    sidebarToggle.innerHTML = '<span data-icon="sidebar"></span>';
  }
  win.querySelector('.traffic')?.after(sidebarToggle);
  renderHRInsightBrowser(win, insightId);
  if (win.dataset.hrInsightBound) return;
  win.dataset.hrInsightBound = 'true';
  win.addEventListener('click', (event) => {
    const item = event.target.closest('[data-hr-insight-select]');
    if (item) { renderHRInsightBrowser(win, item.dataset.hrInsightSelect); return; }
    if (event.target.closest('[data-hr-insight-toggle-library]')) {
      const body = win.querySelector('.hr-insight-browser-body');
      body?.classList.toggle('library-hidden');
      const libraryHidden = body?.classList.contains('library-hidden');
      win.dataset.hrInsightLibraryHidden = String(libraryHidden);
      const sidebarToggle = win.querySelector('[data-hr-insight-toggle-library]');
      sidebarToggle?.classList.toggle('active', !libraryHidden);
      sidebarToggle?.setAttribute('aria-expanded', String(!libraryHidden));
      sidebarToggle?.setAttribute('aria-label', libraryHidden ? '显示洞察列表' : '隐藏洞察列表');
      return;
    }
  });
}

function getHRTaskDefinitions() {
  const active = hrDemoState !== 'insight';
  const replied = hrDemoState === 'reply';
  const scheduled = hrDemoState === 'scheduled';
  return {
    'hr-task-review': {
      icon:'search', title:'恢复系统设计面试产能', state:scheduled ? '恢复方案已执行' : active ? '正在执行恢复方案' : '正在关联 8 位评委日历', tone:scheduled ? 'done' : 'running', goal:'10 月 31 日前让 6 位 Agent 工程师完成入职',
      why:scheduled ? '集中面试日已排期，但招聘结果仍取决于面试评价、终面、Offer 与实际到岗。' : '飞书招聘中有 23 位候选人等待系统设计面试，但未来十天只有 4 个核心评委时段。',
      next:scheduled ? '等待面试进行，并在评价回收后判断下一步' : replied ? '等待你确认发送 8 月 27–28 日的集中面试邀请' : '继续匹配候选人与评委的共同时间',
      events:scheduled ? [['16:28','发现面试产能瓶颈','23 位候选人等待，只有 4 个可用时段','done'],['16:34','重评候选人与评价标准','林然等 8 位候选人重新进入有效队列','done'],['刚刚','集中面试日已排期','12 场面试邀请已发送，等待候选人回复','running']] : [['16:28','读取飞书招聘漏斗','128 份候选人记录 · 23 位等待技术面','done'],['16:29','关联团队面试评价','27 份评价中识别出系统设计环节堆积','done'],['16:31','检查 8 位评委日历','未来十天仅有 4 个核心评委时段',replied ? 'done' : 'running']],
    },
    'hr-task-followup': {
      icon:'user', title:'重评 8 位 Agent 候选人', state:scheduled ? '已完成重评' : '正在更新候选人队列', tone:scheduled ? 'done' : 'running', goal:'恢复被旧筛选标准低估的生产级 Agent 候选人',
      why:'Syntropic 对照 JD v3、27 份面试评价和团队入职表现，发现通用后端年限的权重过高。',
      next:scheduled ? '跟踪林然、许宁等候选人的邀请回复与有效窗口' : '继续保护林然、许宁等候选人的有效窗口',
      events:[['16:33','比较 JD v3 与高绩效信号','确定工具编排、评估与可靠性三项核心能力','done'],['16:35','重新评估候选人','林然、赵一帆、许宁、苏悦等 8 人进入机会清单','done'],['16:37','更新候选人队列','已同步回飞书招聘视图',scheduled ? 'done' : 'running']],
    },
    'hr-task-interview': {
      icon:'calendar', title:'组织 Agent 集中面试日', state:scheduled ? '邀请已发送，持续跟踪' : replied ? '等待你确认' : active || hrCreatedTaskIds.has('hr-task-interview') ? '正在合并可用时间' : '等待恢复方案确认', tone:active || hrCreatedTaskIds.has('hr-task-interview') ? 'running' : 'pending', goal:'在候选人有效窗口内完成 12 场系统设计面试',
      why:'集中安排可以减少评委切换成本，并避免林然等高匹配候选人在等待中流失。',
      next:scheduled ? '等待候选人接受邀请，并准备面试官 Brief' : replied ? '发送邀请前等待你的最终确认' : '继续合并 6 位候选人与 4 位评委的时间',
      events:[['16:38','读取候选人可用时间','林然等 6 位候选人已授权可用窗口','done'],['16:40','匹配评委日历','陈建、周禾、贺言、宋澜进入排期',replied || scheduled ? 'done' : 'running'],[replied || scheduled ? '16:41' : '进行中','生成 8 月 27–28 日面试方案',replied ? '等待发送邀请' : scheduled ? '12 场邀请已发送，正在跟踪回复' : '正在避免时间冲突',scheduled ? 'running' : replied ? 'review' : 'running']],
    },
    'hr-task-monitor': {
      icon:'clock', title:'维护 6 位工程师到岗结果', state:'持续运行', tone:'running', goal:'10 月 31 日前让 6 位 Agent 工程师完成入职',
      why:'Syntropic 会持续关联候选人、面试、Offer 与入职状态，任务完成不等于招聘结果完成。',
      next:scheduled ? '跟踪面试、评价、终面与 Offer，持续判断目标是否可达' : '持续判断目标是否可达，并在出现偏航时组织下一步',
      events:[['每天 09:30','同步飞书招聘状态','候选人、面试与 Offer 状态自动更新','done'],['实时','监测候选人有效窗口','等待超过 7 天时自动升级风险','running'],['目标日前','验证到岗结果','以完成入职作为验收标准','running']],
    },
    'hr-task-product-decision': {
      icon:'message', title:'对齐 AI 产品负责人招聘决策标准', state:'正在汇总面试反馈', tone:'running', goal:'统一评价标准并解除 2 位终面候选人的决策阻塞',
      why:'5 位面试官正在使用 3 套不同的评价重点，候选人已就绪，但招聘决策仍然停滞。',
      next:'生成统一决策卡，并准备 30 分钟面试官校准会',
      events:[['刚刚','汇总面试评价','已读取 5 位面试官的反馈','done'],['进行中','识别评价分歧','正在归并 3 套评价重点','running'],['下一步','生成统一决策卡','完成后等待用人经理确认','review']],
    },
    'hr-task-growth-offer': {
      icon:'chart', title:'评估增长负责人 Offer 薪酬方案', state:'正在准备决策方案', tone:'running', goal:'在候选人有效窗口内解决薪酬带与市场水平的偏差',
      why:'3 位高匹配候选人中有 2 位期望超出当前薪酬带，Offer 前的等待正在放大流失风险。',
      next:'完成市场薪酬对标，并生成预算内与例外审批两套方案',
      events:[['刚刚','读取候选人薪酬期望','2 位候选人超出当前薪酬带','done'],['进行中','生成市场对标','正在比较同类 Agent 岗位数据','running'],['下一步','准备两套决策方案','完成后发起用人决策','review']],
    },
    'hr-task-proactive-window': {
      icon:'spark', title:'保护高匹配候选人的面试窗口', state:'正在协调共同时间', tone:'running', createdAt:proactiveInsightPublishedAt, proactiveDemo:true,
      goal:'在 48 小时风险窗口内推进林然、许宁与苏悦进入系统设计面试',
      why:'Syntropic 主动关联候选人回复、招聘阶段与评委日历，发现 3 位高匹配候选人的有效窗口正在快速收窄。',
      next:'锁定 2 个可用评委时段，并在发送候选人邀请前带回给你确认',
      events:[['刚刚','发现候选人窗口风险','3 位高匹配候选人剩余窗口不足 48 小时','done'],['进行中','匹配候选人与评委时间','正在核对 3 位候选人与 4 位评委的共同时间','running'],['下一步','准备面试邀请','发送前等待你的确认','review']],
    },
    'hr-task-update-goal': {
      icon:'edit', title:'讨论并更新招聘目标', state:'正在执行 · 等待目标讨论', tone:'running',
      goal:'与用户确认新的招聘目标、期限、约束和验收标准',
      why:'当前目标是 10 月 31 日前完成 6 位 Agent 工程师到岗。Syntropic 已同步现有目标与招聘进展，准备与你讨论需要调整的内容。',
      next:'请描述希望修改的目标人数、岗位、期限或约束；确认后再更新业务目标',
      events:[['刚刚','读取当前业务目标','6 位 Agent 工程师到岗 · 截止 10 月 31 日','done'],['等待输入','讨论目标调整','等待你说明希望更新的目标、期限或约束','review'],['确认后','更新目标与推进计划','重新计算招聘节奏并持续跟踪','pending']],
    },
    ...hrUserTaskDefinitions,
  };
}

function saveHRCreatedTasks() {
  localStorage.setItem(hrCreatedTasksKey, JSON.stringify([...hrCreatedTaskIds]));
}

function createHRTask(taskId, { preserveInsight = false } = {}) {
  if (!getHRTaskDefinitions()[taskId]) return false;
  const created = !hrCreatedTaskIds.has(taskId);
  hrCreatedTaskIds.add(taskId);
  if (!hrTaskCreatedAt.has(taskId)) hrTaskCreatedAt.set(taskId, Date.now());
  saveHRCreatedTasks();
  updateTaskExperienceCounts();
  refreshHRCanvasObjects();
  refreshOpenHRWindows({ preserveInsight });
  return created;
}

function hrTaskSortTime(taskId, task) {
  return task.createdAt || hrTaskCreatedAt.get(taskId) || 0;
}

function visibleHRTaskEntries() {
  return Object.entries(getHRTaskDefinitions()).filter(([id]) => hrCreatedTaskIds.has(id));
}

function defaultHRTaskId() {
  const tasks = getHRTaskDefinitions();
  const createdIds = visibleHRTaskEntries()
    .map(([id]) => id)
    .sort((a, b) => hrTaskSortTime(b, tasks[b]) - hrTaskSortTime(a, tasks[a]));
  return createdIds.find((id) => tasks[id].tone === 'running') || createdIds[0] || Object.keys(tasks)[0];
}

function hrTaskCenterMarkup(activeId = 'hr-task-review') {
  const hrTaskDefinitions = getHRTaskDefinitions();
  const tasks = visibleHRTaskEntries()
    .sort(([idA, a], [idB, b]) => hrTaskSortTime(idB, b) - hrTaskSortTime(idA, a));
  if (!tasks.length) {
    const recommendations = ['hr-task-monitor', 'hr-task-review', 'hr-task-interview']
      .map((id) => [id, hrTaskDefinitions[id]])
      .filter(([, task]) => task);
    return `<div class="hr-codex-task-center empty">
      <aside class="hr-codex-thread-panel">
        <button class="hr-codex-new-task" type="button" data-hr-focus-input><i data-icon="plus"></i>新建任务</button>
        <div class="hr-codex-thread-label"><span>任务列表</span><small>0 项任务</small></div>
        <nav class="hr-codex-thread-list"><span class="hr-task-list-empty">任务会在创建后显示在这里</span></nav>
      </aside>
      <main class="hr-task-recommendation-panel">
        <span class="task-recommendation-mark"><i data-icon="spark"></i></span>
        <small>结合招聘目标推荐</small><h2>从第一个招聘任务开始</h2>
        <p>目前还没有执行中的任务。Syntropic 可以根据刚刚导入的招聘数据持续推进这些目标。</p>
        <section>${recommendations.map(([id, task]) => `<article><span data-icon="${task.icon}"></span><div><strong>${task.title}</strong><small>${task.goal}</small></div><button type="button" data-hr-task-recommend="${id}">开始任务</button></article>`).join('')}</section>
        <em>你也可以点击“新建任务”，直接描述需要完成的工作。</em>
      </main>
    </div>`;
  }
  if (!hrCreatedTaskIds.has(activeId)) activeId = defaultHRTaskId();
  const task = hrTaskDefinitions[activeId] || hrTaskDefinitions['hr-task-review'];
  const sourceChips = hrRecruitingReality.sources.map((source) => `<span><i data-icon="${source.icon}"></i><span><strong>${source.name}</strong><small>${source.updated}</small></span></span>`).join('');
  return `<div class="hr-codex-task-center">
    <aside class="hr-codex-thread-panel">
      <button class="hr-codex-new-task" type="button" data-hr-focus-input><i data-icon="plus"></i>新建任务</button>
      <div class="hr-codex-thread-label"><span>任务列表</span><small>${tasks.length} 项任务</small></div>
      <nav class="hr-codex-thread-list">${tasks.map(([id,item]) => `<button class="${id === activeId ? 'selected' : ''}" type="button" data-hr-task-select="${id}"><strong>${item.title}</strong>${item.tone === 'running' ? '<span class="hr-thread-running" role="status" aria-label="正在运行"><i></i></span>' : `<span class="hr-thread-state ${item.tone}">${item.tone === 'done' ? '已完成' : '待开始'}</span>`}</button>`).join('')}</nav>
    </aside>
    <main class="hr-codex-conversation">
      <header><strong>${task.title}</strong><small>Agent 工程师招聘 · ${task.state}</small><button type="button" data-hr-task-create-component="${activeId}"><i data-icon="blocks"></i>生成组件</button></header>
      <div class="hr-codex-message-stream" data-hr-message-stream>
        <div class="hr-codex-message agent"><i class="hr-agent-avatar">S</i><div><p>${task.why}</p><section class="hr-codex-tool-card hr-task-context-card"><header><span><i data-icon="database"></i><strong>招聘上下文已同步</strong></span><em>LIVE</em></header><div class="hr-task-source-chips">${sourceChips}</div></section><section class="hr-task-activity-card"><header><strong>活动记录</strong><small>今天 · 自动更新</small></header>${task.events.map(([time,title,detail,tone]) => `<article class="${tone}"><time>${time}</time><i></i><span><strong>${title}</strong><small>${detail}</small></span>${tone === 'running' ? '<b class="hr-task-event-spinner" role="status" aria-label="正在运行"></b>' : tone === 'review' ? '<em>需要确认</em>' : tone === 'pending' ? '<em>待开始</em>' : '<em>完成</em>'}</article>`).join('')}</section></div></div>
        <div class="hr-codex-message agent"><i class="hr-agent-avatar">S</i><div><p>${task.next}。涉及候选人邀请或日历变更时，我会在执行前带回给你确认。</p></div></div>
      </div>
      <div class="hr-codex-composer"><div class="ai-bar hr-task-ai-bar"><button class="attach-button" type="button" aria-label="添加上下文"><span data-icon="plus"></span></button><input data-hr-task-input autocomplete="off" placeholder="继续当前任务…" aria-label="继续当前任务" /><button class="send-button" type="button" data-hr-task-send aria-label="发送消息"><span data-icon="arrow-up"></span></button></div></div>
    </main>
  </div>`;
}

function renderHRTaskCenter(win, activeId = 'hr-task-review') {
  win.dataset.activeHrTask = activeId;
  win.querySelector('.window-body').innerHTML = hrTaskCenterMarkup(activeId);
  const listHidden = win.dataset.hrTaskListHidden === 'true';
  if (listHidden) win.querySelector('.hr-codex-task-center')?.classList.add('thread-panel-hidden');
  const sidebarToggle = win.querySelector('[data-hr-task-toggle-list]');
  sidebarToggle?.setAttribute('aria-expanded', String(!listHidden));
  sidebarToggle?.setAttribute('aria-label', listHidden ? '显示任务列表' : '隐藏任务列表');
  hydrateIcons(win);
}

function sendHRTaskMessage(win) {
  const input = win.querySelector('[data-hr-task-input]');
  const stream = win.querySelector('[data-hr-message-stream]');
  const message = input?.value.trim();
  if (!message || !stream) return;
  const userMessage = document.createElement('div');
  userMessage.className = 'hr-codex-message user entering';
  const userCopy = document.createElement('p');
  userCopy.textContent = message;
  userMessage.append(userCopy);
  stream.append(userMessage);
  input.value = '';
  stream.scrollTop = stream.scrollHeight;
  if (taskRequestsComponent(message)) {
    const taskId = win.dataset.activeHrTask;
    const task = getHRTaskDefinitions()[taskId];
    if (task) createTaskComponent(win, taskId, {
      ...task,
      stateText:task.state,
      description:task.goal || task.why,
      context:task.goal || 'Agent 工程师招聘',
      agent:'Syntropic Recruiter',
      tool:task.events?.at(-1)?.[1],
      detail:task.events?.at(-1)?.[2],
    }, message, 'hr');
    return;
  }
  const reply = document.createElement('div');
  reply.className = 'hr-codex-message agent entering';
  reply.innerHTML = '<i class="hr-agent-avatar">S</i><div><p>收到。我会把这条要求加入当前任务，并继续使用已有上下文推进；如果需要新的权限或对外动作，我会先向你确认。</p></div>';
  setTimeout(() => { stream.append(reply); stream.scrollTop = stream.scrollHeight; }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 320);
  showToast('已发送给 Syntropic');
}

function openHRTasks(activeId = 'hr-task-review') {
  const win = shell('hr-tasks', 'Syntropic 任务中心', 'message', hrTaskCenterMarkup(activeId), 'hr-task-window', { w:'1080px', h:'680px', x:'12vw', y:'4vh' });
  win.setAttribute('aria-label', '任务中心');
  let sidebarToggle = win.querySelector('[data-hr-task-toggle-list]');
  if (!sidebarToggle) {
    sidebarToggle = document.createElement('button');
    sidebarToggle.type = 'button';
    sidebarToggle.className = 'hr-window-sidebar-toggle hr-task-sidebar-toggle';
    sidebarToggle.dataset.hrTaskToggleList = '';
    sidebarToggle.setAttribute('aria-label', '隐藏任务列表');
    sidebarToggle.setAttribute('aria-expanded', 'true');
    sidebarToggle.innerHTML = '<span data-icon="sidebar"></span>';
  }
  win.querySelector('.traffic')?.after(sidebarToggle);
  renderHRTaskCenter(win, activeId);
  if (win.dataset.hrTasksBound) return;
  win.dataset.hrTasksBound = 'true';
  win.addEventListener('click', (event) => {
    const taskButton = event.target.closest('[data-hr-task-select]');
    if (taskButton) {
      renderHRTaskCenter(win, taskButton.dataset.hrTaskSelect);
      return;
    }
    const recommendation = event.target.closest('[data-hr-task-recommend]');
    if (recommendation) {
      createHRTask(recommendation.dataset.hrTaskRecommend);
      renderHRTaskCenter(win, recommendation.dataset.hrTaskRecommend);
      showToast('推荐任务已开始');
      return;
    }
    if (event.target.closest('[data-hr-task-toggle-list]')) {
      const center = win.querySelector('.hr-codex-task-center');
      center?.classList.toggle('thread-panel-hidden');
      const listHidden = center?.classList.contains('thread-panel-hidden');
      win.dataset.hrTaskListHidden = String(listHidden);
      const toggle = win.querySelector('[data-hr-task-toggle-list]');
      toggle?.setAttribute('aria-expanded', String(!listHidden));
      toggle?.setAttribute('aria-label', listHidden ? '显示任务列表' : '隐藏任务列表');
      return;
    }
    const createButton = event.target.closest('[data-hr-task-create-component]');
    if (createButton) {
      const task = getHRTaskDefinitions()[createButton.dataset.hrTaskCreateComponent];
      if (task) createTaskComponent(win, createButton.dataset.hrTaskCreateComponent, {
        ...task,
        stateText:task.state,
        description:task.goal || task.why,
        context:task.goal || 'Agent 工程师招聘',
        agent:'Syntropic Recruiter',
        tool:task.events?.at(-1)?.[1],
        detail:task.events?.at(-1)?.[2],
      }, '', 'hr');
      return;
    }
    const viewButton = event.target.closest('[data-task-component-view]');
    if (viewButton) {
      win.querySelector('[data-window-action="close"]')?.click();
      setTimeout(() => window.SyntropicComponents?.focusById?.(viewButton.dataset.taskComponentView), 180);
      return;
    }
    if (event.target.closest('[data-hr-task-send]')) sendHRTaskMessage(win);
    if (event.target.closest('[data-hr-focus-input]')) win.querySelector('[data-hr-task-input]')?.focus();
  });
  win.addEventListener('keydown', (event) => {
    if (!event.target.matches('[data-hr-task-input]')) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      sendHRTaskMessage(win);
    }
  });
}

function openHRJD() {
  openLarkDocumentWindow('hr-agent-engineer-jd');
}

function openHRShortlist() {
  const rows = hrRecruitingReality.candidates;
  const win = shell('hr-shortlist', '候选人 Shortlist', 'user', `<div class="hr-shortlist-window"><header><div><span>Syntropic 重新评估 · 今天 16:35</span><h2>生产级 Agent 候选人</h2></div><small>依据 JD v3、27 份面试评价与团队入职表现</small></header><div class="hr-candidate-table">${rows.map((candidate) => { const candidateId = registerHRCandidate({ avatar:candidate.initial, name:candidate.name, detail:`${candidate.company} · ${candidate.role}`, state:candidate.status, next:'查看招聘进展', source:'飞书招聘' }); return `<button type="button" data-open="hr-candidate-${candidateId}"><i>${candidate.initial}</i><span><strong>${candidate.name}</strong><small>${candidate.company} · ${candidate.role}</small></span><em>${candidate.signal}</em><b>${candidate.status}</b><span data-icon="arrow"></span></button>`; }).join('')}</div></div>`, 'hr-shortlist-shell', { w: '860px', h: '610px', x: '20vw', y: '6vh' });
  hydrateIcons(win);
}

function openHRCandidate(candidateId = 'linran') {
  if (candidateId === 'linran' && hrDemoState === 'active') setHRDemoState('reply');
  const scheduled = hrDemoState === 'scheduled';
  const candidate = hrCandidateDirectory[candidateId] || hrCandidateDirectory.linran;
  const isLinran = candidate.id === 'linran';
  const proposalTitle = isLinran ? (scheduled ? 'Agent 集中面试邀请已发送' : 'Syntropic 已找到集中面试日的共同时间') : '候选人下一节点';
  const footer = isLinran && !scheduled
    ? '<button class="hr-secondary-button" type="button" data-open="hr-shortlist">查看候选人资料</button><button class="hr-primary-button" type="button" data-hr-action="confirm-interview">确认发送邀请</button>'
    : '<button class="hr-primary-button quiet" type="button" data-window-action="close-view">返回招聘工作台</button>';
  const skills = (candidate.skills || []).map((skill) => `<i>${skill}</i>`).join('');
  const history = (candidate.history || []).map((item) => `<article><span><strong>${item.company}</strong><small>${item.role}</small></span><time>${item.period}</time><p>${item.detail}</p></article>`).join('');
  const progress = (candidate.progress || []).map(([stage,state,detail], index) => `<li class="${index < 2 ? 'complete' : 'current'}"><i></i><span><strong>${stage}</strong><small>${detail}</small></span><em>${state}</em></li>`).join('');
  const nextTitle = isLinran ? proposalTitle : candidate.nextAction;
  const win = shell(`hr-candidate-${candidate.id}`, `候选人 · ${candidate.name}`, 'user', `<div class="hr-candidate-window hr-candidate-profile"><aside><span class="hr-profile-avatar">${candidate.avatar}</span><h2>${candidate.name}</h2><p>${candidate.detail}</p><div><strong>${candidate.match || '—'}</strong><small>岗位综合匹配度</small></div><dl><span><dt>所在地</dt><dd>${candidate.location || '待补充'}</dd></span><span><dt>工作经验</dt><dd>${candidate.experience || '待补充'}</dd></span><span><dt>可入职时间</dt><dd>${candidate.availability || '待确认'}</dd></span><span><dt>教育背景</dt><dd>${candidate.education || '待补充'}</dd></span></dl></aside><main><header class="hr-profile-heading"><span><small>${candidate.source} · 候选人档案</small><h2>${candidate.state}</h2></span><em>${candidate.match || '—'} 匹配</em></header><section class="hr-profile-summary"><p>${candidate.summary || `${candidate.name} 的招聘资料正在同步。`}</p><div>${skills}</div></section><div class="hr-profile-content-grid"><section class="hr-profile-history"><header><strong>工作经历</strong><small>${candidate.experience || ''}</small></header><div>${history}</div></section><section class="hr-profile-progress"><header><strong>招聘进展</strong><small>持续同步</small></header><ol>${progress}</ol></section><section class="hr-profile-evaluation"><header><strong>Syntropic 评价摘要</strong><small>基于已授权数据</small></header><p>${candidate.feedback || '尚未生成评价摘要。'}</p></section><section class="hr-profile-next"><header><strong>风险与下一步</strong></header><p><b>风险</b>${candidate.risk || '暂无新增风险。'}</p><p><b>建议</b>${nextTitle}</p></section></div><footer>${footer}</footer></main></div>`, 'hr-candidate-shell hr-candidate-detail-shell', { w: '920px', h: '650px', x: '19vw', y: '4vh' });
  hydrateIcons(win);
}

function openHRBrief() {
  const win = shell('hr-brief', '面试官 Brief', 'file', `<div class="hr-brief-window"><span>INTERVIEW BRIEF · AGENT ENGINEER</span><h2>林然 · 面试重点</h2><p>Syntropic 根据岗位目标、候选人经历和团队过往高绩效信号整理。</p><section><article><b>01</b><span><strong>工具编排与执行边界</strong><small>验证复杂工具链中的权限、状态与失败处理设计。</small></span></article><article><b>02</b><span><strong>评估与可观测性</strong><small>深入追问她如何定义线上 Agent 的质量与退化信号。</small></span></article><article><b>03</b><span><strong>可靠性与故障恢复</strong><small>通过真实案例判断其生产环境中的系统取舍。</small></span></article></section><footer>由 Syntropic 自动生成 · 引用 8 条候选人经历和 27 份团队面试评价</footer></div>`, 'artifact-window hr-brief-shell', { w: '820px', h: '630px', x: '22vw', y: '5vh' });
  hydrateIcons(win);
}

function openHRGoalCenter() {
  const width = Math.max(780, Math.min(920, innerWidth - 48));
  const height = Math.max(460, Math.min(620, innerHeight - 230));
  const win = shell('hr-goal-center', '业务目标', 'spark', hrGoalCenterMarkup(), 'hr-goal-window', { w:`${width}px`, h:`${height}px`, x:`${Math.max(18, (innerWidth - width) / 2)}px`, y:'14px' });
  win.setAttribute('aria-label', '业务目标');
  win.querySelector('.window-body').innerHTML = hrGoalCenterMarkup();
  hydrateIcons(win);
}

function openHRItem(id) {
  if (id === 'hr-recruiting-app') openHRRecruitingApp();
  if (id === 'hr-goal-center') openHRGoalCenter();
  if (id === 'hr-insight' || id === 'hr-preview') openHRInsight();
  if (id.startsWith('hr-insight-')) openHRInsight(id.replace('hr-insight-', ''));
  if (id === 'hr-tasks') openHRTasks(defaultHRTaskId());
  if (id.startsWith('hr-task-')) openHRTasks(id);
  if (id === 'hr-jd') openHRJD();
  if (id === 'hr-shortlist') openHRShortlist();
  if (id.startsWith('hr-candidate-')) openHRCandidate(id.replace('hr-candidate-', ''));
  if (id.startsWith('hr-event-')) openHRScheduleEvent(id.replace('hr-event-', ''));
  if (id === 'hr-brief') openHRBrief();
}

document.addEventListener('click', (event) => {
  const closeView = event.target.closest('[data-window-action="close-view"]');
  if (closeView) {
    const closingWindow = closeView.closest('.os-window');
    closingWindow?.classList.remove('open');
    closingWindow?.setAttribute('aria-hidden', 'true');
    return;
  }
  const actionButton = event.target.closest('[data-hr-action]');
  if (!actionButton) return;
  const action = actionButton.dataset.hrAction;
  const win = actionButton.closest('.os-window');
  if (action === 'show-plan') {
    const detail = win?.querySelector('[data-hr-insight-detail]');
    if (detail) {
      detail.innerHTML = hrPlanMarkup();
      hydrateIcons(detail);
      detail.classList.remove('hr-detail-refresh');
      requestAnimationFrame(() => detail.classList.add('hr-detail-refresh'));
    }
  }
  if (action === 'back-evidence') {
    const detail = win?.querySelector('[data-hr-insight-detail]');
    if (detail) {
      detail.innerHTML = hrEvidenceMarkup();
      hydrateIcons(detail);
    }
  }
  if (action === 'approve-plan') {
    createHRTask('hr-task-review');
    beginHRPlan();
  }
  if (action === 'create-insight-task') {
    const taskId = actionButton.dataset.taskId || 'hr-task-review';
    if (actionButton.classList.contains('is-loading')) return;
    actionButton.classList.add('is-loading');
    actionButton.disabled = true;
    actionButton.style.width = `${Math.ceil(actionButton.getBoundingClientRect().width)}px`;
    actionButton.innerHTML = '<span class="hr-action-loading-spinner" aria-hidden="true"></span><span>正在创建</span>';
    const loadingDelay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 360 : 680;
    setTimeout(() => {
      const created = createHRTask(taskId, { preserveInsight: true });
      actionButton.classList.remove('is-loading');
      actionButton.disabled = false;
      actionButton.dataset.hrAction = 'open-insight-task';
      actionButton.innerHTML = '查看任务 <i data-icon="arrow"></i>';
      hydrateIcons(actionButton);
      showToast(created ? '推进任务已创建' : '任务已在运行中');
      openHRTasks(taskId);
      actionButton.style.width = '';
    }, loadingDelay);
  }
  if (action === 'open-insight-task') {
    openHRTasks(actionButton.dataset.taskId || defaultHRTaskId());
  }
  if (action === 'create-role-task') {
    const isProduct = actionButton.dataset.roleId === 'product';
    const taskId = isProduct ? 'hr-task-product-decision' : 'hr-task-growth-offer';
    createHRTask(taskId);
    showToast(isProduct ? '决策标准校准任务已创建' : '薪酬方案评估任务已创建');
    setTimeout(() => openHRTasks(taskId), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
  }
  if (action === 'update-goal') {
    const taskId = 'hr-task-update-goal';
    if (actionButton.classList.contains('is-loading')) return;
    actionButton.classList.add('is-loading');
    actionButton.disabled = true;
    actionButton.style.width = `${Math.ceil(actionButton.getBoundingClientRect().width)}px`;
    actionButton.setAttribute('aria-label', '正在创建目标讨论任务');
    actionButton.innerHTML = '<span class="hr-action-loading-spinner" aria-hidden="true"></span>';
    const loadingDelay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 260 : 520;
    setTimeout(() => {
      const created = createHRTask(taskId);
      showToast(created ? '目标讨论任务已创建' : '目标讨论任务已在运行');
      openHRTasks(taskId);
      requestAnimationFrame(() => findWorkspaceWindow('hr-tasks')?.querySelector('[data-hr-task-input]')?.focus());
    }, loadingDelay);
  }
  if (action === 'confirm-interview') {
    setHRDemoState('scheduled');
    showToast('邀请已发送，Syntropic 将继续跟踪候选人回复与面试结果');
  }
  if (action === 'reset-demo') resetHRDemo();
});

const aiInput = document.querySelector('#aiInput');
const aiSuggestions = document.querySelector('#aiSuggestions');
const aiForm = document.querySelector('#aiForm');
const aiSurface = document.querySelector('#aiSurface');
const voiceButton = document.querySelector('#voiceButton');
const voiceStatus = document.querySelector('#voiceStatus');
const aiDefaultPlaceholder = '与Syntropic协作';

const aiSuggestionSets = {
  default: [
    '分析本周用户反馈，出一个总结报告。',
    '继续推进竞品定价分析',
    '总结今天所有任务的进展'
  ],
  'hr-recruiting': [
    '汇报 6 位 Agent 工程师招聘目标的最新进展',
    '分析当前招聘瓶颈，并给出恢复招聘节奏的方案',
    '整理需要我确认的候选人和面试安排'
  ],
  'product-release': [
    '汇报 Q3 产品发布目标的最新进展',
    '分析影响按期发布的需求风险',
    '整理今天需要决策的阻塞事项'
  ]
};

function updateAISuggestionsForWorkspace() {
  const items = aiSuggestionSets[currentCanvasId] || aiSuggestionSets.default;
  aiSuggestions.innerHTML = `<header><span>你可能想问</span></header>${items.map((prompt) => {
    const safePrompt = prompt.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    return `<button type="button" data-prompt="${safePrompt}">${safePrompt}</button>`;
  }).join('')}`;
}

function setAIComposerExpanded(expanded) {
  aiSurface.classList.toggle('expanded', expanded);
  aiForm.setAttribute('aria-expanded', String(expanded));
}

function suggestions(open) {
  aiSuggestions.classList.toggle('open', open);
  aiSuggestions.setAttribute('aria-hidden', String(!open));
}

aiForm.addEventListener('pointerdown', (event) => {
  // Let the compact microphone finish its click before the control changes position.
  if (!aiSurface.classList.contains('expanded') && event.target.closest('.voice-button')) return;
  setAIComposerExpanded(true);
});
// Hover previews the full composer. Focus is reserved for an explicit click so
// a pointer-only preview can collapse naturally when the user moves away.
aiSurface.addEventListener('mouseenter', () => {
  setAIComposerExpanded(true);
});
aiSurface.addEventListener('mouseleave', () => {
  const activelyEditing = document.activeElement === aiInput;
  const hasDraft = Boolean(aiInput.value.trim());
  const isListening = voiceButton.classList.contains('listening');
  if (activelyEditing || hasDraft || isListening) return;
  suggestions(false);
  setAIComposerExpanded(false);
});
aiInput.addEventListener('focus', () => {
  setAIComposerExpanded(true);
  suggestions(!aiInput.value);
});
aiInput.addEventListener('input', () => {
  setAIComposerExpanded(true);
  suggestions(!aiInput.value);
});
document.addEventListener('pointerdown', (event) => {
  if (event.target.closest('.ai-surface')) return;
  suggestions(false);
  if (!aiInput.value && !voiceButton.classList.contains('listening')) {
    aiInput.blur();
    setAIComposerExpanded(false);
  }
});
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    setAIComposerExpanded(true);
    aiInput.focus();
    suggestions(true);
  }
  if (event.key === 'Escape') {
    suggestions(false);
    closeLaunchpad();
    stopVoiceDemo();
    if (!aiInput.value) {
      aiInput.blur();
      setAIComposerExpanded(false);
    }
  }
});
aiSuggestions.addEventListener('click', (event) => {
  const prompt = event.target.closest('[data-prompt]');
  if (!prompt) return;
  aiInput.value = prompt.dataset.prompt;
  suggestions(false);
  setAIComposerExpanded(true);
  aiInput.focus();
});

function addSubmittedTask(prompt) {
  const isHRTask = currentCanvasId === 'hr-recruiting';
  const createdAt = Date.now();
  const id = `${isHRTask ? 'hr-task-user' : 'task-user'}-${createdAt}`;
  taskData[id] = {
    state: 'running', stateText: '执行中', title: prompt,
    description: '由全局输入框创建，Syntropic 正在结合当前工作台制定执行计划。',
    agent: 'Syntropic Agent', letter: 'S', context: '当前工作台', user: prompt,
    reply: '任务已接收。我正在理解当前工作台中的任务、文档与产物，并整理接下来的执行步骤。',
    tool: '正在分析当前工作台上下文', detail: '任务已进入执行队列，进展会持续更新到桌面任务组件。'
  };
  visibleGeneralTaskIds.add(id);
  saveVisibleGeneralTasks();

  if (isHRTask) {
    hrUserTaskDefinitions[id] = {
      icon:'spark', title:prompt, state:'正在执行', tone:'running', createdAt, userCreated:true,
      goal:prompt,
      why:'任务已接收。Syntropic 正在结合招聘目标、候选人进展和当前工作台上下文制定执行计划。',
      next:'继续分析招聘上下文，并把后续进展更新到当前任务',
      events:[['刚刚','接收任务','已加入招聘工作台的执行队列','done'],['进行中','同步招聘上下文','正在读取候选人、面试与目标进展','running'],['下一步','制定执行计划','完成后持续更新任务进展','pending']],
    };
    hrCreatedTaskIds.add(id);
    saveHRCreatedTasks();
    updateTaskExperienceCounts();
    refreshHRCanvasObjects();
    return { id, row: null, isHRTask: true };
  }

  const list = document.querySelector('.task-widget-list');
  if (!list) return { id, row: null };

  const row = document.createElement('button');
  row.className = 'task-widget-row task-widget-row-new';
  row.type = 'button';
  row.dataset.open = id;
  row.innerHTML = '<strong></strong><small>正在理解任务并制定执行计划</small><span class="task-row-status running" aria-label="执行中"><i></i></span>';
  row.querySelector('strong').textContent = prompt;
  hydrateIcons(row);
  list.prepend(row);
  list.scrollTop = 0;
  updateTaskWidgetCount();

  const widget = list.closest('.task-widget');
  widget?.classList.remove('task-received');
  requestAnimationFrame(() => {
    row.classList.add('visible');
    widget?.classList.add('task-received');
  });
  setTimeout(() => widget?.classList.remove('task-received'), 720);
  return { id, row, isHRTask: false };
}

function updateTaskWidgetCount() {
  updateTaskExperienceCounts();
}

function updateTaskExperienceCounts() {
  document.querySelectorAll('.task-widget-row').forEach((row) => {
    if (!row.dataset.open?.startsWith('task-')) return;
    row.hidden = syntropicMode === 'demo' && !visibleGeneralTaskIds.has(row.dataset.open);
  });
  const count = currentCanvasId === 'hr-recruiting' ? visibleHRTaskEntries().length : visibleGeneralTaskEntries().length;
  const countLabel = document.querySelector('[data-task-summary-count]');
  const dockBadge = document.querySelector('[data-action="all-tasks"] .dock-badge');
  if (countLabel) countLabel.textContent = String(count);
  if (dockBadge) {
    dockBadge.textContent = String(count);
    dockBadge.hidden = count === 0;
  }
}

const taskOutputObject = document.querySelector('[data-task-output="feedback-report"]');
let feedbackOutputTimer;

function isFeedbackOutputPrompt(prompt) {
  const normalized = prompt.toLowerCase();
  return (normalized.includes('用户反馈') || normalized.includes('客户洞察')) &&
    (normalized.includes('总结报告') || normalized.includes('报告') || normalized.includes('html') || normalized.includes('网页'));
}

function startFeedbackOutputTask(task) {
  if (!taskOutputObject || !task) return;
  clearTimeout(feedbackOutputTimer);
  taskOutputObject.hidden = true;
  taskOutputObject.classList.remove('revealing');
  const taskRecord = taskData[task.id];
  taskRecord.description = '连接演示办公数据，完成归集、分析并生成可执行的 HTML 客户洞察。';
  taskRecord.context = '飞书妙记、客服工单、客户群与产品数据';
  taskRecord.reply = '我正在授权范围内读取飞书会议、客服工单、客户群和产品数据，完成去重、主题聚类与证据关联。HTML 洞察完成后会直接回到当前工作台。';
  taskRecord.tool = '正在生成用户反馈洞察.html';
  taskRecord.detail = '已连接 4 个办公数据源，正在分析 126 条有效工作信号。';
  const rowDetail = task.row?.querySelector('small');
  if (rowDetail) rowDetail.textContent = '已连接 4 个数据源，正在分析 126 条工作信号';

  const delay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 900 : 4200;
  feedbackOutputTimer = setTimeout(() => completeFeedbackOutputTask(task), delay);
}

function completeFeedbackOutputTask(task) {
  if (!taskOutputObject || !taskData[task.id]) return;
  const taskRecord = taskData[task.id];
  taskRecord.state = 'done';
  taskRecord.stateText = '已完成';
  taskRecord.reply = '用户反馈洞察网页已经生成，并作为任务产物放到了当前工作台。';
  taskRecord.tool = '用户反馈洞察.html 已生成';
  taskRecord.detail = '已分析 126 条跨系统工作信号，识别 3 个高影响问题和 7 项建议动作。';

  taskOutputObject.querySelector('[data-output-origin-title]').textContent = taskRecord.title;
  const originButton = taskOutputObject.querySelector('.task-output-source');
  originButton.dataset.open = task.id;
  const currentCanvas = getCurrentCanvas();
  if (currentCanvas?.showBase) {
    currentCanvas.hiddenObjects = (currentCanvas.hiddenObjects || []).filter((id) => id !== taskOutputObject.dataset.objectId);
    taskOutputObject.classList.remove('canvas-unpinned', 'unpinning');
    if (!canvasObjects.includes(taskOutputObject)) canvasObjects.push(taskOutputObject);
    saveCanvasRegistry();
    updateDocumentPinButtons();
  }
  task.row?.classList.add('task-completing');

  setTimeout(() => {
    if (task.row) {
      task.row.hidden = true;
      task.row.classList.remove('task-completing');
    }
    updateTaskWidgetCount();
    taskOutputObject.hidden = false;
    requestAnimationFrame(() => taskOutputObject.classList.add('revealing'));
    showTaskCompletionNotification(task.id, taskRecord.title, '已生成用户反馈洞察.html，并放到当前工作台。');
    showToast('任务已完成，用户反馈洞察.html 已放到桌面');
  }, 380);
  setTimeout(() => taskOutputObject.classList.remove('revealing'), 1200);
}

function setVoiceListening(listening) {
  if (voiceButton.classList.contains('listening') === listening) return;
  voiceButton.classList.toggle('listening', listening);
  aiForm.classList.toggle('is-listening', listening);
  voiceButton.setAttribute('aria-pressed', String(listening));
  voiceButton.setAttribute('aria-label', listening ? '停止语音输入' : '开始语音输入');
  aiInput.placeholder = listening ? '正在聆听...' : aiDefaultPlaceholder;
  voiceStatus.textContent = listening ? '语音输入已开启' : '语音输入已结束';
  if (listening) suggestions(false);
}

const voiceDemoPrompt = '分析本周用户反馈，出一个总结报告。';
let voiceDemoTimer = 0;
let voiceDemoRunId = 0;

function cancelVoiceDemoTimer() {
  voiceDemoRunId += 1;
  clearTimeout(voiceDemoTimer);
  voiceDemoTimer = 0;
}

function stopVoiceDemo() {
  cancelVoiceDemoTimer();
  setVoiceListening(false);
}

function startVoiceDemo() {
  cancelVoiceDemoTimer();
  const runId = voiceDemoRunId;
  let characterIndex = 0;

  aiInput.value = '';
  setAIComposerExpanded(true);
  aiInput.focus();
  setVoiceListening(true);
  suggestions(false);

  const revealNextCharacter = () => {
    if (runId !== voiceDemoRunId || !voiceButton.classList.contains('listening')) return;

    characterIndex += 1;
    aiInput.value = voiceDemoPrompt.slice(0, characterIndex);
    aiInput.setSelectionRange(aiInput.value.length, aiInput.value.length);

    if (characterIndex >= voiceDemoPrompt.length) {
      voiceDemoTimer = setTimeout(() => {
        if (runId !== voiceDemoRunId) return;
        voiceDemoTimer = 0;
        setVoiceListening(false);
        voiceStatus.textContent = '语音输入已完成';
        aiInput.focus();
      }, 360);
      return;
    }

    const recognizedCharacter = voiceDemoPrompt[characterIndex - 1];
    const nextDelay = recognizedCharacter === '，' ? 260 : recognizedCharacter === '。' ? 360 : 115;
    voiceDemoTimer = setTimeout(revealNextCharacter, nextDelay);
  };

  voiceDemoTimer = setTimeout(revealNextCharacter, 180);
}

voiceButton.addEventListener('click', () => {
  if (voiceButton.classList.contains('listening')) stopVoiceDemo();
  else startVoiceDemo();
});
aiForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const prompt = aiInput.value.trim();
  if (!prompt) { aiInput.focus(); suggestions(true); return; }
  if (window.SyntropicComponents?.handlePrompt(prompt)) {
    aiInput.value = '';
    stopVoiceDemo();
    suggestions(false);
    aiForm.classList.add('task-sent');
    setTimeout(() => aiForm.classList.remove('task-sent'), 620);
    aiInput.blur();
    setAIComposerExpanded(false);
    return;
  }
  aiInput.value = '';
  stopVoiceDemo();
  suggestions(false);
  const submittedTask = addSubmittedTask(prompt);
  if (isFeedbackOutputPrompt(prompt)) startFeedbackOutputTask(submittedTask);
  aiForm.classList.add('task-sent');
  setTimeout(() => aiForm.classList.remove('task-sent'), 620);
  showToast('任务已发送，Syntropic 正在开始处理');
  aiInput.blur();
  setAIComposerExpanded(false);
  if (submittedTask) {
    const openDelay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 120 : 420;
    setTimeout(() => {
      if (submittedTask.isHRTask) openHRTasks(submittedTask.id);
      else openTask(submittedTask.id);
    }, openDelay);
  }
});

const dock = document.querySelector('#dock');
dock.addEventListener('pointermove', (event) => {
  dock.querySelectorAll('.dock-item').forEach((item) => {
    const rect = item.getBoundingClientRect();
    const distance = Math.abs(event.clientX - (rect.left + rect.width / 2));
    const influence = Math.max(0, 1 - distance / 105);
    item.style.transform = `translateY(${-11 * influence}px) scale(${1 + influence * .2})`;
  });
});
dock.addEventListener('pointerleave', () => dock.querySelectorAll('.dock-item').forEach((item) => { item.style.transform = ''; }));

let toastTimer;
function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2100);
}

function updateTime() {
  const now = new Date();
  const time = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  document.querySelector('#menuClock').textContent = time;
  document.querySelector('#menuDate').textContent = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(now);
  const calendarTime = document.querySelector('#calendarTime');
  const calendarDate = document.querySelector('#calendarDate');
  const calendarDay = document.querySelector('#calendarDay');
  const calendarWeekday = document.querySelector('#calendarWeekday');
  if (calendarTime) calendarTime.textContent = time;
  if (calendarDate) calendarDate.textContent = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(now);
  if (calendarDay) calendarDay.textContent = String(now.getDate());
  if (calendarWeekday) calendarWeekday.textContent = new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(now);
}
updateTime();
setInterval(updateTime, 30000);

const launchpad = document.querySelector('#launchpad');
const launchpadGrid = document.querySelector('#launchpadGrid');
const launchpadSearch = document.querySelector('#launchpadSearch');
const launchpadCategories = document.querySelector('#launchpadCategories');
let activeLaunchCategory = '全部';

function launchpadAppMarkup(app) {
  const behavior = app.action ? `data-action="${app.action}"` : `data-open="${app.open}"`;
  const content = app.icon ? `<span data-icon="${app.icon}"></span>` : `<strong class="launch-app-letter">${app.letter}</strong>`;
  return `<button class="launch-app" type="button" ${behavior} data-app-name="${app.name}" data-launch-name="${app.name.toLowerCase()}"><span class="launch-app-icon" style="--app-color:${app.color};${app.dark ? 'color:#17191c' : ''}">${content}</span><span>${app.name}</span></button>`;
}

function renderLaunchpad(query = '') {
  const normalized = query.trim().toLowerCase();
  launchpadGrid.innerHTML = launchpadApps
    .filter((app) => (activeLaunchCategory === '全部' || app.category === activeLaunchCategory) && app.name.toLowerCase().includes(normalized))
    .map(launchpadAppMarkup).join('');
  hydrateIcons(launchpadGrid);
}

function openLaunchpad() {
  suggestions(false);
  launchpad.classList.add('open');
  launchpad.setAttribute('aria-hidden', 'false');
  launchpadSearch.value = '';
  activeLaunchCategory = '全部';
  launchpadCategories.querySelectorAll('button').forEach((button) => button.classList.toggle('selected', button.dataset.launchCategory === '全部'));
  renderLaunchpad();
  setTimeout(() => launchpadSearch.focus(), 180);
}

function closeLaunchpad() {
  launchpad.classList.remove('open');
  launchpad.setAttribute('aria-hidden', 'true');
}

renderLaunchpad();
launchpadSearch.addEventListener('input', () => renderLaunchpad(launchpadSearch.value));
launchpadCategories.addEventListener('click', (event) => {
  const category = event.target.closest('[data-launch-category]');
  if (!category) return;
  activeLaunchCategory = category.dataset.launchCategory;
  launchpadCategories.querySelectorAll('button').forEach((button) => button.classList.toggle('selected', button === category));
  renderLaunchpad(launchpadSearch.value);
});
launchpad.querySelector('.launchpad-close').addEventListener('click', closeLaunchpad);
launchpad.addEventListener('click', (event) => {
  const appButton = event.target.closest('.launch-app');
  if (appButton) {
    closeLaunchpad();
    return;
  }
  if (event.target.closest('.launchpad-header,.launchpad-categories')) return;
  closeLaunchpad();
});

const desktopCanvas = document.querySelector('#desktop');
const canvasWorld = document.querySelector('#canvasWorld');
const canvasConnectionList = document.querySelector('#canvasConnectionList');
const connectionDraft = document.querySelector('#connectionDraft');
const connectionControls = document.querySelector('#connectionControls');
const zoomLabel = document.querySelector('#zoomLabel');
const canvasHint = document.querySelector('#canvasHint');
const widgetPicker = document.querySelector('#widgetPicker');
const widgetPickerList = document.querySelector('#widgetPickerList');
const workspaceSwitcher = document.querySelector('#workspaceSwitcher');
const workspacePopover = document.querySelector('#workspacePopover');
const workspaceList = document.querySelector('#workspaceList');
const workspaceName = document.querySelector('#workspaceName');
const workspaceCount = document.querySelector('#workspaceCount');
const workspaceAdd = document.querySelector('#workspaceAdd');
const baseCanvasObjects = [...document.querySelectorAll('.canvas-object')];
const globalCanvasWidgets = baseCanvasObjects.filter((object) => object.hasAttribute('data-global-widget'));
let canvasObjects = [...baseCanvasObjects];
const legacyLayoutKey = 'solo-canvas-layout-v1';
const legacyViewKey = 'solo-canvas-view-v1';
const legacyDynamicItemsKey = 'solo-canvas-items-v1';
const canvasesKey = 'solo-canvases-v1';
const currentCanvasKey = 'solo-current-canvas-v1';
const defaultCanvasId = 'hr-recruiting';
const globalWidgetsKey = 'solo-global-widgets-v4';
const productTemplateVersionKey = 'solo-product-template-v1';
const taskDensityVersionKey = 'solo-task-density-v1';
const inputOutputVersionKey = 'solo-input-output-v1';
const visualPriorityVersionKey = 'solo-visual-priority-v1';
const hrTemplateVersionKey = 'solo-hr-template-v1';
const hrOutcomeVersionKey = 'solo-hr-outcome-story-v1';
const desktopWorkspaceVersionKey = 'solo-desktop-workspace-v1';
const workspaceOrderVersionKey = 'solo-workspace-order-v1';
const desktopMode = true;
let canvasMode = 'select';
let canvasView = { x: 0, y: 0, scale: innerWidth < 600 ? 0.62 : 1 };
let canvases = [];
let currentCanvasId = '';
let connections = [];
let connectionGesture = null;
let selectedConnectionId = null;
let enabledGlobalWidgets = [];

const defaultPositions = Object.fromEntries(baseCanvasObjects.map((object) => [object.dataset.objectId, {
  x: parseFloat(object.style.getPropertyValue('--object-x')),
  y: parseFloat(object.style.getPropertyValue('--object-y')),
}]));

function readStored(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}

const desktopCanvasSize = { width: 1540, height: 820 };

function desktopViewportSize() {
  return {
    width: desktopCanvas.clientWidth || innerWidth,
    height: desktopCanvas.clientHeight || Math.max(0, innerHeight - 44),
  };
}

function desktopScale() {
  const viewport = desktopViewportSize();
  const widthScale = (viewport.width - 32) / desktopCanvasSize.width;
  const heightScale = (viewport.height - 24) / desktopCanvasSize.height;
  return Math.min(1, Math.max(.62, Math.min(widthScale, heightScale)));
}

function defaultCanvasView() {
  const viewport = desktopViewportSize();
  const scale = desktopScale();
  return {
    x: Math.max(0, Math.round((viewport.width - desktopCanvasSize.width * scale) / 2)),
    // Top-align the world (small margin) instead of centering, so the canvas
    // top edge sits at the top of the screen and components reach y: 0.
    y: Math.max(0, Math.min(Math.round((viewport.height - desktopCanvasSize.height * scale) / 2), 24)),
    scale,
  };
}
const hrCanvasView = () => defaultCanvasView();
const demoTrendImage = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="360"><rect width="600" height="360" fill="#d5ecaa"/><circle cx="460" cy="120" r="90" fill="#9fc674"/><path d="M60 280 L170 210 L280 245 L390 130 L540 170" fill="none" stroke="#284a36" stroke-width="18" stroke-linecap="round"/></svg>')}`;

function productTemplateItems() {
  return [
    { id: 'product-goal', type: 'product-goal', x: 40, y: 125 },
    { id: 'product-progress', type: 'product-progress', x: 300, y: 110 },
    { id: 'product-risks', type: 'product-risks', x: 1160, y: 125 },
    { id: 'product-activity', type: 'product-activity', x: 1160, y: 405 },
  ];
}

function hrTemplateItems() {
  return [
    { id: 'hr-goal', type: 'hr-goal', x: 40, y: 125 },
    { id: 'hr-schedule', type: 'hr-schedule', x: 40, y: 310 },
    { id: 'hr-activity', type: 'hr-activity', x: 1180, y: 125 },
    { id: 'hr-insights', type: 'hr-insights', x: 1180, y: 335 },
  ];
}

function workspaceCanvasTemplates() {
  const legacyLayout = readStored(legacyLayoutKey, {});
  const legacyView = readStored(legacyViewKey, defaultCanvasView());
  const legacyItems = readStored(legacyDynamicItemsKey, []);
  return [
    {
      id: 'hr-recruiting', name: '招聘工作台', accent: '#dfece7', showBase: false,
      layout: {}, view: hrCanvasView(), dynamicItems: hrTemplateItems(), connections: [],
    },
    {
      id: 'product-release', name: '产品发布工作台', accent: '#dce7f5', showBase: false,
      layout: {}, view: defaultCanvasView(), dynamicItems: productTemplateItems(), connections: [],
    },
    {
      id: 'research-insights', name: '调研洞察', accent: '#dfe8f7', showBase: false,
      layout: {}, view: defaultCanvasView(), dynamicItems: [
        { id: 'research-note', type: 'text', content: '访谈结论\n用户更关注持续可见的任务进展，而不只是最终结果。', x: 250, y: 185 },
        { id: 'research-image', type: 'image', name: '用户需求趋势.png', src: demoTrendImage, x: 570, y: 170 },
        { id: 'research-file', type: 'file', name: '用户访谈记录.pdf', extension: 'PDF', size: 386000, x: 910, y: 230 },
      ], connections: [{ id: 'research-connection', from: 'research-note', to: 'research-image' }],
    },
    {
      id: 'personal-focus', name: '个人工作台', accent: '#ebe5f3', showBase: false,
      layout: {}, view: defaultCanvasView(), dynamicItems: [
        { id: 'focus-note', type: 'text', content: '今日重点\n1. 确认产品叙事\n2. 完成发布评审\n3. 回复客户反馈', x: 330, y: 195 },
        { id: 'focus-outcome', type: 'text', content: '本周发布评审', x: 720, y: 235 },
      ], connections: [{ id: 'focus-connection', from: 'focus-note', to: 'focus-outcome' }],
    },
  ];
}

function initialCanvasRegistry() {
  const templates = workspaceCanvasTemplates();
  return syntropicMode === 'demo' ? [templates[0]] : templates;
}

function saveCanvasRegistry() {
  localStorage.setItem(canvasesKey, JSON.stringify(canvases));
  localStorage.setItem(currentCanvasKey, currentCanvasId);
}

function getCurrentCanvas() {
  return canvases.find((canvas) => canvas.id === currentCanvasId);
}

const widgetCatalog = {
  'task-widget': { name: '当前任务', description: '进行中与待确认任务', icon: 'message', size: [500, 272] },
  'schedule-widget': { name: '今日日程', description: '会议与专注时间', icon: 'calendar', size: [230, 210] },
  'stock-widget': { name: '市场关注', description: '关注公司与市场变化', icon: 'chart', size: [240, 210] },
};

function defaultWidgetPosition(canvas, widgetId) {
  if (canvas.showBase) return defaultPositions[widgetId];
  const positions = {
    'task-widget': { x: 40, y: 520 },
    'schedule-widget': { x: 540, y: 520 },
    'stock-widget': { x: 800, y: 520 },
  };
  return positions[widgetId] || defaultPositions[widgetId];
}

function renderWidgetPicker() {
  const currentWidgets = getCurrentCanvas()?.widgetIds || [];
  widgetPickerList.innerHTML = Object.entries(widgetCatalog).map(([id, widget]) => {
    const enabled = currentWidgets.includes(id);
    return `<button type="button" data-widget-toggle="${id}" aria-pressed="${enabled}"><span data-icon="${widget.icon}"></span><span><strong>${widget.name}</strong><small>${widget.description}</small></span><i>${enabled ? '已添加' : '添加'}</i></button>`;
  }).join('');
  hydrateIcons(widgetPickerList);
}

function setWidgetPicker(open) {
  widgetPicker.classList.toggle('open', open);
  widgetPicker.setAttribute('aria-hidden', String(!open));
  document.querySelector('[data-canvas-action="widgets"]')?.classList.toggle('selected', open);
  renderWidgetPicker();
}

function toggleGlobalWidget(id) {
  const widget = widgetCatalog[id];
  if (!widget) return;
  captureCurrentCanvasState();
  const current = getCurrentCanvas();
  current.widgetIds ||= [];
  const enabled = current.widgetIds.includes(id);
  if (enabled) {
    current.widgetIds = current.widgetIds.filter((widgetId) => widgetId !== id);
  } else {
    const [width, height] = widget.size;
    current.layout[id] ||= defaultPositions[id] || blankCanvasPosition(width, height);
    current.widgetIds.push(id);
  }
  saveCanvasRegistry();
  performCanvasLoad(currentCanvasId);
  renderWidgetPicker();
  showToast(`${widget.name}已${enabled ? '移除' : '添加'}到桌面`);
}

function initializeCanvasRegistry() {
  const stored = readStored(canvasesKey, null);
  const defaultWidgets = ['task-widget', 'schedule-widget', 'stock-widget'];
  const storedWidgets = readStored(globalWidgetsKey, defaultWidgets);
  enabledGlobalWidgets = Array.isArray(storedWidgets) ? storedWidgets.filter((id) => widgetCatalog[id]) : defaultWidgets;
  canvases = Array.isArray(stored) && stored.length ? stored : initialCanvasRegistry();
  canvases = canvases.map((canvas, index) => ({
    id: canvas.id || `canvas-${Date.now()}-${index}`,
    name: canvas.name || `工作台 ${index + 1}`,
    accent: canvas.accent || ['#d6e9e5', '#dfe8f7', '#ebe5f3'][index % 3],
    showBase: Boolean(canvas.showBase),
    layout: canvas.layout || {},
    view: canvas.view || defaultCanvasView(),
    hiddenObjects: Array.isArray(canvas.hiddenObjects) ? canvas.hiddenObjects : [],
    hiddenDynamicItems: Array.isArray(canvas.hiddenDynamicItems) ? canvas.hiddenDynamicItems : [],
    minimizedItems: Array.isArray(canvas.minimizedItems) ? canvas.minimizedItems : [],
    componentOverrides: canvas.componentOverrides && typeof canvas.componentOverrides === 'object' ? canvas.componentOverrides : {},
    widgetIds:Array.isArray(canvas.widgetIds) ? canvas.widgetIds.filter((id) => widgetCatalog[id]) : canvas.showBase ? [...enabledGlobalWidgets] : [],
    dynamicItems: Array.isArray(canvas.dynamicItems) ? canvas.dynamicItems
      .filter((item) => item.type !== 'app' && item.type !== 'arrow')
      .map((item) => item.type === 'note' ? { ...item, type: 'text' } : item) : [],
    connections: Array.isArray(canvas.connections) ? canvas.connections : [],
  }));
  if (localStorage.getItem(desktopWorkspaceVersionKey) !== '1') {
    canvases.forEach((canvas) => {
      canvas.view = defaultCanvasView();
      canvas.connections = [];
    });
    const hrCanvas = canvases.find((canvas) => canvas.id === 'hr-recruiting');
    if (hrCanvas) hrCanvas.layout = {};
    const productCanvas = canvases.find((canvas) => canvas.id === 'product-release');
    if (productCanvas) productCanvas.layout = {
      ...productCanvas.layout,
      'schedule-widget':{ x:70, y:160 },
      'stock-widget':{ x:330, y:160 },
      'task-widget':{ x:70, y:400 },
    };
    localStorage.setItem(desktopWorkspaceVersionKey, '1');
  }
  if (localStorage.getItem(hrTemplateVersionKey) !== '9') {
    let hrCanvas = canvases.find((canvas) => canvas.id === 'hr-recruiting');
    if (!hrCanvas) {
      hrCanvas = { id: 'hr-recruiting', name: '招聘工作台', accent: '#dfece7', showBase: false, layout: {}, view: hrCanvasView(), hiddenObjects: [], hiddenDynamicItems: [], dynamicItems: [], connections: [] };
      canvases.push(hrCanvas);
    }
    const customTypes = new Set(['hr-goal', 'hr-agent-status', 'hr-schedule', 'hr-pipeline', 'hr-insight-card', 'hr-insights', 'hr-activity', 'hr-artifact', 'hr-files']);
    hrCanvas.dynamicItems = [...(hrCanvas.dynamicItems || []).filter((item) => !customTypes.has(item.type) && item.id !== 'hr-greeting'), ...hrTemplateItems()];
    hrCanvas.layout = {};
    hrCanvas.hiddenDynamicItems = [];
    hrCanvas.connections = [];
    hrCanvas.view = hrCanvasView();
    hrDemoState = 'insight';
    localStorage.setItem(hrDemoStateKey, hrDemoState);
    localStorage.setItem(currentCanvasKey, defaultCanvasId);
    localStorage.setItem(hrTemplateVersionKey, '9');
  }
  if (localStorage.getItem(hrOutcomeVersionKey) !== '1') {
    hrDemoState = 'insight';
    localStorage.setItem(hrDemoStateKey, hrDemoState);
    localStorage.setItem(hrOutcomeVersionKey, '1');
  }
  if (localStorage.getItem(productTemplateVersionKey) !== '3') {
    const productCanvas = canvases.find((canvas) => canvas.id === 'product-release');
    if (productCanvas) {
      const productTypes = new Set(['product-goal', 'product-progress', 'product-risks', 'product-activity']);
      productCanvas.showBase = false;
      productCanvas.layout = {};
      productCanvas.hiddenObjects = [];
      productCanvas.hiddenDynamicItems = [];
      productCanvas.dynamicItems = [...(productCanvas.dynamicItems || []).filter((item) => !productTypes.has(item.type) && !item.id.startsWith('product-')), ...productTemplateItems()];
      productCanvas.view = defaultCanvasView();
    }
    localStorage.setItem(currentCanvasKey, defaultCanvasId);
    localStorage.setItem(productTemplateVersionKey, '3');
  }
  if (localStorage.getItem(taskDensityVersionKey) !== '1') {
    const productCanvas = canvases.find((canvas) => canvas.id === 'product-release');
    if (productCanvas) {
      ['schedule-widget', 'stock-widget'].forEach((id) => {
        const position = productCanvas.layout[id];
        if (position && Math.abs(position.y - 475) < 2) position.y = 550;
      });
      const greeting = productCanvas.dynamicItems.find((item) => item.id === 'product-greeting');
      if (greeting) greeting.subtitle = '2 个任务正在推进，2 个任务等待确认';
    }
    localStorage.setItem(taskDensityVersionKey, '1');
  }
  if (localStorage.getItem(inputOutputVersionKey) !== '1') {
    const productCanvas = canvases.find((canvas) => canvas.id === 'product-release');
    const greeting = productCanvas?.dynamicItems.find((item) => item.id === 'product-greeting');
    if (greeting) greeting.subtitle = '2 个任务正在推进，2 个任务等待确认';
    localStorage.setItem(inputOutputVersionKey, '1');
  }
  if (localStorage.getItem(visualPriorityVersionKey) !== '1') {
    const productCanvas = canvases.find((canvas) => canvas.id === 'product-release');
    if (productCanvas) {
      productCanvas.dynamicItems = productCanvas.dynamicItems.filter((item) => item.id !== 'product-task-label');
      const greeting = productCanvas.dynamicItems.find((item) => item.id === 'product-greeting');
      if (greeting) {
        greeting.subtitle = '';
        greeting.x = 70;
        greeting.y = 48;
      }
      productCanvas.layout['schedule-widget'] = { x: 70, y: 160 };
      productCanvas.layout['stock-widget'] = { x: 330, y: 160 };
      productCanvas.layout['task-widget'] = { x: 70, y: 400 };
    }
    localStorage.setItem(visualPriorityVersionKey, '1');
  }
  if (localStorage.getItem(workspaceOrderVersionKey) !== '1') {
    const recruitingCanvasIndex = canvases.findIndex((canvas) => canvas.id === 'hr-recruiting');
    if (recruitingCanvasIndex > 0) {
      const [recruitingCanvas] = canvases.splice(recruitingCanvasIndex, 1);
      canvases.unshift(recruitingCanvas);
    }
    localStorage.setItem(workspaceOrderVersionKey, '1');
  }
  const storedCurrent = localStorage.getItem(currentCanvasKey);
  currentCanvasId = canvases.some((canvas) => canvas.id === storedCurrent)
    ? storedCurrent
    : canvases.some((canvas) => canvas.id === defaultCanvasId) ? defaultCanvasId : canvases[0].id;
  saveCanvasRegistry();
}

function setWorkspacePopover(open) {
  workspacePopover.classList.toggle('open', open);
  workspacePopover.setAttribute('aria-hidden', String(!open));
  workspaceSwitcher.setAttribute('aria-expanded', String(open));
}

function workspaceNameHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function workspacePreviewMarkup(canvas) {
  const hidden = new Set(canvas.hiddenDynamicItems || []);
  const items = (canvas.dynamicItems || []).filter((item) => !hidden.has(item.id));
  const widgets = (canvas.widgetIds || []).map((id) => ({
    id,
    type: `widget-${id.replace('-widget', '')}`,
    ...(canvas.layout?.[id] || defaultWidgetPosition(canvas, id) || { x: 40, y: 520 }),
  }));
  // The 人才招聘 app lives in the window layer, not in dynamicItems, so the
  // thumbnail adds a stand-in block using the live window's position when available.
  const appEntry = (() => {
    if (canvas.id !== 'hr-recruiting') return null;
    const appWindow = findWorkspaceWindow('hr-recruiting-app', canvas.id);
    const x = appWindow ? (parseFloat(appWindow.style.getPropertyValue('--x')) || 560) : 560;
    const y = appWindow ? (parseFloat(appWindow.style.getPropertyValue('--y')) || 130) : 130;
    return { id: 'hr-recruiting-app', type: 'hr-app', x, y };
  })();
  const previewItems = [ ...(appEntry ? [appEntry] : []), ...items, ...widgets].slice(0, 10);
  if (!previewItems.length) return '<span class="workspace-thumbnail-empty"><i></i><i></i><i></i><em>空白工作台</em></span>';

  const typeKind = (type = '') => {
    if (type.startsWith('hr-') || type.startsWith('product-') || type.startsWith('widget-')) return type;
    if (['text', 'hero-text', 'section-label', 'image', 'file', 'document-preview', 'ai-card', 'zone'].includes(type)) return type;
    return 'generic';
  };
  const itemSize = (kind) => {
    const sizes = {
      'hr-goal':[25,19], 'hr-schedule':[25,25], 'hr-activity':[23,24], 'hr-insights':[23,27],
      'hr-app':[40,46],
      'product-goal':[22,18], 'product-progress':[49,52], 'product-risks':[22,25], 'product-activity':[22,24],
      'widget-task':[34,28], 'widget-schedule':[18,25], 'widget-stock':[19,25],
      text:[24,24], 'hero-text':[34,15], 'section-label':[22,9], image:[27,29], file:[22,14],
      'document-preview':[25,28], 'ai-card':[28,25], zone:[34,30], generic:[22,18],
    };
    return sizes[kind] || sizes.generic;
  };
  return `<span class="workspace-thumbnail-stage" aria-hidden="true">${previewItems.map((item) => {
    const kind = typeKind(item.type);
    const position = canvas.layout?.[item.id] || item;
    const [width, height] = itemSize(kind);
    const left = Math.max(2, Math.min(96 - width, ((Number(position.x) || 0) / desktopCanvasSize.width) * 100));
    const top = Math.max(3, Math.min(94 - height, ((Number(position.y) || 0) / desktopCanvasSize.height) * 100));
    const image = kind === 'image' && item.src
      ? `<img src="${workspaceNameHTML(item.src)}" alt="" />`
      : '<i></i><i></i><i></i>';
    return `<b class="workspace-thumb-item thumb-${kind}" style="--thumb-x:${left.toFixed(2)}%;--thumb-y:${top.toFixed(2)}%;--thumb-w:${width}%;--thumb-h:${height}%">${image}</b>`;
  }).join('')}</span>`;
}

function renderWorkspaceList() {
  const current = getCurrentCanvas();
  workspaceName.textContent = current?.name || '工作台';
  workspaceCount.textContent = `${canvases.length} 个工作台`;
  workspaceList.innerHTML = canvases.map((canvas) => {
    const safeName = workspaceNameHTML(canvas.name);
    return `
    <article class="workspace-card${canvas.id === currentCanvasId ? ' selected' : ''}" data-canvas-id="${canvas.id}" style="--space-accent:${canvas.accent}">
      <button class="workspace-delete" type="button" data-workspace-delete="${canvas.id}" aria-label="删除${safeName}" title="删除工作台"><span data-icon="close"></span></button>
      <button class="workspace-preview" type="button" data-workspace-select="${canvas.id}" aria-label="切换到${safeName}">
        ${workspacePreviewMarkup(canvas)}
      </button>
      <div class="workspace-card-footer"><span title="${safeName}">${safeName}</span><button type="button" data-workspace-rename="${canvas.id}" aria-label="重命名${safeName}" title="重命名工作台"><span data-icon="edit"></span></button></div>
    </article>`;
  }).join('');
  hydrateIcons(workspaceList);
}

function beginWorkspaceRename(id) {
  const canvas = canvases.find((item) => item.id === id);
  const card = workspaceList.querySelector(`[data-canvas-id="${id}"]`);
  const footer = card?.querySelector('.workspace-card-footer');
  if (!canvas || !footer) return;
  footer.classList.add('editing');
  footer.innerHTML = '<input type="text" maxlength="24" aria-label="工作台名称" />';
  const input = footer.querySelector('input');
  input.value = canvas.name;
  input.focus();
  input.select();

  let finished = false;
  const finish = (save) => {
    if (finished) return;
    finished = true;
    const nextName = input.value.trim().replace(/\s+/g, ' ').slice(0, 24);
    if (save && nextName) {
      canvas.name = nextName;
      saveCanvasRegistry();
      showToast(`工作台已重命名为“${nextName}”`);
    } else if (save && !nextName) {
      showToast('工作台名称不能为空');
    }
    renderWorkspaceList();
  };
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); finish(true); }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
}

function captureCurrentCanvasState() {
  const current = getCurrentCanvas();
  if (!current) return;
  current.layout = { ...current.layout, ...Object.fromEntries(canvasObjects.map((object) => [object.dataset.objectId, {
    x: parseFloat(object.style.getPropertyValue('--object-x')),
    y: parseFloat(object.style.getPropertyValue('--object-y')),
  }])) };
  current.view = { ...canvasView };
  current.dynamicItems = dynamicItems.map((item) => ({ ...item }));
  current.connections = connections.map((connection) => ({ ...connection }));
}

function applyCanvasView(animate = false) {
  if (desktopMode) canvasView = defaultCanvasView();
  canvasWorld.style.transition = animate ? 'transform 420ms var(--ease)' : 'none';
  canvasWorld.style.transform = `translate3d(${canvasView.x}px, ${canvasView.y}px, 0) scale(${canvasView.scale})`;
  // Canvas components inherit this scale from the world. Window-layer menus
  // consume the shared root value so both coordinate systems render alike.
  canvasWorld.style.setProperty('--canvas-scale', String(canvasView.scale || 1));
  document.documentElement.style.setProperty('--workspace-ui-scale', String(canvasView.scale || 1));
  if (zoomLabel) zoomLabel.textContent = `${Math.round(canvasView.scale * 100)}%`;
  if (animate) setTimeout(() => { canvasWorld.style.transition = 'none'; }, 450);
}

function saveLayout() {
  const current = getCurrentCanvas();
  if (!current) return;
  current.layout = { ...current.layout, ...Object.fromEntries(canvasObjects.map((object) => [object.dataset.objectId, {
    x: parseFloat(object.style.getPropertyValue('--object-x')),
    y: parseFloat(object.style.getPropertyValue('--object-y')),
  }])) };
  saveCanvasRegistry();
}

let dynamicItems = [];

function larkPinItemId(documentId) {
  return `pinned-lark-${documentId}`;
}

function isLarkDocumentPinned(documentId) {
  return dynamicItems.some((item) => item.id === larkPinItemId(documentId));
}

function updateDocumentPinButtons() {
  document.querySelectorAll('[data-document-pin]').forEach((button) => {
    const pinned = isLarkDocumentPinned(button.dataset.documentPin);
    button.classList.toggle('pinned', pinned);
    button.setAttribute('aria-label', pinned ? '从桌面取消固定' : '固定到桌面');
    button.setAttribute('title', pinned ? '从桌面取消固定' : '固定到桌面');
    button.innerHTML = icon(pinned ? 'pin-off' : 'pin');
  });
  document.querySelectorAll('[data-artifact-pin]').forEach((button) => {
    const pinned = isArtifactPinned(button.dataset.artifactPin);
    button.classList.toggle('pinned', pinned);
    button.setAttribute('aria-label', pinned ? '从桌面取消固定' : '固定到桌面');
    button.setAttribute('title', pinned ? '从桌面取消固定' : '固定到桌面');
    button.innerHTML = icon(pinned ? 'pin-off' : 'pin');
  });
  document.querySelectorAll('[data-canvas-pin]').forEach((button) => {
    const pinned = isArtifactPinned(button.dataset.canvasPin);
    button.classList.toggle('pinned', pinned);
    button.setAttribute('aria-label', pinned ? '从桌面取消固定' : '固定到桌面');
    button.setAttribute('title', pinned ? '从桌面取消固定' : '固定到桌面');
    button.innerHTML = icon(pinned ? 'pin-off' : 'pin');
  });
}

function isArtifactPinned(artifactId) {
  const current = getCurrentCanvas();
  return Boolean(current?.showBase && !current.hiddenObjects?.includes(artifactId));
}

function toggleArtifactPin(artifactId) {
  const current = getCurrentCanvas();
  const object = baseCanvasObjects.find((item) => item.dataset.objectId === artifactId);
  if (!current?.showBase || !object) return false;
  current.hiddenObjects ||= [];
  if (isArtifactPinned(artifactId)) {
    current.hiddenObjects = [...new Set([...current.hiddenObjects, artifactId])];
    canvasObjects = canvasObjects.filter((item) => item !== object);
    connections = connections.filter((connection) => connection.from !== artifactId && connection.to !== artifactId);
    object.classList.add('unpinning');
    setTimeout(() => {
      object.classList.remove('unpinning');
      object.classList.add('canvas-unpinned');
    }, 180);
    saveConnections();
    saveCanvasRegistry();
    renderConnections();
    updateDocumentPinButtons();
    showToast('产物已从桌面移除');
    return false;
  }
  current.hiddenObjects = current.hiddenObjects.filter((id) => id !== artifactId);
  const position = blankCanvasPosition(250, 218);
  object.style.setProperty('--object-x', `${position.x}px`);
  object.style.setProperty('--object-y', `${position.y}px`);
  object.classList.remove('canvas-unpinned');
  object.classList.add('entering');
  if (!canvasObjects.includes(object)) canvasObjects.push(object);
  current.layout[artifactId] = position;
  setTimeout(() => object.classList.remove('entering'), 360);
  saveCanvasRegistry();
  renderConnections();
  updateDocumentPinButtons();
  showToast('产物已固定到桌面');
  return true;
}

function closeWindowAfterPin(win) {
  win.classList.add('pinning-out');
  requestAnimationFrame(() => {
    win.classList.remove('open');
    setTimeout(() => win.classList.remove('pinning-out'), 260);
  });
}

function blankCanvasPosition(width, height) {
  const rect = desktopCanvas.getBoundingClientRect();
  const visible = {
    x: Math.max(0, -canvasView.x / canvasView.scale),
    y: Math.max(50, -canvasView.y / canvasView.scale),
    width: rect.width / canvasView.scale,
    height: rect.height / canvasView.scale,
  };
  const occupied = canvasObjects.map(objectWorldRect);
  const candidates = [];
  const gap = 28;
  for (let y = visible.y + 105; y < visible.y + visible.height - height - 80; y += height + gap) {
    for (let x = visible.x + 48; x < visible.x + visible.width - width - 48; x += width + gap) candidates.push({ x, y });
  }
  const free = candidates.find((candidate) => !occupied.some((item) => (
    candidate.x < item.x + item.width + gap && candidate.x + width + gap > item.x &&
    candidate.y < item.y + item.height + gap && candidate.y + height + gap > item.y
  )));
  return free || insertPosition(width, height);
}

function removeDynamicCanvasItem(itemId, message = '对象已从桌面移除') {
  const object = canvasObjects.find((entry) => entry.dataset.objectId === itemId);
  if (!object) return false;
  canvasObjects = canvasObjects.filter((entry) => entry !== object);
  dynamicItems = dynamicItems.filter((entry) => entry.id !== itemId);
  connections = connections.filter((connection) => connection.from !== itemId && connection.to !== itemId);
  if (!connections.some((connection) => connection.id === selectedConnectionId)) selectedConnectionId = null;
  delete defaultPositions[itemId];
  object.classList.add('leaving');
  setTimeout(() => object.remove(), 180);
  saveDynamicItems();
  saveConnections();
  saveLayout();
  renderConnections();
  renderDockWorkspaceComponents();
  updateDocumentPinButtons();
  showToast(message);
  return true;
}

function toggleLarkDocumentPin(documentId) {
  const itemId = larkPinItemId(documentId);
  if (isLarkDocumentPinned(documentId)) {
    removeDynamicCanvasItem(itemId, '文件已从桌面移除');
    return false;
  }
  const doc = larkDocuments.find((item) => item.id === documentId);
  if (!doc) return false;
  const position = blankCanvasPosition(250, 218);
  addDynamicCanvasItem({
    id: itemId, type: 'document-preview', source: 'lark', documentId: doc.id,
    name: doc.title, summary: doc.summary, meta: `${doc.type} · ${doc.space}`, ...position,
  });
  updateDocumentPinButtons();
  showToast('文件已固定到桌面');
  return true;
}

function saveDynamicItems() {
  try {
    const current = getCurrentCanvas();
    if (!current) return;
    current.dynamicItems = dynamicItems.map((item) => ({ ...item }));
    saveCanvasRegistry();
  } catch {
    showToast('图片较大，当前会话可用，但无法保存到本地');
  }
}

function insertPosition(width, height) {
  const rect = desktopCanvas.getBoundingClientRect();
  const slots = [[-240, -105], [135, -105], [-240, 155], [135, 165], [0, 315], [330, 120]];
  const slot = slots[dynamicItems.length % slots.length];
  const cycle = Math.floor(dynamicItems.length / slots.length) * 24;
  return {
    x: Math.max(20, (rect.width / 2 - canvasView.x) / canvasView.scale + slot[0] - width / 2 + cycle),
    y: Math.max(70, (rect.height / 2 - canvasView.y) / canvasView.scale + slot[1] - height / 2 + cycle),
  };
}

function objectWorldRect(object) {
  return {
    x: parseFloat(object.style.getPropertyValue('--object-x')) || 0,
    y: parseFloat(object.style.getPropertyValue('--object-y')) || 0,
    width: object.offsetWidth,
    height: object.offsetHeight,
  };
}

function rectCenter(rect) {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function edgeToward(rect, target) {
  const center = rectCenter(rect);
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  if (!dx && !dy) return center;
  const tx = dx ? (rect.width / 2 + 5) / Math.abs(dx) : Infinity;
  const ty = dy ? (rect.height / 2 + 5) / Math.abs(dy) : Infinity;
  const amount = Math.min(tx, ty);
  return { x: center.x + dx * amount, y: center.y + dy * amount };
}

function connectionCurve(start, end) {
  const horizontal = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
  if (horizontal) {
    const middle = (start.x + end.x) / 2;
    return `M ${start.x} ${start.y} C ${middle} ${start.y}, ${middle} ${end.y}, ${end.x} ${end.y}`;
  }
  const middle = (start.y + end.y) / 2;
  return `M ${start.x} ${start.y} C ${start.x} ${middle}, ${end.x} ${middle}, ${end.x} ${end.y}`;
}

function pathBetweenObjects(from, to) {
  const fromRect = objectWorldRect(from);
  const toRect = objectWorldRect(to);
  const fromCenter = rectCenter(fromRect);
  const toCenter = rectCenter(toRect);
  return connectionCurve(edgeToward(fromRect, toCenter), edgeToward(toRect, fromCenter));
}

function renderConnections() {
  let selectedGeometry = null;
  canvasConnectionList.innerHTML = connections.map((connection) => {
    const from = canvasObjects.find((object) => object.dataset.objectId === connection.from);
    const to = canvasObjects.find((object) => object.dataset.objectId === connection.to);
    if (!from || !to) return '';
    const path = pathBetweenObjects(from, to);
    if (connection.id === selectedConnectionId) {
      const fromRect = objectWorldRect(from);
      const toRect = objectWorldRect(to);
      const fromCenter = rectCenter(fromRect);
      const toCenter = rectCenter(toRect);
      const start = edgeToward(fromRect, toCenter);
      const end = edgeToward(toRect, fromCenter);
      selectedGeometry = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    }
    return `<g class="connection-group${connection.id === selectedConnectionId ? ' selected' : ''}" data-connection-id="${connection.id}"><path class="connection-hit" d="${path}"></path><path class="canvas-connection" d="${path}" marker-end="url(#connectionArrowhead)"></path></g>`;
  }).join('');
  connectionControls.innerHTML = selectedGeometry
    ? `<button class="connection-delete" type="button" data-delete-connection="${selectedConnectionId}" style="--connection-x:${selectedGeometry.x}px;--connection-y:${selectedGeometry.y}px" aria-label="删除连线" title="删除连线"><span data-icon="close"></span></button>`
    : '';
  hydrateIcons(connectionControls);
}

function selectConnection(id) {
  selectedConnectionId = id;
  if (id) selectObject(null);
  renderConnections();
}

function deleteConnection(id) {
  const before = connections.length;
  connections = connections.filter((connection) => connection.id !== id);
  if (connections.length === before) return;
  selectedConnectionId = null;
  saveConnections();
  renderConnections();
  showToast('连线已删除');
}

function saveConnections() {
  const current = getCurrentCanvas();
  if (!current) return;
  current.connections = connections.map((connection) => ({ ...connection }));
  saveCanvasRegistry();
}

canvasConnectionList.addEventListener('pointerdown', (event) => {
  const group = event.target.closest('[data-connection-id]');
  if (!group) return;
  event.preventDefault();
  event.stopPropagation();
  selectConnection(group.dataset.connectionId);
});

connectionControls.addEventListener('click', (event) => {
  const button = event.target.closest('[data-delete-connection]');
  if (button) deleteConnection(button.dataset.deleteConnection);
});
connectionControls.addEventListener('pointerdown', (event) => event.stopPropagation());

document.addEventListener('keydown', (event) => {
  if (!selectedConnectionId || !['Delete', 'Backspace'].includes(event.key)) return;
  if (event.target.closest('input,textarea,[contenteditable="true"]')) return;
  event.preventDefault();
  deleteConnection(selectedConnectionId);
});

function animateConnectionRefresh(duration = 460) {
  const start = performance.now();
  const refresh = (now) => {
    renderConnections();
    if (now - start < duration) requestAnimationFrame(refresh);
  };
  requestAnimationFrame(refresh);
}

function worldPointFromEvent(event) {
  const rect = desktopCanvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left - canvasView.x) / canvasView.scale,
    y: (event.clientY - rect.top - canvasView.y) / canvasView.scale,
  };
}

function beginConnection(source, event) {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  selectObject(source);
  source.classList.add('connection-source');
  source.dataset.justDragged = 'true';
  canvasWorld.classList.add('connecting');
  source.setPointerCapture(event.pointerId);
  let target = null;
  let moved = false;

  const updateDraft = (moveEvent) => {
    moved = moved || Math.hypot(moveEvent.clientX - event.clientX, moveEvent.clientY - event.clientY) > 4;
    const candidate = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest('.canvas-object');
    const nextTarget = candidate && candidate !== source && canvasObjects.includes(candidate) ? candidate : null;
    if (target !== nextTarget) {
      target?.classList.remove('connection-target');
      target = nextTarget;
      target?.classList.add('connection-target');
    }
    const sourceRect = objectWorldRect(source);
    const sourceCenter = rectCenter(sourceRect);
    if (target) {
      connectionDraft.setAttribute('d', pathBetweenObjects(source, target));
    } else {
      const pointer = worldPointFromEvent(moveEvent);
      connectionDraft.setAttribute('d', connectionCurve(edgeToward(sourceRect, pointer), pointer));
    }
  };

  const finish = () => {
    source.classList.remove('connection-source');
    target?.classList.remove('connection-target');
    canvasWorld.classList.remove('connecting');
    connectionDraft.setAttribute('d', '');
    if (target && moved) {
      const duplicate = connections.some((connection) => connection.from === source.dataset.objectId && connection.to === target.dataset.objectId);
      if (!duplicate) {
        const connection = { id: `connection-${Date.now()}`, from: source.dataset.objectId, to: target.dataset.objectId };
        connections.push(connection);
        selectedConnectionId = connection.id;
        saveConnections();
        renderConnections();
        showToast('元素已连接');
      }
    }
    connectionGesture = null;
    setTimeout(() => { source.dataset.justDragged = 'false'; }, 80);
    source.removeEventListener('pointermove', updateDraft);
    source.removeEventListener('pointerup', finish);
    source.removeEventListener('pointercancel', finish);
  };

  connectionGesture = { source };
  source.addEventListener('pointermove', updateDraft);
  source.addEventListener('pointerup', finish);
  source.addEventListener('pointercancel', finish);
}

function fileSizeLabel(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function hrGoalObjectMarkup() {
  return `<header data-drag-handle><span><i data-icon="spark"></i><strong>业务目标</strong><small>招聘</small></span><button class="hr-goal-update" type="button" data-hr-action="update-goal"><i data-icon="edit"></i>更新目标</button></header>
    <div class="hr-goal-body">
      <button class="hr-goal-summary" type="button" data-open="hr-recruiting-app" aria-label="打开人才招聘页面">
        <span class="hr-goal-copy"><small>核心目标</small><strong>6 位 Agent 工程师到岗</strong></span>
        <span class="hr-goal-keyfacts"><span><small>截止日期</small><strong>10 月 31 日</strong></span><span><small>当前结果</small><strong>0 / 6 已到岗</strong></span><i data-icon="arrow"></i></span>
      </button>
    </div>`;
}

function hrGoalCenterMarkup() {
  const active = hrDemoState !== 'insight';
  const replied = hrDemoState === 'reply';
  const scheduled = hrDemoState === 'scheduled';
  const stateLabel = scheduled ? '面试已排期' : replied ? '需要你决定' : 'Syntropic 正在推进';
  const stateCopy = scheduled ? '12 场系统设计面试已安排；目标仍需经过面试、Offer 与实际到岗验证。' : replied ? '6 位候选人与 4 位评委的共同时间已找到，发送邀请前需要你确认。' : active ? 'Syntropic 正在重评候选人、更新标准并协调共同时间。' : 'Syntropic 已识别面试产能偏航，并准备了恢复方案。';
  const steps = [
    ['发现','23 位候选人等待系统设计面试','complete'],
    ['判断','未来十天仅有 4 个核心评委时段','complete'],
    ['行动',scheduled ? '集中面试邀请已发送' : replied ? '共同时间已找到，等待发送邀请' : active ? '重评候选人与排期正在推进' : '恢复方案已准备', scheduled ? 'complete' : 'current'],
    ['验收',scheduled ? '等待面试、Offer 与实际到岗' : '以完成入职验收结果', scheduled ? 'current' : 'future'],
  ];
  const primaryAction = scheduled
      ? '<button class="hr-primary-button" type="button" data-open="hr-tasks">查看后续推进 <i data-icon="arrow"></i></button>'
    : replied
      ? '<button class="hr-primary-button approve" type="button" data-hr-action="confirm-interview">确认发送邀请 <i data-icon="arrow"></i></button>'
      : active
        ? '<button class="hr-primary-button" type="button" data-open="hr-tasks">查看运行任务 <i data-icon="arrow"></i></button>'
        : '<button class="hr-primary-button approve" type="button" data-hr-action="approve-plan"><i data-icon="spark"></i> 按建议恢复招聘节奏</button>';
  const resetAction = scheduled ? '<button class="hr-goal-reset" type="button" data-hr-action="reset-demo">重新演示</button>' : '';
  return `<main class="hr-goal-center">
    <header class="hr-goal-center-hero">
      <div><small>结果契约 · 招聘</small><h1>10 月 31 日前，<br />6 位 Agent 工程师到岗</h1><p>验收标准：6 位候选人完成入职，而不是完成若干招聘任务。</p></div>
      <aside class="${active ? 'recovering' : ''}"><i data-icon="${active ? 'clock' : 'bell'}"></i><small>目标状态</small><strong>${stateLabel}</strong><p>${stateCopy}</p></aside>
    </header>
    <section class="hr-result-contract"><article><small>结果</small><strong>6 位工程师完成入职</strong></article><article><small>期限</small><strong>10 月 31 日</strong></article><article><small>约束</small><strong>不突破现有薪资预算</strong></article><article><small>权限</small><strong>外部邀请前需确认</strong></article></section>
    <section class="hr-goal-causal-card"><span><i data-icon="spark"></i><span><small>Syntropic 主动洞察</small><strong>候选人供给充足，系统设计面试产能正在限制招聘结果</strong></span></span><button type="button" data-open="hr-insight">查看洞察 <i data-icon="arrow"></i></button></section>
    <section class="hr-goal-journey"><header><strong>结果推进链路</strong><small>Syntropic 持续判断下一步，而不是等待新的 Prompt</small></header><div>${steps.map(([label,copy,tone], index) => `<article class="${tone}"><span><i>${index + 1}</i>${label}</span><strong>${copy}</strong></article>`).join('')}</div></section>
    <section class="hr-goal-actions"><header><span><strong>Syntropic 组织的下一步</strong><small>${scheduled ? '排期完成后，继续跟踪面试、评价、Offer 与到岗风险' : '内部动作自动执行，对外邀请只需一次确认'}</small></span><em>${replied ? '需要你决定' : 'Syntropic 正在推进'}</em></header><div><article><i data-icon="user"></i><span><strong>${scheduled ? '跟踪候选人回复与面试评价' : '重评候选人并补充面试评委'}</strong><small>${scheduled ? '6 位候选人已收到邀请，首场面试后自动回收评价' : active ? '8 位候选人已重评，4 位评委时间已匹配' : 'Syntropic 将自动校准候选人与评价标准'}</small></span><b class="running">${scheduled ? '持续' : active ? '推进中' : '自动'}</b></article><article><i data-icon="calendar"></i><span><strong>${scheduled ? '面试后组织终面与 Offer 下一步' : '创建 Agent 集中面试日'}</strong><small>${scheduled ? '根据评价和候选人意愿更新 6 个 HC 的时间风险' : replied ? '6 位候选人与 4 位评委的共同时间已找到' : active ? '正在合并候选人与评委日历' : '集中释放面试产能，保护候选人有效窗口'}</small></span><b class="${active ? 'running' : ''}">${scheduled ? '待面试' : replied ? '待确认' : active ? '推进中' : '待授权'}</b></article></div></section>
    <footer class="hr-goal-center-footer">${resetAction}<button class="hr-secondary-button" type="button" data-open="hr-insight">查看判断依据</button>${primaryAction}</footer>
  </main>`;
}

function hrAgentStatusObjectMarkup() {
  const active = hrDemoState !== 'insight';
  const replied = hrDemoState === 'reply';
  const scheduled = hrDemoState === 'scheduled';
  return `<header data-drag-handle><span><i data-icon="spark"></i><strong>AI 运行状态</strong></span><em>组件</em></header>
    <button class="hr-agent-status-body" type="button" data-open="hr-insight">
      <span class="hr-agent-orbit"><i></i><b></b></span>
      <span><strong>${scheduled ? 'Syntropic 持续跟踪' : replied ? '需要你决定' : 'Syntropic 正在推进'}</strong><small>${scheduled ? '面试已排期 · 等待回复与评价' : replied ? '共同时间已找到 · 等待发送邀请' : active ? '重评候选人 · 更新标准 · 协调日历' : '已连接招聘进度、日程与文档'}</small></span>
      <em>${replied ? 'DECISION' : 'RUNNING'}</em>
    </button>`;
}

const hrDailyScheduleItems = [
  {
    id:'hiring-weekly', time:'10:00', end:'10:45', duration:'45 分钟', title:'人才招聘周会', meta:'招聘团队 · Syntropic 会议室', tone:'green',
    location:'Syntropic 会议室 · Northstar', organizer:'李兰', attendees:['李兰','陈建','周禾','HRBP'],
    description:'对齐三类在招岗位的结果进展，集中处理候选人窗口、评委产能和待确认决策，确保招聘动作继续服务于到岗目标。',
    agenda:['回顾 Agent 工程师、AI 产品负责人和增长负责人的漏斗变化','确认本周需要保护的候选人窗口','分配面试、评价与 Offer 决策的下一步'],
    note:'Syntropic 会在会前自动汇总招聘系统、面试评价与候选人沟通记录。'
  },
  {
    id:'candidate-decision', time:'15:00', end:'15:40', duration:'40 分钟', title:'候选人决策校准', meta:'用人经理与 HR · 线上会议', tone:'blue',
    location:'飞书会议 · 线上', organizer:'李兰', attendees:['李兰','产品负责人','增长负责人','HRBP'],
    description:'针对已进入决策窗口的候选人统一评价标准与预算边界，避免沈嘉、周临、顾言和程曦因内部等待而流失。',
    agenda:['合并 AI 产品负责人候选人的面试评价','确认增长负责人候选人的薪酬弹性','形成候选人决策卡与对外沟通顺序'],
    note:'涉及候选人邀请或薪酬承诺的动作仍需用户确认后执行。'
  },
];

function hrScheduleObjectMarkup() {
  const items = hrDailyScheduleItems;
  return `<header data-drag-handle><span><i data-icon="calendar"></i><strong>日程</strong></span><small>8 月 24 日 · ${items.length} 项</small></header>
    <div class="hr-schedule-body">
      <span class="hr-schedule-date"><small>周一</small><strong>24</strong><em>八月</em></span>
      <div>${items.map((item) => `<button type="button" data-open="hr-event-${item.id}"><i class="${item.tone}"></i><time>${item.time}</time><span><strong>${item.title}</strong><small>${item.duration} · ${item.meta}</small></span></button>`).join('')}</div>
    </div>`;
}

function openHRScheduleEvent(eventId) {
  const item = hrDailyScheduleItems.find((event) => event.id === eventId) || hrDailyScheduleItems[0];
  const attendeeMarkup = item.attendees.map((name) => `<span><i>${name.slice(0,1)}</i><strong>${name}</strong></span>`).join('');
  const agendaMarkup = item.agenda.map((agenda, index) => `<li><i>${index + 1}</i><span>${agenda}</span></li>`).join('');
  const body = `<main class="hr-event-detail">
    <header><time><small>周一</small><strong>24</strong><em>八月</em></time><span><small>${item.time}–${item.end} · ${item.duration}</small><h1>${item.title}</h1><p>${item.description}</p></span><em>今天</em></header>
    <section class="hr-event-facts"><article><i data-icon="clock"></i><span><small>时间</small><strong>8 月 24 日 ${item.time}–${item.end}</strong></span></article><article><i data-icon="calendar"></i><span><small>地点</small><strong>${item.location}</strong></span></article><article><i data-icon="user"></i><span><small>组织者</small><strong>${item.organizer}</strong></span></article></section>
    <div class="hr-event-grid"><section class="hr-event-agenda"><header><strong>会议议程</strong><small>${item.agenda.length} 项</small></header><ol>${agendaMarkup}</ol></section><section class="hr-event-people"><header><strong>参与人</strong><small>${item.attendees.length} 人</small></header><div>${attendeeMarkup}</div></section></div>
    <aside><i data-icon="spark"></i><span><strong>Syntropic 会前准备</strong><small>${item.note}</small></span></aside>
  </main>`;
  const win = shell(`hr-event-${item.id}`, item.title, 'calendar', body, 'hr-schedule-event-window', { w:'760px', h:'580px', x:'23vw', y:'7vh' });
  hydrateIcons(win);
}

function getHRRecruitingRoleDefinition(roleId = hrActiveRecruitingRole) {
  const active = hrDemoState !== 'insight';
  const replied = hrDemoState === 'reply';
  const scheduled = hrDemoState === 'scheduled';
  const roles = {
    agent: {
      name:'Agent 工程师', count:'23 位面试中', deadline:'10 月 31 日', title:'Agent 工程师 · 6 位到岗',
      status:scheduled ? '面试已排期' : replied ? '需要你决定' : 'Syntropic 正在推进', statusTone:'recovering',
      stages:active ? [['人才库','128'],['初筛','36'],['技术面','23'],['终面','7'],['Offer','2']] : [['人才库','128'],['初筛','32'],['技术面','23'],['终面','5'],['Offer','2']],
      stageWidths:[100,72,46,26,10], open:'hr-shortlist', insightOpen:'hr-insight',
      candidates:[
        { avatar:'林', tone:'green', name:'林然', detail:'前字节跳动 · 工具编排与运行时', state:scheduled ? '邀请已发送' : active ? '已重新激活' : '等待系统设计面试', stateTone:scheduled || active ? 'active' : '', open:'hr-candidate-linran' },
        { avatar:'赵', tone:'blue', name:'赵一帆', detail:'前 Anthropic · 评估与可观测性', state:scheduled ? '等待接受邀请' : '等待面试反馈', stateTone:scheduled ? 'active' : '', open:'hr-candidate-zhaoyifan' },
      ],
      insightTitle:scheduled ? '集中面试日已排期，招聘节奏正在恢复' : active ? '共同时间正在被组织成集中面试日' : '面试产能正在限制招聘结果',
      insightSummary:scheduled ? '12 场面试已安排 · 6 位候选人收到邀请 · Syntropic 持续跟踪' : active ? '8 位候选人已重评，4 位评委时间正在匹配' : '23 位候选人等待，未来十天仅 4 个评委时段',
    },
    product: {
      name:'AI 产品负责人', count:'5 位进行中', deadline:'9 月 30 日', title:'AI 产品负责人 · 1 位到岗',
      status:'决策待对齐', statusTone:'recovering', stages:[['人才库','64'],['初筛','18'],['面试','5'],['终面','2'],['Offer','0']], stageWidths:[100,64,36,18,4],
      candidates:[
        { avatar:'沈', tone:'green', name:'沈嘉', detail:'Agent 产品策略与体验 · 关键评价已齐', state:'终面待决策', stateTone:'active', open:'hr-candidate-shenjia' },
        { avatar:'周', tone:'blue', name:'周临', detail:'开发者平台与商业化 · 匹配度 89%', state:'评价分歧', stateTone:'', open:'hr-candidate-zhoulin' },
      ],
      insightTitle:'不是候选人不足，是决策标准没有对齐', insightSummary:'5 位面试官使用 3 套评价重点，2 位终面候选人已等待 4 天', insightRole:'product',
    },
    growth: {
      name:'增长负责人', count:'3 位进行中', deadline:'10 月 15 日', title:'增长负责人 · 1 位到岗',
      status:'薪酬待决策', statusTone:'recovering', stages:[['人才库','47'],['初筛','12'],['面试','3'],['终面','1'],['Offer','0']], stageWidths:[100,58,30,12,4],
      candidates:[
        { avatar:'顾', tone:'green', name:'顾言', detail:'PLG 与开发者增长 · Offer 条件已齐', state:'薪酬待确认', stateTone:'active', open:'hr-candidate-guyan' },
        { avatar:'程', tone:'blue', name:'程曦', detail:'企业增长与商业化 · 匹配度 88%', state:'保持沟通', stateTone:'', open:'hr-candidate-chengxi' },
      ],
      insightTitle:'高匹配候选人正在被薪酬带推向流失窗口', insightSummary:'2 位候选人期望超出预算，Syntropic 已准备市场对标与决策方案', insightRole:'growth',
    },
  };
  return roles[roleId] || roles.agent;
}

function hrRecruitingAppMarkup() {
  const role = getHRRecruitingRoleDefinition();
  const scheduled = hrDemoState === 'scheduled';
  const replied = hrDemoState === 'reply';
  const roleNav = ['agent','product','growth'].map((roleId) => {
    const item = getHRRecruitingRoleDefinition(roleId);
    return `<button class="${roleId === hrActiveRecruitingRole ? 'selected' : ''}" type="button" data-hr-role="${roleId}"><i></i><span><strong>${item.name}</strong><small>${item.count}</small></span></button>`;
  }).join('');
  const openAttribute = role.open ? `data-open="${role.open}"` : `data-hr-role-insight="${role.insightRole}"`;
  const sourceStatus = hrRecruitingReality.sources.map((source) => `<span><i data-icon="${source.icon}"></i><span><strong>${source.name}</strong><small>${source.updated}</small></span></span>`).join('');
  const agentDataByStage = {
    pool: [
      { avatar:'许', name:'许宁', detail:'多 Agent 可靠性', state:'新增高匹配信号', next:'今天建议联系', source:'招聘系统 · 12 分钟前', open:'hr-candidate-xuning' },
      { avatar:'苏', name:'苏悦', detail:'Agent 故障恢复', state:'进入机会清单', next:'窗口剩余 4 天', source:'飞书招聘 · 18 分钟前', open:'hr-candidate-suyue' },
      { avatar:'周', name:'周衡', detail:'工具执行与权限系统', state:'待 HR 初筛', next:'今天 17:30', source:'内推系统 · 24 分钟前', open:'hr-shortlist' },
    ],
    screen: [
      { avatar:'林', name:'林然', detail:'工具编排与运行时', state:'建议恢复流程', next:'已等待 6 天', source:'飞书招聘 · 刚刚', open:'hr-candidate-linran' },
      { avatar:'许', name:'许宁', detail:'多 Agent 可靠性', state:'重新评估中', next:'今天完成校准', source:'招聘系统 · 12 分钟前', open:'hr-candidate-xuning' },
      { avatar:'苏', name:'苏悦', detail:'Agent 故障恢复', state:'通过新标准', next:'等待 HR 确认', source:'飞书招聘 · 18 分钟前', open:'hr-candidate-suyue' },
    ],
    interview: scheduled ? [
      { avatar:'林', name:'林然', detail:'工具编排与运行时', state:'邀请已发送', next:'8 月 27 日 15:00', source:'飞书招聘 · 刚刚', open:'hr-candidate-linran' },
      { avatar:'赵', name:'赵一帆', detail:'评估与可观测性', state:'等待接受邀请', next:'8 月 27 日 16:00', source:'飞书招聘 · 2 分钟前', open:'hr-candidate-zhaoyifan' },
      { avatar:'许', name:'许宁', detail:'多 Agent 可靠性', state:'面试已确认', next:'8 月 28 日 10:00', source:'飞书招聘 · 5 分钟前', open:'hr-candidate-xuning' },
    ] : [
      { avatar:'林', name:'林然', detail:'工具编排与运行时', state:replied ? '可用时间已回复' : '等待系统设计面试', next:replied ? '周四或周五' : '已等待 6 天', source:'飞书招聘 · 刚刚', open:'hr-candidate-linran' },
      { avatar:'赵', name:'赵一帆', detail:'评估与可观测性', state:'等待面试反馈', next:'今天 16:10 更新', source:'飞书招聘 · 4 分钟前', open:'hr-candidate-zhaoyifan' },
      { avatar:'许', name:'许宁', detail:'多 Agent 可靠性', state:'建议重新评估', next:'窗口剩余 3 天', source:'招聘系统 · 12 分钟前', open:'hr-candidate-xuning' },
    ],
    final: [
      { avatar:'赵', name:'赵一帆', detail:'评估与可观测性', state:'评价待齐', next:'缺 1 份评委反馈', source:'面试评价表 · 4 分钟前', open:'hr-candidate-zhaoyifan' },
      { avatar:'唐', name:'唐瑾', detail:'Agent 平台架构', state:'终面已排期', next:'8 月 26 日 14:00', source:'团队日历 · 7 分钟前', open:'hr-shortlist' },
      { avatar:'陈', name:'陈知', detail:'运行时与可观测性', state:'等待用人决策', next:'已等待 2 天', source:'飞书招聘 · 11 分钟前', open:'hr-shortlist' },
    ],
    offer: [
      { avatar:'高', name:'高越', detail:'Agent 基础设施', state:'Offer 沟通中', next:'今天 18:00 跟进', source:'飞书招聘 · 8 分钟前', open:'hr-shortlist' },
      { avatar:'方', name:'方舟', detail:'评估平台与数据系统', state:'背调已完成', next:'等待薪酬确认', source:'招聘系统 · 16 分钟前', open:'hr-shortlist' },
    ],
  };
  const agentRows = agentDataByStage[hrActiveRecruitingStage] || agentDataByStage.interview;
  const dataRows = hrActiveRecruitingRole === 'agent' ? agentRows : role.candidates.map((candidate, index) => ({ avatar:candidate.avatar, name:candidate.name, detail:candidate.detail, state:candidate.state, next:index ? '本周内跟进' : '今天需要处理', source:'招聘系统 · 刚刚', open:candidate.open, roleInsight:role.insightRole }));
  return `<div class="hr-recruiting-app">
      <aside class="hr-role-sidebar"><header><span data-icon="user"></span><strong>人才招聘</strong></header><span>在招岗位</span>${roleNav}<footer class="hr-role-sources"><header><i></i><strong>已连接的数据</strong></header><div>${sourceStatus}</div></footer></aside>
      <main class="hr-app-main">
        <header class="hr-app-outcome-header"><span><small>结果目标 · ${role.deadline}</small><h2>${role.title}</h2><p>${hrActiveRecruitingRole === 'agent' ? '验收：完成入职 · 约束：不突破现有薪资预算' : '持续维护候选人、决策与到岗结果'}</p></span><span class="hr-app-goal-status ${role.statusTone}"><i></i>${role.status}</span></header>
        <section class="hr-app-pipeline"><header><span><strong>招聘管道</strong><small>点击阶段查看对应数据</small></span><button type="button" ${openAttribute}>查看全部</button></header><div>${role.stages.map(([label,value], index) => { const stageId = ['pool','screen','interview','final','offer'][index]; return `<button class="${stageId === hrActiveRecruitingStage ? 'selected' : ''}" type="button" data-hr-stage="${stageId}"><small>${label}</small><strong>${value}</strong>${index < role.stages.length - 1 ? '<i data-icon="arrow"></i>' : ''}</button>`; }).join('')}</div></section>
        <section class="hr-recruiting-data"><header><span><strong>${hrActiveRecruitingStage === 'interview' ? '候选人' : '阶段数据'}</strong><small>${dataRows.length} 条重点记录 · 来自已连接系统</small></span><button type="button" ${openAttribute}>查看全部</button></header><div class="hr-recruiting-data-head"><span>候选人</span><span>当前状态</span><span>下一节点</span><span>数据来源</span></div><div>${dataRows.map((row) => `<button type="button" ${row.open ? `data-open="${row.open}"` : `data-hr-role-insight="${row.roleInsight}"`}><span class="hr-data-person"><i>${row.avatar}</i><span><strong>${row.name}</strong><small>${row.detail}</small></span></span><em>${row.state}</em><time>${row.next}</time><small>${row.source}</small><i data-icon="arrow"></i></button>`).join('')}</div></section>
      </main>
    </div>`;
}

function hrRoleInsightMarkup(roleId) {
  const product = roleId === 'product';
  const insightId = product ? 'product-decision' : 'growth-compensation';
  const insight = getHRInsightDefinitions().find((item) => item.id === insightId);
  const taskCreated = hrCreatedTaskIds.has(insight.task);
  return `<article class="hr-role-insight-page ${roleId}">
    <header><span class="hr-browser-kicker"><i></i>Syntropic 主动洞察 · 刚刚</span><small>判断可追溯</small></header>
    <h1>${product ? '不是候选人不足，<br />是决策标准没有对齐' : '不是候选人意愿下降，<br />是薪酬带正在造成流失'}</h1>
    <p>${product ? 'Syntropic 关联面试评价与决策节奏后发现：5 位面试官正在使用 3 套不同的评价重点，导致 2 位高匹配终面候选人持续等待。' : 'Syntropic 关联候选人沟通、市场薪酬与预算后发现：3 位高匹配候选人中有 2 位超出当前薪酬带，Offer 前的等待正在放大流失风险。'}</p>
    <section class="hr-role-insight-metrics">${product ? '<article><strong>5</strong><span>位面试官</span></article><article><strong>3</strong><span>套评价重点</span></article><article><strong>2</strong><span>位终面候选人</span></article>' : '<article><strong>3</strong><span>位高匹配候选人</span></article><article><strong>2</strong><span>位超出薪酬带</span></article><article><strong>1</strong><span>项预算决策</span></article>'}</section>
    <section class="hr-role-insight-causal"><span>${product ? '候选人已就绪' : '候选人意愿正常'}</span><i data-icon="arrow"></i><span>${product ? '评价口径分散' : '薪酬带不匹配'}</span><i data-icon="arrow"></i><strong>${product ? '招聘决策停滞' : 'Offer 流失风险'}</strong></section>
    <section class="hr-role-insight-action"><i data-icon="spark"></i><span><small>Syntropic 建议的下一步</small><strong>${product ? '合并面试反馈，生成统一决策卡，并预约 30 分钟校准会' : '生成市场薪酬对标与两套预算方案，发起用人决策'}</strong><em>${product ? '这会解除决策阻塞，而不是继续扩大候选人池。' : '先解决决策条件，再继续推进候选人沟通。'}</em></span><button type="button" data-hr-action="${taskCreated ? 'open-insight-task' : 'create-insight-task'}" data-task-id="${insight.task}">${taskCreated ? '查看任务' : '创建任务'} <i data-icon="arrow"></i></button></section>
    <footer>依据：飞书招聘 · 面试评价表 · 候选人沟通 · 已授权招聘数据</footer>
  </article>`;
}

function openHRRoleInsight(roleId) {
  const title = roleId === 'product' ? 'AI 产品负责人洞察' : '增长负责人洞察';
  const win = shell(`hr-role-insight-${roleId}`, title, 'spark', hrRoleInsightMarkup(roleId), 'hr-window hr-role-insight-window', { w:'900px', h:'620px', x:'18vw', y:'6vh' });
  win.setAttribute('aria-label', title);
  win.querySelector('.window-body').innerHTML = hrRoleInsightMarkup(roleId);
  hydrateIcons(win);
}

function renderHRRecruitingApp(win) {
  if (!win) return;
  win.querySelector('.window-body').innerHTML = hrRecruitingAppMarkup();
  win.querySelector('.hr-recruiting-app')?.classList.toggle('sidebar-hidden', win.dataset.hrRecruitingSidebar === 'hidden');
  hydrateIcons(win);
}

function ensureHRRecruitingChrome(win) {
  win.querySelector('[data-hr-recruiting-toggle-sidebar]')?.remove();
  hydrateIcons(win.querySelector('.window-bar'));
}

function hrPipelineObjectMarkup() {
  return hrRecruitingAppMarkup();
}

function openHRRecruitingApp() {
  const scale = canvasView.scale || hrCanvasView().scale;
  const visibleRect = (id) => {
    const object = canvasObjects.find((entry) => entry.dataset.objectId === id);
    return object && !object.classList.contains('canvas-unpinned') ? object.getBoundingClientRect() : null;
  };
  const leftRects = ['hr-goal', 'hr-schedule'].map(visibleRect).filter(Boolean);
  const rightRects = ['hr-activity', 'hr-insights'].map(visibleRect).filter(Boolean);
  const fallbackLeft = canvasView.x + (40 + 250) * scale;
  const fallbackRight = canvasView.x + 1180 * scale;
  const leftSafeEdge = (leftRects.length ? Math.max(...leftRects.map((rect) => rect.right)) : fallbackLeft) + 22;
  const rightSafeEdge = (rightRects.length ? Math.min(...rightRects.map((rect) => rect.left)) : fallbackRight) - 22;
  const availableWidth = Math.max(320, rightSafeEdge - leftSafeEdge);
  const width = Math.min(640, availableWidth);
  const x = Math.max(18, leftSafeEdge + Math.max(0, availableWidth - width) / 2);
  const y = Math.max(54, Math.min(88, innerHeight * .105) + canvasView.y);
  const height = Math.max(390, Math.min(490, innerHeight - 184 - y));
  const win = shell('hr-recruiting-app', '人才招聘', 'user', hrRecruitingAppMarkup(), 'hr-recruiting-window', {
    w:`${width}px`,
    h:`${height}px`,
    x:`${x}px`,
    y:`${y}px`,
  }, { headerControls: true });
  win.style.setProperty('--x', `${x}px`);
  win.style.setProperty('--y', `${y}px`);
  win.style.setProperty('--w', `${width}px`);
  win.style.setProperty('--h', `${height}px`);
  win.classList.toggle('compact-layout', width < 620);
  if (width < 540 && !win.dataset.hrRecruitingSidebar) win.dataset.hrRecruitingSidebar = 'hidden';
  win.setAttribute('aria-label', '人才招聘');
  ensureHRRecruitingChrome(win);
  renderHRRecruitingApp(win);
  if (win.dataset.hrRecruitingBound) return;
  win.dataset.hrRecruitingBound = 'true';
  win.addEventListener('click', (event) => {
    const stageButton = event.target.closest('[data-hr-stage]');
    if (stageButton) {
      hrActiveRecruitingStage = stageButton.dataset.hrStage;
      renderHRRecruitingApp(win);
      showToast(`已按${stageButton.querySelector('small')?.textContent || '招聘阶段'}筛选`);
      return;
    }
    const roleButton = event.target.closest('[data-hr-role]');
    if (roleButton) {
      hrActiveRecruitingRole = roleButton.dataset.hrRole;
      renderHRRecruitingApp(win);
      return;
    }
    const roleInsight = event.target.closest('[data-hr-role-insight]');
    if (roleInsight) openHRRoleInsight(roleInsight.dataset.hrRoleInsight);
  });
}

function hrInsightCardMarkup() {
  const active = hrDemoState !== 'insight';
  const replied = hrDemoState === 'reply' || hrDemoState === 'scheduled';
  const scheduled = hrDemoState === 'scheduled';
  return `<header data-drag-handle><span><i data-icon="spark"></i><strong>Syntropic 刚刚发现</strong></span><span class="hr-generated-meta"><em>3 个数据源</em><time>${replied ? '刚刚' : '2 分钟前'}</time></span></header>
    <button class="hr-insight-body ${active ? 'active' : ''}" type="button" data-open="${hrDemoState === 'reply' ? 'hr-candidate-linran' : 'hr-insight'}">
      <span class="hr-insight-label">${scheduled ? 'PROGRESS UPDATE' : replied ? 'CANDIDATE REPLY' : active ? 'PLAN IN MOTION' : 'OUTCOME RISK'}</span>
      <h2>${scheduled ? '集中面试日已排期' : replied ? '共同时间已找到，等待你的确认' : active ? 'Syntropic 正在恢复招聘节奏' : '不是候选人不够，<br />是面试产能不够'}</h2>
      <p>${scheduled ? '12 场面试安排在 8 月 27–28 日，Syntropic 正在跟踪回复与面试结果。' : replied ? '已匹配 6 位候选人与 4 位评委的共同时间，发送邀请前需要你确认。' : active ? '8 位候选人已重评，JD 与评价标准已更新。' : '23 位候选人正在等待系统设计面试，未来十天仅有 4 个核心评委时段。'}</p>
      <span class="hr-insight-link">${scheduled ? '查看后续推进' : replied ? '确认发送邀请' : active ? '查看推进状态' : '查看洞察与推进计划'} <i data-icon="arrow"></i></span>
    </button>`;
}

function hrActivityObjectMarkup() {
  const runningRows = Object.entries(getHRTaskDefinitions())
    .filter(([id, task]) => hrCreatedTaskIds.has(id) && task.tone === 'running')
    .sort(([idA, a], [idB, b]) => hrTaskSortTime(idB, b) - hrTaskSortTime(idA, a));
  const rows = runningRows.slice(0, 3);
  return `<header data-drag-handle><span><i class="hr-solo-pulse"></i><strong>当前任务</strong><small>${runningRows.length} 个进行中</small></span><button type="button" data-open="hr-tasks">查看全部</button></header>
    <div class="hr-activity-list">${rows.map(([id, task]) => `<button type="button" data-open="${id}"><span><strong>${task.title}</strong><small>${task.state}</small></span><span class="hr-task-spinner" role="status" aria-label="正在运行"><i></i></span></button>`).join('')}</div>`;
}

function hrInsightsObjectMarkup() {
  const insights = getHRInsightDefinitions().slice(0, 3);
  return `<header data-drag-handle><span><i class="hr-insight-pulse" role="status" aria-label="正在洞察"></i><strong>AI 洞察</strong><small>${insights.length} 条最新发现</small></span><button type="button" data-open="hr-preview">查看全部</button></header>
    <div class="hr-insights-list">
      ${insights.map((item, index) => `<button class="insight-item ${item.tone} ${index === 0 ? 'latest' : ''}" type="button" data-open="hr-insight-${item.id}">
        <i data-icon="${item.id === 'signals' ? 'user' : item.id === 'window' ? 'clock' : 'spark'}"></i>
        <span class="insight-item-copy"><span><em>${item.label}</em><time>${item.time}</time></span><strong>${item.title}</strong><small>${item.summary}</small></span>
        <i data-icon="arrow"></i>
      </button>`).join('')}
    </div>`;
}

function hrFilesObjectMarkup() {
  const scheduled = hrDemoState === 'scheduled';
  return `<header data-drag-handle><span><i data-icon="folder"></i><strong>最近文件</strong></span><small>文件预览 · 应用</small></header><div class="hr-files-list"><button type="button" data-open="hr-jd"><i class="doc"><span data-icon="doc"></span></i><span><strong>Agent 工程师 · JD v3</strong><small>${hrDemoState === 'insight' ? '1 项修改待确认' : '刚刚更新'}</small></span><span data-icon="arrow"></span></button><button type="button" data-open="hr-shortlist"><i class="people"><span data-icon="user"></span></i><span><strong>候选人 Shortlist</strong><small>${hrDemoState === 'insight' ? '8 位重新评估' : '4 位已加速'}</small></span><span data-icon="arrow"></span></button><button type="button" data-open="hr-brief"><i class="brief"><span data-icon="file"></span></i><span><strong>林然 · 面试官 Brief</strong><small>${scheduled ? '刚刚生成' : '等待面试确认'}</small></span><span data-icon="arrow"></span></button></div>`;
}

function hrArtifactObjectMarkup(item) {
  const config = {
    jd: { open: 'hr-jd', kicker: 'ROLE / AGENT ENGINEERING', title: 'Agent 工程师<br />JD v3', className: 'jd', name: '职位描述 · JD v3', meta: hrDemoState === 'insight' ? '1 项修改待确认' : '刚刚发布' },
    shortlist: { open: 'hr-shortlist', kicker: 'TALENT INTELLIGENCE', title: 'Candidate<br />Shortlist', className: 'shortlist', name: '生产级 Agent 候选人', meta: hrDemoState === 'insight' ? '8 位重新评估' : '4 位已加速' },
    brief: { open: 'hr-brief', kicker: 'INTERVIEW KIT', title: '面试官<br />Brief', className: 'brief', name: '林然 · 面试重点', meta: hrDemoState === 'scheduled' ? '刚刚生成' : '等待面试确认' },
  }[item.artifact];
  return `<button class="hr-artifact-open" type="button" data-open="${config.open}"><span class="hr-artifact-preview ${config.className}"><i>${config.kicker}</i><strong>${config.title}</strong><span class="hr-artifact-lines"><b></b><b></b><b></b></span></span><span class="hr-artifact-name"><strong>${config.name}</strong><small>${config.meta}</small></span></button>`;
}

const productRequirements = [
  { id:'copilot', code:'PRD-241', title:'AI Copilot 多轮任务', owner:'陈诺', initials:'CN', stage:'开发中', progress:72, tone:'active', due:'8 月 28 日', risk:true, detail:'工具调用的失败恢复尚未通过稳定性验证。' },
  { id:'permissions', code:'PRD-236', title:'团队级权限与审计日志', owner:'杨帆', initials:'YF', stage:'联调中', progress:86, tone:'active', due:'8 月 25 日', risk:false, detail:'后端接口已完成，正在联调管理员操作记录。' },
  { id:'templates', code:'PRD-228', title:'工作流模板市场', owner:'周琳', initials:'ZL', stage:'测试中', progress:93, tone:'test', due:'8 月 23 日', risk:false, detail:'功能验收完成，剩余 4 个兼容性问题。' },
  { id:'billing', code:'PRD-247', title:'用量计费与套餐升级', owner:'赵禾', initials:'ZH', stage:'需求确认', progress:38, tone:'risk', due:'8 月 30 日', risk:true, detail:'超额计费规则等待商业化团队确认，已影响开发排期。' },
  { id:'mobile', code:'PRD-239', title:'移动端任务进度视图', owner:'林婧', initials:'LW', stage:'开发中', progress:64, tone:'active', due:'9 月 2 日', risk:false, detail:'iOS 主流程已打通，Android 正在补齐状态同步。' },
  { id:'analytics', code:'PRD-231', title:'发布效果数据面板', owner:'孙泊', initials:'SB', stage:'已完成', progress:100, tone:'done', due:'8 月 20 日', risk:false, detail:'核心指标、埋点口径与管理层视图均已验收。' },
];
let productRequirementFilter = 'all';

function productGoalMarkup() {
  return `<header data-drag-handle><span><i data-icon="spark"></i><strong>Q3 发布目标</strong></span><button type="button" data-product-action="edit-goal"><i data-icon="edit"></i>更新</button></header>
    <div class="product-goal-body">
      <small>结果契约 · Q3 LAUNCH</small><h2>9 月 26 日按计划发布</h2>
      <div class="product-goal-progress"><span><i style="width:62%"></i></span><b>62%</b></div>
      <footer><span><small>核心需求</small><strong>12 项</strong></span><span><small>已验收</small><strong>4 项</strong></span><span class="risk"><small>阻塞</small><strong>1 项</strong></span></footer>
    </div>`;
}

function productProgressMarkup() {
  const visible = productRequirements.filter((item) => productRequirementFilter === 'all' || (productRequirementFilter === 'risk' ? item.risk : item.progress < 100 && item.progress >= 60));
  const stages = [['需求定稿','12 / 12',100],['开发完成','7 / 12',62],['测试验收','4 / 12',34],['发布就绪','2 / 12',18]];
  return `<header class="product-progress-head" data-drag-handle><span><small>发布计划 · Q3</small><h2>Product 3.0 发布进度</h2></span><em><i></i>存在 1 项阻塞</em></header>
    <section class="product-stage-strip">${stages.map(([label,value,progress], index) => `<article class="${index === 1 ? 'current' : ''}"><small>${label}</small><strong>${value}</strong><span><i style="width:${progress}%"></i></span></article>`).join('')}</section>
    <section class="product-requirements">
      <header><span><strong>产品需求</strong><small>优先展示影响 Q3 发布的核心项</small></span><nav>${[['all','全部 12'],['risk','风险 3'],['week','本周 5']].map(([id,label]) => `<button class="${productRequirementFilter === id ? 'selected' : ''}" type="button" data-product-filter="${id}">${label}</button>`).join('')}</nav></header>
      <div class="product-requirement-head"><span>需求</span><span>责任人</span><span>开发进度</span><span>计划完成</span></div>
      <div class="product-requirement-list">${visible.map((item) => `<button type="button" data-open="product-requirement-${item.id}" data-product-risk="${item.risk}"><span class="product-req-title"><i class="${item.tone}">${item.code}</i><span><strong>${item.title}</strong><small>${item.detail}</small></span></span><span class="product-owner"><i>${item.initials}</i>${item.owner}</span><span class="product-progress-cell"><span><i style="width:${item.progress}%"></i></span><b>${item.progress}%</b><em class="${item.tone}">${item.stage}</em></span><time>${item.due}</time><i data-icon="arrow"></i></button>`).join('')}</div>
    </section>
    <footer class="product-progress-footer"><span><i data-icon="database"></i><span><strong>进度已联动更新</strong><small>Linear · GitHub · Figma · 飞书文档</small></span></span><time>刚刚同步</time></footer>`;
}

function productRisksMarkup() {
  return `<header data-drag-handle><span><i class="product-risk-pulse"></i><strong>风险与决策</strong><small>3 项需关注</small></span><button type="button" data-product-filter="risk">全部</button></header><div>
    <button type="button" data-open="product-requirement-billing"><em>阻塞 · 8 分钟前</em><strong>计费规则未定，已挤压 5 天开发时间</strong><small>需商业化负责人在今天 18:00 前确认</small></button>
    <button type="button" data-open="product-requirement-copilot"><em>风险 · 21 分钟前</em><strong>Copilot 失败恢复尚未达到发布门槛</strong><small>3 组长任务压测中有 2 组出现状态丢失</small></button>
    <button type="button" data-open="product-requirement-templates"><em class="decision">决策 · 今天</em><strong>模板市场首发范围等待确认</strong><small>建议保留 24 个高质量模板，延后开放投稿</small></button>
  </div>`;
}

function productActivityMarkup() {
  return `<header data-drag-handle><span><i data-icon="clock"></i><strong>Syntropic 正在推进</strong><small>4 个动作</small></span><button type="button" data-product-action="summary">汇总</button></header><div>
    <button type="button" data-open="product-requirement-copilot"><i class="running"></i><span><strong>跟进 Copilot 稳定性验证</strong><small>正在联动 GitHub CI 与压测报告</small></span><em>进行中</em></button>
    <button type="button" data-open="product-requirement-billing"><i class="review"></i><span><strong>准备计费决策卡</strong><small>已生成 2 套范围与排期方案</small></span><em>待决策</em></button>
    <button type="button" data-open="product-requirement-permissions"><i class="running"></i><span><strong>监控权限联调结果</strong><small>12 / 14 条核心用例已通过</small></span><em>进行中</em></button>
    <button type="button" data-open="product-requirement-analytics"><i class="done"></i><span><strong>验证发布数据口径</strong><small>核心指标与埋点方案已通过</small></span><em>已完成</em></button>
  </div><footer><i data-icon="spark"></i><span><strong>下一检查点：今天 18:00</strong><small>若阻塞未解除，Syntropic 将更新 Q3 发布风险</small></span></footer>`;
}

function renderProductCanvasObject(object, item) {
  if (item.type === 'product-goal') object.innerHTML = productGoalMarkup();
  if (item.type === 'product-progress') object.innerHTML = productProgressMarkup();
  if (item.type === 'product-risks') object.innerHTML = productRisksMarkup();
  if (item.type === 'product-activity') object.innerHTML = productActivityMarkup();
  hydrateIcons(object);
}

function refreshProductProgress() {
  if (currentCanvasId !== 'product-release') return;
  const item = dynamicItems.find((entry) => entry.type === 'product-progress');
  const object = canvasObjects.find((entry) => entry.dataset.objectId === item?.id);
  if (item && object) {
    renderProductCanvasObject(object, item);
    attachMinimizeControl(object);
  }
}

function openProductRequirement(id) {
  const requirement = productRequirements.find((item) => item.id === id) || productRequirements[0];
  const riskCopy = requirement.risk ? '<em class="risk">影响 Q3 发布</em>' : '<em>进度正常</em>';
  const body = `<article class="product-requirement-detail"><header><span><small>${requirement.code} · PRODUCT 3.0</small><h2>${requirement.title}</h2><p>${requirement.detail}</p></span>${riskCopy}</header><section class="product-detail-metrics"><article><small>开发进度</small><strong>${requirement.progress}%</strong></article><article><small>当前阶段</small><strong>${requirement.stage}</strong></article><article><small>计划完成</small><strong>${requirement.due}</strong></article><article><small>责任人</small><strong>${requirement.owner}</strong></article></section><section class="product-detail-progress"><header><strong>交付链路</strong><small>持续同步</small></header><div><span class="done"><i></i><strong>需求评审</strong><small>验收标准已对齐</small></span><span class="done"><i></i><strong>技术方案</strong><small>依赖与接口已确认</small></span><span class="current"><i></i><strong>${requirement.stage}</strong><small>${requirement.detail}</small></span><span><i></i><strong>发布验收</strong><small>功能、性能与回滚演练</small></span></div></section><section class="product-detail-sources"><i data-icon="database"></i><span><strong>信息来源</strong><small>Linear 需求 · GitHub PR · Figma 设计稿 · 飞书讨论</small></span></section><footer><button type="button" data-window-action="close-view">返回工作台</button><button class="primary" type="button" data-product-action="follow-up" data-product-name="${requirement.title}">${requirement.risk ? '推动解除阻塞' : '查看最新进展'} <i data-icon="arrow"></i></button></footer></article>`;
  const win = shell(`product-requirement-${requirement.id}`, requirement.title, 'file', body, 'product-requirement-window', { w:'820px', h:'600px', x:'22vw', y:'6vh' });
  win.setAttribute('aria-label', `${requirement.title}需求详情`);
  hydrateIcons(win);
}

function openProductItem(id) {
  if (id.startsWith('product-requirement-')) openProductRequirement(id.replace('product-requirement-', ''));
}

document.addEventListener('click', (event) => {
  const filter = event.target.closest('[data-product-filter]');
  if (filter) {
    productRequirementFilter = filter.dataset.productFilter;
    refreshProductProgress();
    showToast(productRequirementFilter === 'risk' ? '已筛选影响 Q3 发布的风险需求' : productRequirementFilter === 'week' ? '已显示本周重点需求' : '已显示全部核心需求');
    return;
  }
  const action = event.target.closest('[data-product-action]');
  if (!action) return;
  if (action.dataset.productAction === 'edit-goal') showToast('Q3 目标已打开，可更新发布日期与验收标准');
  if (action.dataset.productAction === 'summary') showToast('已汇总今日需求进度、风险与待决策事项');
  if (action.dataset.productAction === 'follow-up') showToast(`Syntropic 已开始跟进：${action.dataset.productName}`);
});

function renderHRCanvasObject(object, item) {
  if (item.type === 'hr-goal') object.innerHTML = hrGoalObjectMarkup();
  if (item.type === 'hr-agent-status') object.innerHTML = hrAgentStatusObjectMarkup();
  if (item.type === 'hr-schedule') object.innerHTML = hrScheduleObjectMarkup();
  if (item.type === 'hr-pipeline') object.innerHTML = hrPipelineObjectMarkup();
  if (item.type === 'hr-insight-card') object.innerHTML = hrInsightCardMarkup();
  if (item.type === 'hr-insights') object.innerHTML = hrInsightsObjectMarkup();
  if (item.type === 'hr-activity') object.innerHTML = hrActivityObjectMarkup();
  if (item.type === 'hr-artifact') object.innerHTML = hrArtifactObjectMarkup(item);
  if (item.type === 'hr-files') object.innerHTML = hrFilesObjectMarkup();
  hydrateIcons(object);
}

function refreshHRCanvasObjects() {
  if (currentCanvasId !== 'hr-recruiting') return;
  dynamicItems.filter((item) => item.type.startsWith('hr-')).forEach((item) => {
    const object = canvasObjects.find((entry) => entry.dataset.objectId === item.id);
    if (!object) return;
    renderHRCanvasObject(object, item);
    attachMinimizeControl(object);
    object.classList.remove('hr-state-changed');
    requestAnimationFrame(() => object.classList.add('hr-state-changed'));
  });
  setTimeout(() => canvasObjects.forEach((object) => object.classList.remove('hr-state-changed')), 650);
}

function refreshOpenHRWindows({ preserveInsight = false } = {}) {
  const goal = findWorkspaceWindow('hr-goal-center');
  if (goal?.classList.contains('open')) {
    goal.querySelector('.window-body').innerHTML = hrGoalCenterMarkup();
    hydrateIcons(goal);
  }
  const insight = findWorkspaceWindow('hr-insight');
  if (insight && !preserveInsight) {
    renderHRInsightBrowser(insight, insight.dataset.activeHrInsight || 'capacity');
  }
  ['product', 'growth'].forEach((roleId) => {
    const roleInsight = findWorkspaceWindow(`hr-role-insight-${roleId}`);
    if (!roleInsight?.classList.contains('open')) return;
    roleInsight.querySelector('.window-body').innerHTML = hrRoleInsightMarkup(roleId);
    hydrateIcons(roleInsight);
  });
  const candidate = findWorkspaceWindow('hr-candidate-linran');
  if (candidate?.classList.contains('open')) {
    candidate.remove();
    openHRCandidate();
  }
  const tasks = findWorkspaceWindow('hr-tasks');
  if (tasks?.classList.contains('open')) {
    renderHRTaskCenter(tasks, tasks.dataset.activeHrTask || 'hr-task-review');
  }
  const recruiting = findWorkspaceWindow('hr-recruiting-app');
  if (recruiting?.classList.contains('open')) {
    renderHRRecruitingApp(recruiting);
  }
}

function setHRDemoState(state) {
  hrDemoState = state;
  localStorage.setItem(hrDemoStateKey, state);
  refreshHRCanvasObjects();
  refreshOpenHRWindows();
}

function beginHRPlan() {
  setHRDemoState('active');
  clearTimeout(hrReplyTimer);
  showToast('恢复计划已启动，Syntropic 正在推进');
  hrReplyTimer = setTimeout(() => {
    if (hrDemoState !== 'active') return;
    setHRDemoState('reply');
    showTaskCompletionNotification('hr-candidate-linran', '需要你决定', '已找到 6 位候选人与 4 位评委的共同时间，是否发送邀请？');
  }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 1200 : 3800);
}

function publishProactiveInsight() {
  if (proactiveInsightPublished) return;
  proactiveInsightPublished = true;
  proactiveInsightPublishedAt = Date.now();
  createHRTask('hr-task-proactive-window');
  showNotification({
    openId:'hr-insight-proactive-window',
    title:'AI 主动洞察：候选人窗口正在收窄',
    status:'已创建任务',
    summary:'3 位高匹配候选人的面试窗口将在 48 小时内关闭，Syntropic 已自动开始协调共同时间。',
    action:'查看洞察',
    proactive:true,
  });
  showToast('Syntropic 主动发现新洞察，并已创建推进任务');
}

function scheduleProactiveInsight() {
  clearTimeout(proactiveInsightTimer);
  if (syntropicMode === 'demo') return;
  proactiveInsightTimer = setTimeout(publishProactiveInsight, 10000);
}

function resetHRDemo() {
  clearTimeout(hrReplyTimer);
  clearTimeout(proactiveInsightTimer);
  proactiveInsightPublished = false;
  proactiveInsightPublishedAt = 0;
  hrActiveRecruitingRole = 'agent';
  Object.keys(hrUserTaskDefinitions).forEach((id) => {
    delete hrUserTaskDefinitions[id];
    delete taskData[id];
  });
  hrCreatedTaskIds = new Set(syntropicMode === 'demo' ? [] : ['hr-task-monitor']);
  saveHRCreatedTasks();
  updateTaskExperienceCounts();
  setHRDemoState('insight');
  notificationButton.classList.remove('has-alert');
  setNotificationCenter(false);
  windowLayer.querySelectorAll('[data-window^="hr-"]').forEach((win) => {
    if (win.dataset.workspaceId === currentCanvasId) win.remove();
  });
  if (currentCanvasId === 'hr-recruiting') requestAnimationFrame(openHRRecruitingApp);
  scheduleProactiveInsight();
  showToast('招聘演示已重置');
}

function renderComposableCard(object, item) {
  const safe = workspaceNameHTML;
  const metrics = Array.isArray(item.metrics) ? item.metrics : [];
  const rows = Array.isArray(item.items) ? item.items : [];
  const sources = Array.isArray(item.sources) ? item.sources : [];
  object.dataset.uiKind = item.createdBy === 'system' ? 'system-widget' : 'generated-widget';
  object.dataset.componentId = item.id;
  object.style.setProperty('--component-accent', item.accent || '#2d8060');
  object.innerHTML = `
    <header class="composable-card-header" data-drag-handle>
      <span class="composable-card-icon" data-icon="${item.icon || 'spark'}"></span>
      <span><small>${safe(item.eyebrow || (item.createdBy === 'system' ? '系统组件' : 'Syntropic 生成'))}</small><strong data-component-title>${safe(item.title || '未命名组件')}</strong></span>
      <button type="button" data-component-menu="${item.id}" aria-label="${safe(item.title || '组件')}菜单"><span data-icon="more"></span></button>
    </header>
    ${item.summary ? `<p class="composable-card-summary" data-component-summary>${safe(item.summary)}</p>` : ''}
    ${metrics.length ? `<section class="composable-card-metrics">${metrics.map((metric) => `<article><strong>${safe(metric.value)}</strong><small>${safe(metric.label)}</small>${metric.trend ? `<em class="${metric.tone || ''}">${safe(metric.trend)}</em>` : ''}</article>`).join('')}</section>` : ''}
    ${rows.length ? `<section class="composable-card-list">${rows.map((row) => `<article><i class="${row.tone || ''}"></i><span><strong>${safe(row.title)}</strong><small>${safe(row.detail || '')}</small></span>${row.value ? `<em>${safe(row.value)}</em>` : ''}</article>`).join('')}</section>` : ''}
    <footer class="composable-card-footer"><span>${sources.length ? `来源：${sources.map(safe).join(' · ')}` : '尚未连接数据源'}</span><time>${safe(item.updatedLabel || '刚刚更新')}</time></footer>
    <div class="component-card-menu component-action-menu" data-component-menu-popover="${item.id}" aria-hidden="true">
      <button type="button" data-component-action="inspect" data-component-id="${item.id}"><span data-icon="search"></span>查看详情</button>
      <button type="button" data-component-action="edit" data-component-id="${item.id}"><span data-icon="spark"></span>用 Syntropic 修改</button>
      <button type="button" data-component-action="duplicate" data-component-id="${item.id}"><span data-icon="plus"></span>复制组件</button>
      <button type="button" data-component-action="remove" data-component-id="${item.id}"><span data-icon="close"></span>从桌面移除</button>
    </div>`;
}

function addDynamicCanvasItem(item, { persist = true, focus = false } = {}) {
  const object = document.createElement('article');
  const typeClass = item.type === 'app' ? 'canvas-pinned-app' : `canvas-${item.type}`;
  object.className = `canvas-object dynamic-canvas-object ${typeClass} entering`;
  object.dataset.objectId = item.id;
  object.dataset.dynamic = 'true';
  if (['hr-goal', 'hr-schedule', 'hr-activity', 'hr-insights', 'product-goal', 'product-risks', 'product-activity'].includes(item.type)) object.dataset.uiKind = 'system-widget';
  else if (['hr-pipeline', 'hr-files', 'product-progress'].includes(item.type)) object.dataset.uiKind = 'app-ui';
  object.style.setProperty('--object-x', `${item.x}px`);
  object.style.setProperty('--object-y', `${item.y}px`);
  if (item.type === 'zone') {
    object.style.setProperty('--zone-width', `${item.width || 520}px`);
    object.style.setProperty('--zone-height', `${item.height || 300}px`);
  }

  if (item.type === 'text' || item.type === 'note') {
    object.innerHTML = `<button class="text-drag-handle" type="button" data-drag-handle aria-label="拖动文字"><span data-icon="more"></span></button><div class="canvas-text-content" contenteditable="true" spellcheck="false"></div><button class="dynamic-remove" type="button" aria-label="删除文字"><span data-icon="close"></span></button>`;
    object.querySelector('.canvas-text-content').textContent = item.content || '';
  }
  if (item.type === 'hero-text') {
    object.innerHTML = `<button class="text-drag-handle" type="button" data-drag-handle aria-label="拖动文字"><span data-icon="more"></span></button><div class="hero-text-fields"><p contenteditable="true" data-item-field="eyebrow" spellcheck="false"></p><h1 contenteditable="true" data-item-field="title" spellcheck="false"></h1><span contenteditable="true" data-item-field="subtitle" spellcheck="false"></span></div><button class="dynamic-remove" type="button" aria-label="删除文字"><span data-icon="close"></span></button>`;
    object.querySelector('[data-item-field="eyebrow"]').textContent = item.eyebrow || '';
    object.querySelector('[data-item-field="title"]').textContent = item.title || '';
    object.querySelector('[data-item-field="subtitle"]').textContent = item.subtitle || '';
  }
  if (item.type === 'section-label') {
    object.innerHTML = `<button class="text-drag-handle" type="button" data-drag-handle aria-label="拖动标题"><span data-icon="more"></span></button><div class="section-label-content"><span data-icon="${item.icon || 'blocks'}"></span><strong contenteditable="true" data-item-field="title" spellcheck="false"></strong></div><button class="dynamic-remove" type="button" aria-label="删除标题"><span data-icon="close"></span></button>`;
    object.querySelector('[data-item-field="title"]').textContent = item.title || '区域标题';
  }
  if (item.type === 'zone') {
    object.innerHTML = `<header class="canvas-zone-heading" data-drag-handle><span data-icon="${item.icon || 'blocks'}"></span><strong contenteditable="true" data-item-field="title" spellcheck="false"></strong><small>场景区域</small><button class="dynamic-remove" type="button" aria-label="删除区域"><span data-icon="close"></span></button></header>`;
    object.querySelector('[data-item-field="title"]').textContent = item.title || '区域';
  }
  if (item.type === 'image') {
    object.innerHTML = `<header class="dynamic-object-bar" data-drag-handle><span>图片</span><button class="dynamic-remove" type="button" aria-label="删除"><span data-icon="close"></span></button></header><img alt="桌面图片"/><figcaption></figcaption>`;
    object.querySelector('img').src = item.src;
    object.querySelector('img').alt = item.name || '桌面图片';
    object.querySelector('figcaption').textContent = item.name || '图片';
  }
  if (item.type === 'file') {
    object.innerHTML = `<span class="canvas-file-icon" data-icon="file"></span><span class="canvas-file-copy"><strong></strong><small></small></span><button class="dynamic-remove" type="button" aria-label="删除"><span data-icon="close"></span></button>`;
    object.querySelector('.canvas-file-copy strong').textContent = item.name;
    object.querySelector('.canvas-file-copy small').textContent = `${item.extension || '文件'} · ${fileSizeLabel(item.size)}`;
  }
  if (item.type === 'document-preview') {
    object.innerHTML = `<span class="pinned-document-preview"><i>FEISHU / ${item.meta || '文档'}</i><strong></strong><span></span><span></span><span></span><p></p></span><span class="pinned-document-footer"><span><strong></strong><small></small></span><button class="dynamic-remove" type="button" aria-label="从桌面取消固定" title="从桌面取消固定"><span data-icon="pin-off"></span></button></span>`;
    object.querySelector('.pinned-document-preview strong').textContent = item.name || '飞书文档';
    object.querySelector('.pinned-document-preview p').textContent = item.summary || '';
    object.querySelector('.pinned-document-footer strong').textContent = item.name || '飞书文档';
    object.querySelector('.pinned-document-footer small').textContent = item.meta || '飞书文档';
    object.dataset.openDocument = item.documentId || '';
  }
  if (item.type === 'app') {
    const appContent = item.icon ? `<span data-icon="${item.icon}"></span>` : `<strong style="${item.dark ? 'color:#17191c' : ''}">${item.letter || 'A'}</strong>`;
    object.innerHTML = `<span class="launch-app-icon" style="--app-color:${item.color}">${appContent}</span><span class="canvas-pinned-app-copy"><strong></strong><small>已固定到桌面</small></span><button class="dynamic-remove" type="button" aria-label="删除"><span data-icon="close"></span></button>`;
    object.querySelector('.canvas-pinned-app-copy strong').textContent = item.name;
    if (item.action) object.dataset.action = item.action;
    if (item.open) object.dataset.open = item.open;
    object.dataset.appName = item.name;
  }
  if (item.type === 'ai-card') renderComposableCard(object, item);
  if (item.type.startsWith('product-')) renderProductCanvasObject(object, item);
  if (item.type.startsWith('hr-')) renderHRCanvasObject(object, item);

  canvasWorld.appendChild(object);
  hydrateIcons(object);
  canvasObjects.push(object);
  defaultPositions[item.id] = { x: item.x, y: item.y };
  bindCanvasObject(object);
  attachMinimizeControl(object);
  selectObject(object);
  setTimeout(() => object.classList.remove('entering'), 380);

  object.querySelector('.dynamic-remove')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    removeDynamicCanvasItem(item.id, item.type === 'document-preview' ? '文件已从桌面移除' : '对象已从桌面移除');
  });

  const editables = [...object.querySelectorAll('[contenteditable="true"]')];
  editables.forEach((editable) => editable.addEventListener('input', () => {
    const stored = dynamicItems.find((entry) => entry.id === item.id);
    if (stored) stored[editable.dataset.itemField || 'content'] = editable.textContent;
    saveDynamicItems();
    renderConnections();
  }));
  if (item.type === 'file') object.addEventListener('dblclick', () => showToast(`${item.name} 已添加为工作台上下文`));
  if (item.type === 'document-preview') object.addEventListener('click', (event) => {
    if (event.target.closest('.dynamic-remove')) return;
    openLarkDocumentWindow(item.documentId);
  });

  if (persist) {
    dynamicItems.push(item);
    saveDynamicItems();
    saveLayout();
  }
  if (focus && editables[0]) setTimeout(() => editables[0].focus({ preventScroll: true }), 80);
  if (persist) renderDockWorkspaceComponents();
  return object;
}

function restoreDynamicItems(items = [], layout = {}, hiddenIds = []) {
  dynamicItems = items.map((item) => ({ ...item }));
  const hidden = new Set(hiddenIds);
  const minimized = new Set(getCurrentCanvas()?.minimizedItems || []);
  dynamicItems.filter((item) => !hidden.has(item.id) && !minimized.has(item.id)).forEach((item) => addDynamicCanvasItem({ ...item, ...(layout[item.id] || {}) }, { persist: false }));
}

function addCanvasTextAt(point) {
  const position = { x: Math.max(10, point.x - 18), y: Math.max(50, point.y - 20) };
  addDynamicCanvasItem({ id: `text-${Date.now()}`, type: 'text', content: '', ...position }, { focus: true });
  setCanvasMode('select');
}

function saveView() {
  const current = getCurrentCanvas();
  if (!current) return;
  current.view = { ...canvasView };
  saveCanvasRegistry();
}

function performCanvasLoad(id) {
  const target = canvases.find((canvas) => canvas.id === id);
  if (!target) return;

  document.querySelectorAll('.dynamic-canvas-object').forEach((object) => {
    delete defaultPositions[object.dataset.objectId];
    object.remove();
  });
  currentCanvasId = target.id;
  syncWorkspaceWindows();
  selectedConnectionId = null;
  const hiddenObjects = new Set(target.hiddenObjects || []);
  canvasObjects = baseCanvasObjects.filter((object) => {
    const isGlobalWidget = object.hasAttribute('data-global-widget');
    const available = isGlobalWidget ? (target.widgetIds || []).includes(object.dataset.objectId) : target.showBase;
    return available && !hiddenObjects.has(object.dataset.objectId);
  });
  canvasWorld.classList.toggle('blank-canvas', !target.showBase);
  canvasWorld.classList.toggle('hr-canvas', target.id === 'hr-recruiting');
  canvasWorld.classList.toggle('product-canvas', target.id === 'product-release');
  desktopCanvas.classList.toggle('hr-workspace', target.id === 'hr-recruiting');
  desktopCanvas.classList.toggle('product-workspace', target.id === 'product-release');

  baseCanvasObjects.forEach((object) => {
    const position = target.layout[object.dataset.objectId] || (object.hasAttribute('data-global-widget') ? defaultWidgetPosition(target, object.dataset.objectId) : defaultPositions[object.dataset.objectId]) || { x: 0, y: 0 };
    object.style.setProperty('--object-x', `${position.x}px`);
    object.style.setProperty('--object-y', `${position.y}px`);
    const isGlobalWidget = object.hasAttribute('data-global-widget');
    const available = isGlobalWidget ? (target.widgetIds || []).includes(object.dataset.objectId) : target.showBase;
    object.classList.toggle('canvas-unpinned', !available || hiddenObjects.has(object.dataset.objectId));
  });
  restoreDynamicItems(target.dynamicItems, target.layout, target.hiddenDynamicItems);
  connections = (target.connections || []).map((connection) => ({ ...connection }));
  renderConnections();
  canvasView = innerWidth < 600 ? defaultCanvasView() : { ...target.view };
  applyCanvasView();
  selectObject(null);
  renderWorkspaceList();
  renderDockWorkspaceComponents();
  updateAISuggestionsForWorkspace();
  renderWidgetPicker();
  updateDocumentPinButtons();
  updateTaskExperienceCounts();
  saveCanvasRegistry();
  if (target.id === 'hr-recruiting') requestAnimationFrame(() => {
    if (currentCanvasId === target.id) openHRRecruitingApp();
  });
}

function switchCanvas(id, animate = true) {
  if (id === currentCanvasId) {
    setWorkspacePopover(false);
    return;
  }
  captureCurrentCanvasState();
  saveCanvasRegistry();
  setWorkspacePopover(false);
  if (!animate) {
    performCanvasLoad(id);
    return;
  }
  desktopCanvas.classList.add('changing-canvas');
  setTimeout(() => {
    performCanvasLoad(id);
    requestAnimationFrame(() => desktopCanvas.classList.remove('changing-canvas'));
  }, 150);
}

function createCanvas() {
  captureCurrentCanvasState();
  const number = canvases.filter((canvas) => canvas.name.startsWith('新工作台')).length + 1;
  const canvas = {
    id: `canvas-${Date.now()}`, name: `新工作台 ${number}`,
    accent: ['#d8ece5', '#dfe7f5', '#eee4ef', '#f2eadb'][canvases.length % 4],
    showBase: false, layout: {}, view: defaultCanvasView(), dynamicItems: [], connections: [], hiddenObjects: [],
  };
  canvases.push(canvas);
  saveCanvasRegistry();
  renderWorkspaceList();
  switchCanvas(canvas.id);
  showToast(`${canvas.name} 已创建`);
  // Onboarding belongs to the moment a blank workspace is created. Existing
  // workspaces retain their context and never interrupt the user on reload.
  const newCanvasId = canvas.id;
  setTimeout(() => startWorkspaceSetup(newCanvasId), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 360);
}

function deleteCanvas(id) {
  if (canvases.length === 1) {
    showToast('至少保留一个工作台');
    return;
  }
  const index = canvases.findIndex((canvas) => canvas.id === id);
  if (index < 0) return;
  const [removed] = canvases.splice(index, 1);
  if (id === currentCanvasId) {
    const next = canvases[Math.min(index, canvases.length - 1)];
    currentCanvasId = next.id;
    saveCanvasRegistry();
    setWorkspacePopover(false);
    desktopCanvas.classList.add('changing-canvas');
    setTimeout(() => {
      performCanvasLoad(next.id);
      requestAnimationFrame(() => desktopCanvas.classList.remove('changing-canvas'));
    }, 150);
  } else {
    saveCanvasRegistry();
    renderWorkspaceList();
  }
  showToast(`${removed.name} 已删除`);
}

function selectObject(object) {
  canvasObjects.forEach((item) => item.classList.toggle('selected', item === object));
}

function clampObjectToDesktop(object, x, y) {
  // Clamp against the full logical canvas world so components can reach the
  // very top and bottom; panning/zooming already covers the visible range.
  const width = object.offsetWidth || 0;
  const height = object.offsetHeight || 0;
  return {
    x: Math.min(Math.max(0, x), Math.max(0, desktopCanvasSize.width - width)),
    y: Math.min(Math.max(0, y), Math.max(0, desktopCanvasSize.height - height)),
  };
}

function beginEditableTextDrag(object, editable, event) {
  if (event.button !== 0) return;
  const startX = event.clientX;
  const startY = event.clientY;
  const originX = parseFloat(object.style.getPropertyValue('--object-x'));
  const originY = parseFloat(object.style.getPropertyValue('--object-y'));
  let moved = false;

  const move = (moveEvent) => {
    const dx = (moveEvent.clientX - startX) / canvasView.scale;
    const dy = (moveEvent.clientY - startY) / canvasView.scale;
    if (!moved && Math.hypot(dx, dy) <= 4) return;
    if (!moved) {
      moved = true;
      editable.blur();
      selectObject(object);
      object.classList.add('dragging');
    }
    moveEvent.preventDefault();
    const next = clampObjectToDesktop(object, originX + dx, originY + dy);
    object.style.setProperty('--object-x', `${next.x}px`);
    object.style.setProperty('--object-y', `${next.y}px`);
    renderConnections();
  };

  const end = () => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', end);
    document.removeEventListener('pointercancel', end);
    if (!moved) return;
    object.classList.remove('dragging');
    object.dataset.justDragged = 'true';
    saveLayout();
    renderConnections();
    canvasHint.classList.add('hidden');
    setTimeout(() => { object.dataset.justDragged = 'false'; }, 80);
  };

  document.addEventListener('pointermove', move, { passive: false });
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
}

function bindCanvasObject(object) {
  object.addEventListener('pointerdown', (event) => {
    if (canvasMode === 'pan') return;
    if (event.target.closest('.dynamic-remove, .canvas-card-pin, .task-widget button, .schedule-meeting')) return;
    const interactiveControl = event.target.closest('button,input,textarea,select,a');
    if (interactiveControl && !interactiveControl.matches('[data-drag-handle]')) return;
    const editable = event.target.closest('[contenteditable="true"]');
    if (editable) {
      beginEditableTextDrag(object, editable, event);
      return;
    }
    if (selectedConnectionId) {
      selectedConnectionId = null;
      renderConnections();
    }
    if (canvasMode === 'text') {
      event.preventDefault();
      event.stopPropagation();
      object.dataset.justDragged = 'true';
      addCanvasTextAt(worldPointFromEvent(event));
      setTimeout(() => { object.dataset.justDragged = 'false'; }, 80);
      return;
    }
    if (canvasMode === 'connect') {
      beginConnection(object, event);
      return;
    }
    const handle = object.querySelector('[data-drag-handle]');
    if (handle && !event.target.closest('[data-drag-handle]')) return;
    event.stopPropagation();
    selectObject(object);
    const startX = event.clientX;
    const startY = event.clientY;
    const openOnRelease = event.target.closest('[data-open]')?.dataset.open || '';
    const originX = parseFloat(object.style.getPropertyValue('--object-x'));
    const originY = parseFloat(object.style.getPropertyValue('--object-y'));
    let moved = false;
    object.classList.add('dragging');
    object.setPointerCapture(event.pointerId);
    const moveObject = (moveEvent) => {
      const dx = (moveEvent.clientX - startX) / canvasView.scale;
      const dy = (moveEvent.clientY - startY) / canvasView.scale;
      if (Math.hypot(dx, dy) > 3) moved = true;
      const next = clampObjectToDesktop(object, originX + dx, originY + dy);
      object.style.setProperty('--object-x', `${next.x}px`);
      object.style.setProperty('--object-y', `${next.y}px`);
      renderConnections();
    };
    const endObject = (endEvent) => {
      object.classList.remove('dragging');
      const shouldOpen = !moved && endEvent.type === 'pointerup' && openOnRelease;
      object.dataset.justDragged = moved || shouldOpen ? 'true' : 'false';
      if (moved) {
        saveLayout();
        renderConnections();
        canvasHint.classList.add('hidden');
        setTimeout(() => { object.dataset.justDragged = 'false'; }, 80);
      } else if (shouldOpen) {
        openItem(openOnRelease);
        setTimeout(() => { object.dataset.justDragged = 'false'; }, 80);
      }
      object.removeEventListener('pointermove', moveObject);
      object.removeEventListener('pointerup', endObject);
      object.removeEventListener('pointercancel', endObject);
    };
    object.addEventListener('pointermove', moveObject);
    object.addEventListener('pointerup', endObject);
    object.addEventListener('pointercancel', endObject);
  });
}

canvasObjects.forEach(bindCanvasObject);

workspaceSwitcher.addEventListener('click', (event) => {
  event.stopPropagation();
  const opening = !workspacePopover.classList.contains('open');
  if (opening) {
    captureCurrentCanvasState();
    saveCanvasRegistry();
    renderWorkspaceList();
  }
  setWorkspacePopover(opening);
});

workspaceAdd.addEventListener('click', (event) => {
  event.stopPropagation();
  createCanvas();
});

workspaceList.addEventListener('click', (event) => {
  const renameButton = event.target.closest('[data-workspace-rename]');
  if (renameButton) {
    event.stopPropagation();
    beginWorkspaceRename(renameButton.dataset.workspaceRename);
    return;
  }
  const deleteButton = event.target.closest('[data-workspace-delete]');
  if (deleteButton) {
    event.stopPropagation();
    deleteCanvas(deleteButton.dataset.workspaceDelete);
    return;
  }
  const selectButton = event.target.closest('[data-workspace-select]');
  if (selectButton) switchCanvas(selectButton.dataset.workspaceSelect);
});

document.addEventListener('pointerdown', (event) => {
  if (!workspacePopover.classList.contains('open')) return;
  if (event.target.closest('.workspace-nav')) return;
  setWorkspacePopover(false);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    setWorkspacePopover(false);
    setNotificationCenter(false);
  }
});

document.addEventListener('click', (event) => {
  const dragged = event.target.closest('.canvas-object[data-just-dragged="true"]');
  if (dragged || (canvasMode === 'pan' && event.target.closest('.canvas-object'))) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);

desktopCanvas.addEventListener('pointerdown', (event) => {
  if (event.target.closest('.canvas-toolbar, .connection-controls, .ai-surface, .dock')) return;
  if (canvasMode === 'text') {
    event.preventDefault();
    addCanvasTextAt(worldPointFromEvent(event));
    return;
  }
  if (event.target.closest('.canvas-object')) return;
  if (selectedConnectionId) selectConnection(null);
  selectObject(null);
  if (desktopMode) return;
  const startX = event.clientX;
  const startY = event.clientY;
  const origin = { x: canvasView.x, y: canvasView.y };
  desktopCanvas.classList.add('panning');
  desktopCanvas.setPointerCapture(event.pointerId);
  const pan = (moveEvent) => {
    canvasView.x = origin.x + moveEvent.clientX - startX;
    canvasView.y = origin.y + moveEvent.clientY - startY;
    applyCanvasView();
  };
  const endPan = () => {
    desktopCanvas.classList.remove('panning');
    saveView();
    desktopCanvas.removeEventListener('pointermove', pan);
    desktopCanvas.removeEventListener('pointerup', endPan);
    desktopCanvas.removeEventListener('pointercancel', endPan);
  };
  desktopCanvas.addEventListener('pointermove', pan);
  desktopCanvas.addEventListener('pointerup', endPan);
  desktopCanvas.addEventListener('pointercancel', endPan);
});

function setScale(nextScale) {
  if (desktopMode) return;
  const rect = desktopCanvas.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const worldX = (centerX - canvasView.x) / canvasView.scale;
  const worldY = (centerY - canvasView.y) / canvasView.scale;
  canvasView.scale = Math.max(.5, Math.min(1.35, nextScale));
  canvasView.x = centerX - worldX * canvasView.scale;
  canvasView.y = centerY - worldY * canvasView.scale;
  applyCanvasView(true);
  saveView();
}

function setCanvasMode(mode) {
  if (desktopMode && mode !== 'select') return;
  canvasMode = mode;
  document.querySelectorAll('[data-canvas-mode]').forEach((item) => item.classList.toggle('selected', item.dataset.canvasMode === mode));
  canvasWorld.classList.toggle('pan-mode', mode === 'pan');
  canvasWorld.classList.toggle('connect-mode', mode === 'connect');
  canvasWorld.classList.toggle('text-mode', mode === 'text');
}

document.querySelectorAll('[data-canvas-mode]').forEach((button) => {
  button.addEventListener('click', () => setCanvasMode(button.dataset.canvasMode));
});

document.querySelectorAll('[data-canvas-action]').forEach((button) => {
  button.addEventListener('click', (event) => {
    const action = button.dataset.canvasAction;
    if (action === 'widgets') {
      event.stopPropagation();
      setWidgetPicker(!widgetPicker.classList.contains('open'));
      return;
    }
    if (action === 'zoom-in') setScale(canvasView.scale + .1);
    if (action === 'zoom-out') setScale(canvasView.scale - .1);
    if (action === 'reset-view') {
      canvasView = { x: 0, y: 0, scale: innerWidth < 600 ? .66 : 1 };
      applyCanvasView(true);
      saveView();
    }
    if (action === 'arrange') {
      canvasObjects.forEach((object) => {
        const position = defaultPositions[object.dataset.objectId];
        object.style.transition = 'left 420ms var(--ease), top 420ms var(--ease), transform 220ms var(--spring)';
        object.style.setProperty('--object-x', `${position.x}px`);
        object.style.setProperty('--object-y', `${position.y}px`);
        setTimeout(() => { object.style.transition = ''; }, 460);
      });
      animateConnectionRefresh();
      saveLayout();
      showToast('桌面对象已自动整理');
    }
  });
});

widgetPicker.addEventListener('click', (event) => {
  event.stopPropagation();
  if (event.target.closest('[data-widget-close]')) {
    setWidgetPicker(false);
    return;
  }
  const toggle = event.target.closest('[data-widget-toggle]');
  if (toggle) toggleGlobalWidget(toggle.dataset.widgetToggle);
});

document.addEventListener('click', (event) => {
  if (!widgetPicker.classList.contains('open')) return;
  if (event.target.closest('#widgetPicker,[data-canvas-action="widgets"]')) return;
  setWidgetPicker(false);
});

desktopCanvas.addEventListener('wheel', (event) => {
  if (desktopMode) return;
  if (!(event.ctrlKey || event.metaKey)) return;
  event.preventDefault();
  setScale(canvasView.scale - event.deltaY * .002);
}, { passive: false });

initializeCanvasRegistry();
desktopCanvas.classList.add('mac-desktop');
performCanvasLoad(currentCanvasId);
scheduleProactiveInsight();

let desktopResizeFrame = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(desktopResizeFrame);
  desktopResizeFrame = requestAnimationFrame(() => {
    applyCanvasView();
    if (currentCanvasId === 'hr-recruiting') {
      const recruiting = findWorkspaceWindow('hr-recruiting-app');
      if (recruiting?.classList.contains('open') && !recruiting.classList.contains('expanded')) {
        recruiting.remove();
        openHRRecruitingApp();
      }
    }
  });
});

// --- Product experience layer -------------------------------------------------
// Kept isolated from the domain demo so it can later move into its own module.
const experienceKeys = {
  tourComplete: 'syntropic-tour-complete-v1',
  connectionMode: 'syntropic-connection-mode-v1',
};

function clearSyntropicDemoState() {
  // Demo wipes only its namespaced slice; debug clears prefixed app state.
  const keys = [];
  for (let index = 0; index < window.localStorage.length; index++) keys.push(window.localStorage.key(index));
  keys.forEach((key) => {
    const matches = syntropicMode === 'demo'
      ? key.startsWith(demoStoragePrefix)
      : syntropicStatePrefixes.some((prefix) => key.startsWith(prefix));
    if (matches) window.localStorage.removeItem(key);
  });
  location.reload();
}

function syntropicModeURL(mode) {
  const url = new URL(location.href);
  url.searchParams.set('mode', mode);
  return `${url.pathname}${url.search}${url.hash}`;
}

function installExperienceChrome() {
  const status = document.querySelector('.system-status');
  if (!status || status.querySelector('[data-demo-status], [data-start-tour]')) return;
  if (syntropicMode === 'debug') {
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'demo-data-badge mode-badge debug';
    badge.dataset.demoStatus = '';
    badge.setAttribute('aria-label', '打开 Debug 控制台');
    badge.innerHTML = '<i></i><span>DEBUG</span>';
    status.insertBefore(badge, status.firstChild);
  }
  const help = document.createElement('button');
  help.type = 'button';
  help.className = 'experience-help';
  help.dataset.startTour = '';
  help.setAttribute('aria-label', '查看产品引导');
  help.title = '产品引导';
  help.innerHTML = '<span data-icon="help"></span>';
  status.insertBefore(help, status.querySelector('[data-demo-status]')?.nextSibling ?? status.firstChild);
  hydrateIcons(status);
  if (syntropicMode === 'debug') installDebugConsole();
}

function installDebugConsole() {
  if (document.querySelector('[data-debug-console]')) return;
  const panel = document.createElement('aside');
  panel.className = 'debug-console';
  panel.dataset.debugConsole = '';
  panel.setAttribute('aria-hidden', 'true');
  panel.innerHTML = `
    <header><span><i></i><strong>演示控制台</strong><small>DEBUG MODE</small></span><button type="button" data-debug-close aria-label="收起控制台"><span data-icon="close"></span></button></header>
    <section><small>场景</small><div class="debug-action-grid"><button type="button" data-debug-action="onboarding"><span data-icon="user"></span>新用户引导</button><button type="button" data-debug-workspace="hr-recruiting"><span data-icon="recruiting"></span>招聘工作台</button><button type="button" data-debug-workspace="product-release"><span data-icon="code"></span>产品工作台</button><button type="button" data-debug-action="tour"><span data-icon="spark"></span>产品引导</button></div></section>
    <section><small>数据与状态</small><button class="debug-console-row" type="button" data-debug-action="clear-user"><span><strong>清除用户信息</strong><em>清空后下次进入将重新显示新用户引导</em></span><i data-icon="arrow"></i></button><button class="debug-console-row" type="button" data-debug-action="connection"><span><strong>数据源状态</strong><em data-debug-connection-state>正常</em></span><i data-icon="arrow"></i></button><button class="debug-console-row danger" type="button" data-debug-action="reset"><span><strong>重置 Debug 数据</strong><em>恢复初始招聘场景</em></span><i data-icon="arrow"></i></button></section>
    <footer><span>当前修改仅保存在 Debug 数据空间</span><button type="button" data-switch-mode="demo">进入演示模式</button></footer>`;
  document.body.appendChild(panel);
  hydrateIcons(panel);
  updateDebugConsoleState();
}

function setDebugConsole(open) {
  const panel = document.querySelector('[data-debug-console]');
  if (!panel) return;
  panel.classList.toggle('open', open);
  panel.setAttribute('aria-hidden', String(!open));
  document.querySelector('[data-demo-status]')?.setAttribute('aria-expanded', String(open));
}

function updateDebugConsoleState() {
  const offline = localStorage.getItem(experienceKeys.connectionMode) === 'offline';
  document.querySelectorAll('[data-debug-connection-state]').forEach((node) => {
    node.textContent = offline ? '异常 · 点击恢复' : '正常 · 点击模拟断连';
    node.classList.toggle('warning', offline);
  });
}

function showExperienceDialog(kind = 'status') {
  document.querySelector('.experience-dialog-layer')?.remove();
  const layer = document.createElement('div');
  layer.className = 'experience-dialog-layer';
  const isReset = kind === 'reset';
  layer.innerHTML = `<section class="experience-dialog" role="dialog" aria-modal="true" aria-labelledby="experienceDialogTitle">
    <header><span><i class="dialog-mark"></i><strong id="experienceDialogTitle">${isReset ? '重置演示？' : '数据与执行状态'}</strong></span><button type="button" data-dialog-close aria-label="关闭"><span data-icon="close"></span></button></header>
    ${isReset ? `<div class="reset-dialog-copy"><p>这会清除当前 ${syntropicMode === 'debug' ? 'Debug' : '演示'} 数据空间中的布局、任务和引导进度，并恢复到初始招聘场景。</p><p class="reset-note">另一个模式的数据不会受到影响。</p></div><footer><button type="button" data-dialog-close>取消</button><button class="danger" type="button" data-confirm-reset>确认重置</button></footer>` : `
    <div class="demo-trust-copy"><span class="demo-trust-pill">演示模式</span><h2>从新用户视角体验完整流程</h2><p>演示模式使用独立的临时数据，每次重新进入都会从新手对话开始，不会覆盖 Debug 模式中调整过的工作台。</p></div>
    <div class="connection-list" data-connection-list></div>
    <footer><button type="button" data-switch-mode="debug">进入 Debug 模式</button><span class="dialog-footer-actions"><button type="button" data-preview-onboarding>重新开始引导</button><button class="primary" type="button" data-dialog-close>继续体验</button></span></footer>`}
  </section>`;
  document.body.appendChild(layer);
  hydrateIcons(layer);
  renderConnectionState(layer);
  requestAnimationFrame(() => layer.classList.add('visible'));
  layer.querySelector('button')?.focus();
}

function renderConnectionState(root = document) {
  const list = root.querySelector('[data-connection-list]');
  const toggle = root.querySelector('[data-toggle-connection]');
  if (!list || !toggle) return;
  const offline = localStorage.getItem(experienceKeys.connectionMode) === 'offline';
  const sources = [
    ['飞书招聘', offline ? '同步失败' : '模拟 · 2 分钟前同步'],
    ['团队日历', offline ? '等待重试' : '模拟 · 刚刚同步'],
    ['面试评价表', offline ? '上次数据可用' : '模拟 · 12 分钟前同步'],
  ];
  list.innerHTML = sources.map(([name, detail]) => `<article class="${offline ? 'offline' : ''}"><i></i><span><strong>${name}</strong><small>${detail}</small></span><em>${offline ? '异常' : '可用'}</em></article>`).join('');
  toggle.textContent = offline ? '恢复连接' : '模拟断连';
  document.body.classList.toggle('demo-offline', offline);
  const badge = document.querySelector('[data-demo-status]');
  badge?.classList.toggle('has-warning', offline);
  if (badge) badge.querySelector('span').textContent = syntropicMode === 'debug' ? 'DEBUG' : offline ? '数据源异常' : '演示模式';
  updateDebugConsoleState();
}

const tourSteps = [
  {
    eyebrow: '新工作台', title: '这是一个独立的任务空间',
    copy: '每个工作台会分别保存布局、任务与产物。你可以从顶部随时切换空间，已有工作台不会重复出现引导。',
    target: '#workspaceSwitcher', action: () => showDesktop(), button: '继续',
  },
  {
    eyebrow: '开始协作', title: '告诉 Syntropic 你想完成什么',
    copy: '输入目标后会创建可持续推进的任务，并展示执行阶段、使用的数据和需要你确认的动作。',
    target: '#aiSurface', action: () => { setAIComposerExpanded(true); suggestions(true); }, button: '了解应用',
  },
  {
    eyebrow: '应用与上下文', title: '从 Dock 打开工具和数据源',
    copy: '你可以打开任务中心、日程、浏览器与应用市场，把需要的上下文固定到当前工作台。按 Ctrl/⌘ + K 可随时唤起输入框。',
    target: '#dock', action: () => { suggestions(false); setAIComposerExpanded(false); }, button: '开始使用',
  },
];
let activeTourStep = 0;

// New-blank-workspace setup runs inside the same corner tour before the
// standard steps: pick a scenario, connect demo data sources, choose goals.
let setupCanvasId = null;
const workspaceSetupState = { role: null, goals: [] };
const workspaceSetupSources = new Set();
const setupRoleNames = { hr: '招聘工作台', product: '产品工作台', founder: '经营工作台', other: '我的工作台' };

function setupSourcesFor(role) {
  if (role === 'hr') return recruitingSources;
  if (role === 'product') return productSources;
  return [];
}

function activeTourSteps() {
  const setup = setupCanvasId ? [
    { id: 'setup-role', eyebrow: '新工作台 · 场景 1/3', title: '这个工作台主要用来做什么？', copy: '选择最贴近的场景，我会按它组织任务、数据与组件。' },
    { id: 'setup-sources', eyebrow: '新工作台 · 数据 2/3', title: '要接入哪些数据源？', copy: '可多选；当前原型只模拟授权与数据导入，选择后点击下一步继续。' },
    { id: 'setup-goals', eyebrow: '新工作台 · 目的 3/3', title: '你希望先改善什么？', copy: '可多选；选中的目标会成为这里的首批推进方向，完成后点击"完成设置"。' },
  ] : [];
  return [...setup, ...tourSteps];
}

function startWorkspaceSetup(canvasId) {
  setupCanvasId = canvasId;
  workspaceSetupState.role = null;
  workspaceSetupState.goals = [];
  workspaceSetupSources.clear();
  renderProductTour(0);
}

function finishWorkspaceSetup() {
  const canvas = canvases.find((item) => item.id === setupCanvasId);
  if (canvas) {
    canvas.name = setupRoleNames[workspaceSetupState.role] || canvas.name;
    canvas.workspaceProfile = {
      role: workspaceSetupState.role,
      sources: [...workspaceSetupSources],
      goals: [...workspaceSetupState.goals],
    };
    // Seeded panels: generate the matching preset workspace board for the
    // chosen scenario so a "new" workspace lands ready-to-use, not blank.
    // Item ids are namespaced to this canvas so duplicates never collide with
    // an existing workspace using the same preset components.
    const templateId = { hr: 'hr-recruiting', product: 'product-release', founder: 'personal-focus', other: '' }[workspaceSetupState.role];
    const template = templateId ? workspaceCanvasTemplates().find((item) => item.id === templateId) : null;
    if (template) {
      const idMap = {};
      const prefix = `${canvas.id}-`;
      canvas.showBase = Boolean(template.showBase);
      canvas.dynamicItems = JSON.parse(JSON.stringify(template.dynamicItems || [])).map((item) => {
        idMap[item.id] = `${prefix}${item.id}`;
        return { ...item, id: idMap[item.id] };
      });
      canvas.connections = JSON.parse(JSON.stringify(template.connections || [])).map((connection) => ({
        ...connection, id: `${prefix}${connection.id}`, from: idMap[connection.from], to: idMap[connection.to],
      }));
      canvas.hiddenDynamicItems = [];
    }
    saveCanvasRegistry();
    renderWorkspaceList();
    performCanvasLoad(canvas.id);
    showToast(`已根据你的选择生成${canvas.name}面板`);
  }
  setupCanvasId = null;
}

function renderSetupStepBody(stepId) {
  if (stepId === 'setup-role') {
    return `<div class="tour-setup-options">${onboardingRoles.map((role) => `<button type="button" data-setup-role="${role.id}" class="${workspaceSetupState.role === role.id ? 'selected' : ''}"><strong>${role.label}</strong><small>${role.detail}</small></button>`).join('')}</div>`;
  }
  if (stepId === 'setup-sources') {
    const sources = setupSourcesFor(workspaceSetupState.role);
    if (!sources.length) return '<p class="tour-setup-note">该场景暂无内置数据源，你可以稍后在应用市场中添加。</p>';
    return `<div class="recruiting-source-grid compact">${sources.map((source) => `<button type="button" data-setup-source="${source.id}" class="${workspaceSetupSources.has(source.id) ? 'selected' : ''}">${onboardingSourceLogo(source)}<span><strong>${source.name}</strong><small>${source.detail}</small></span><em>${workspaceSetupSources.has(source.id) ? '已选择' : '选择'}</em></button>`).join('')}</div>`;
  }
  const goals = onboardingGoals[workspaceSetupState.role] || onboardingGoals.other;
  return `<div class="onboarding-goals tour-goals">${goals.map((goal) => `<button type="button" data-setup-goal="${goal}" class="${workspaceSetupState.goals.includes(goal) ? 'selected' : ''}"><i></i>${goal}</button>`).join('')}</div>`;
}

function closeProductTour(completed = false) {
  document.querySelector('.product-tour')?.remove();
  document.querySelector('.tour-highlight')?.classList.remove('tour-highlight');
  setupCanvasId = null;
  if (completed) localStorage.setItem(experienceKeys.tourComplete, 'true');
}

function renderProductTour(index = 0) {
  document.querySelector('.product-tour')?.remove();
  document.querySelector('.tour-highlight')?.classList.remove('tour-highlight');
  const list = activeTourSteps();
  activeTourStep = Math.max(0, Math.min(list.length - 1, index));
  const step = list[activeTourStep];
  const isSetup = Boolean(step.id?.startsWith('setup-'));
  if (!isSetup) {
    step.action?.();
    document.querySelector(step.target)?.classList.add('tour-highlight');
  }
  const body = isSetup ? renderSetupStepBody(step.id) : '';
  const nextDisabled = step.id === 'setup-role' && !workspaceSetupState.role;
  const nextAttrs = isSetup ? 'data-setup-next' : 'data-tour-next';
  const nextLabel = isSetup ? (step.id === 'setup-goals' ? '完成设置' : '下一步') : step.button;
  const tour = document.createElement('aside');
  tour.className = 'product-tour';
  tour.setAttribute('role', 'dialog');
  tour.setAttribute('aria-modal', 'true');
  tour.setAttribute('aria-labelledby', 'tourTitle');
  tour.innerHTML = `<header><span>${step.eyebrow}</span><button type="button" data-tour-skip>跳过引导</button></header>
    <div class="tour-progress" aria-label="第 ${activeTourStep + 1} 步，共 ${list.length} 步">${list.map((_, i) => `<i class="${i <= activeTourStep ? 'active' : ''}"></i>`).join('')}</div>
    <h2 id="tourTitle">${step.title}</h2><p>${step.copy}</p>${body}
    <footer>${activeTourStep ? '<button type="button" data-tour-back>上一步</button>' : '<span></span>'}<button class="primary" type="button" ${nextAttrs}${nextDisabled ? ' disabled' : ''}>${nextLabel}</button></footer>`;
  document.body.appendChild(tour);
  hydrateIcons(tour);
  requestAnimationFrame(() => tour.classList.add('visible'));
  tour.querySelector('[data-tour-next],[data-setup-next]')?.focus();
}

function installExperienceEvents() {
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-demo-status]')) {
      if (syntropicMode === 'debug') setDebugConsole(!document.querySelector('[data-debug-console]')?.classList.contains('open'));
      else showExperienceDialog('status');
    }
    if (event.target.closest('[data-debug-close]')) setDebugConsole(false);
    const modeSwitch = event.target.closest('[data-switch-mode]');
    if (modeSwitch) location.href = syntropicModeURL(modeSwitch.dataset.switchMode);
    const debugWorkspace = event.target.closest('[data-debug-workspace]');
    if (debugWorkspace) {
      setDebugConsole(false);
      showDesktop();
      performCanvasLoad(debugWorkspace.dataset.debugWorkspace);
    }
    const debugAction = event.target.closest('[data-debug-action]')?.dataset.debugAction;
    if (debugAction === 'clear-user') {
      ['syntropic-user-onboarded-v1', 'syntropic-user-profile-v1', 'solo-canvases-v1'].forEach((key) => window.localStorage.removeItem(key));
      showToast('用户信息已清除，刷新页面将以新用户身份进入引导');
    }
    if (debugAction === 'onboarding') {
      setDebugConsole(false);
      document.querySelector('.first-run-onboarding')?.remove();
      if (typeof startUserOnboarding === 'function') startUserOnboarding();
    }
    if (debugAction === 'tour') { setDebugConsole(false); renderProductTour(0); }
    if (debugAction === 'reset') { setDebugConsole(false); showExperienceDialog('reset'); }
    if (debugAction === 'connection') {
      const offline = localStorage.getItem(experienceKeys.connectionMode) === 'offline';
      localStorage.setItem(experienceKeys.connectionMode, offline ? 'online' : 'offline');
      renderConnectionState();
      showToast(offline ? '演示数据源已恢复' : '已切换到数据源异常演示');
    }
    if (event.target.closest('[data-start-tour]')) renderProductTour(0);
    if (event.target.closest('[data-dialog-close]')) event.target.closest('.experience-dialog-layer')?.remove();
    if (event.target.closest('[data-reset-demo]')) showExperienceDialog('reset');
    if (event.target.closest('[data-preview-onboarding]')) {
      event.target.closest('.experience-dialog-layer')?.remove();
      document.querySelector('.first-run-onboarding')?.remove();
      if (typeof startUserOnboarding === 'function') startUserOnboarding();
    }
    if (event.target.closest('[data-confirm-reset]')) clearSyntropicDemoState();
    if (event.target.closest('[data-toggle-connection]')) {
      const offline = localStorage.getItem(experienceKeys.connectionMode) === 'offline';
      localStorage.setItem(experienceKeys.connectionMode, offline ? 'online' : 'offline');
      renderConnectionState(event.target.closest('.experience-dialog-layer'));
      showToast(offline ? '演示数据源已恢复' : '已切换到数据源异常演示');
    }
    if (event.target.closest('[data-tour-skip]')) closeProductTour(true);
    if (event.target.closest('[data-tour-back]')) renderProductTour(activeTourStep - 1);
    const setupRoleButton = event.target.closest('[data-setup-role]');
    if (setupRoleButton) {
      workspaceSetupState.role = setupRoleButton.dataset.setupRole;
      workspaceSetupSources.clear();
      workspaceSetupState.goals = [];
      renderProductTour(activeTourStep + 1);
      return;
    }
    const setupSourceButton = event.target.closest('[data-setup-source]');
    if (setupSourceButton) {
      const id = setupSourceButton.dataset.setupSource;
      const selected = !workspaceSetupSources.has(id);
      if (selected) workspaceSetupSources.add(id); else workspaceSetupSources.delete(id);
      setupSourceButton.classList.toggle('selected', selected);
      const label = setupSourceButton.querySelector('em');
      if (label) label.textContent = selected ? '已选择' : '选择';
      return;
    }
    const setupGoalButton = event.target.closest('[data-setup-goal]');
    if (setupGoalButton) {
      const goal = setupGoalButton.dataset.setupGoal;
      workspaceSetupState.goals = workspaceSetupState.goals.includes(goal)
        ? workspaceSetupState.goals.filter((item) => item !== goal)
        : [...workspaceSetupState.goals, goal];
      setupGoalButton.classList.toggle('selected', workspaceSetupState.goals.includes(goal));
      return;
    }
    if (event.target.closest('[data-setup-next]')) {
      const stepId = activeTourSteps()[activeTourStep]?.id;
      if (stepId === 'setup-goals') {
        finishWorkspaceSetup();
        closeProductTour(true);
      } else {
        renderProductTour(activeTourStep + 1);
      }
      return;
    }
    if (event.target.closest('[data-tour-next]')) {
      if (activeTourStep >= tourSteps.length - 1) closeProductTour(true);
      else renderProductTour(activeTourStep + 1);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (document.querySelector('.product-tour')) { closeProductTour(true); return; }
    const dialog = document.querySelector('.experience-dialog-layer');
    if (dialog) { dialog.remove(); return; }
    if (document.querySelector('[data-debug-console].open')) { setDebugConsole(false); return; }
    const openWindows = [...document.querySelectorAll('.os-window.open')].sort((a, b) => (+getComputedStyle(a).zIndex || 0) - (+getComputedStyle(b).zIndex || 0));
    const topWindow = openWindows.at(-1);
    if (topWindow) {
      topWindow.classList.remove('open');
      topWindow.setAttribute('aria-hidden', 'true');
    }
  });
}

installExperienceChrome();
installExperienceEvents();
renderConnectionState();
updateTaskExperienceCounts();
