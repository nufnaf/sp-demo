import type { SessionInfo } from "./types";

export const INSIGHT_TASK_MARKER = "<pi-web-insight-analysis>";
export const INSIGHT_BATCH_SIZE = 5;

export interface InsightReminderContext {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  sessionId?: string;
}

export interface InsightResult {
  sessionId: string;
  filePath: string;
  cwd: string;
  fileName: string;
  title: string;
  modified: string;
}

function decodeHtmlText(value: string): string {
  const entities: Record<string, string> = {
    amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"',
  };
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
      if (entity.startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
      if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
      return entities[entity.toLowerCase()] ?? match;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function truncateInsightText(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max).trimEnd()}…` : value;
}

export function extractInsightMetadata(html: string, fileName: string): Pick<InsightResult, "fileName" | "title"> {
  const insightStart = html.search(/<[^>]+class=["'][^"']*\binsight\b[^"']*["'][^>]*>/i);
  const insightBlock = insightStart >= 0 ? html.slice(insightStart, insightStart + 6_000) : "";
  const insightTitle = insightBlock.match(/<[^>]+class=["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1];
  const documentTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const title = truncateInsightText(decodeHtmlText(insightTitle ?? documentTitle ?? fileName), 68);
  return { fileName, title };
}

export interface InsightAutomationState {
  initialized: boolean;
  knownCompletedIds: string[];
  queuedCompletedIds: string[];
  analysisSessionId?: string;
  results: InsightResult[];
}

export function createInsightAutomationState(): InsightAutomationState {
  return { initialized: false, knownCompletedIds: [], queuedCompletedIds: [], results: [] };
}

export function isInsightTaskSession(session: Pick<SessionInfo, "firstMessage">): boolean {
  return session.firstMessage.includes(INSIGHT_TASK_MARKER);
}

export function observeCompletedTasks(
  state: InsightAutomationState,
  completedIds: string[],
): InsightAutomationState {
  const uniqueIds = [...new Set(completedIds)];
  if (!state.initialized) {
    return { ...state, initialized: true, knownCompletedIds: uniqueIds };
  }

  const known = new Set(state.knownCompletedIds);
  const queued = new Set(state.queuedCompletedIds);
  const newlyCompleted = uniqueIds.filter((id) => !known.has(id));
  if (!newlyCompleted.length) return state;
  newlyCompleted.forEach((id) => {
    known.add(id);
    queued.add(id);
  });
  return {
    ...state,
    knownCompletedIds: [...known],
    queuedCompletedIds: [...queued],
  };
}

export function buildInsightAnalysisPrompt({
  taskTitles,
  reminders,
  timestamp,
}: {
  taskTitles: string[];
  reminders: InsightReminderContext[];
  timestamp: string;
}): string {
  const taskHistory = taskTitles.length
    ? taskTitles.map((title, index) => `${index + 1}. ${title}`).join("\n")
    : "（没有可用的历史任务标题）";
  const reminderHistory = reminders.length
    ? reminders.map((item, index) => (
        `${index + 1}. [${item.completed ? "已完成" : "待完成"}] ${item.title}（记录于 ${item.createdAt.slice(0, 10)}${item.sessionId ? "，已关联执行任务" : ""}）`
      )).join("\n")
    : "（没有待办事项历史）";

  return `${INSIGHT_TASK_MARKER}
你是 Pi Web 的后台洞察分析模块。这是一项静默分析任务，不要要求用户补充信息，也不要打开任何文件或窗口。只使用任务中提供的历史上下文和当前项目文件，不要调用或请求配置任何需要登录的外部服务。

请基于下面的历史任务标题和待办事项上下文，寻找跨任务的重复模式、潜在风险、未被满足的目标、可以复用的工作方式，以及对用户最终结果有明确帮助的下一步建议。

只有在存在具体、可执行、非显而易见的洞察时，才创建一个独立 HTML 报告。报告应清晰说明：观察依据、核心洞察、影响和建议行动。将最重要的单条洞察提炼为 18–28 个汉字、可独立理解的结论，并作为 HTML <title>；通知和洞察列表只展示这条结论。将文件保存为 .pi-insights/insight-${timestamp}.html，并使用适合直接阅读的完整 HTML/CSS。

如果没有足够有价值的洞察，不要创建、修改或覆盖任何 HTML 或其他文件，只需在最终回复中说明本轮没有生成洞察报告。

历史任务标题：
${taskHistory}

待办事项历史：
${reminderHistory}`;
}
