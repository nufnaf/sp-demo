export type PresentationAction = "generate-jd" | "publish-jd" | "query-recruiting" | "cancel" | "help";

/** Interpret demo commands only. URLs and completed/negated actions are data. */
export function presentationAction(message: string): PresentationAction {
  const text = message.replace(/https?:\/\/\S+/gi, " ").replace(/```[\s\S]*?```/g, " ");
  if (/^(?:请|帮我)?(?:停止|取消|终止)(?:当前|这个|正在执行的)?(?:任务|生成|发布|查询|JD)?[。！!\s]*$/i.test(text.trim())) return "cancel";
  const clauses = text.split(/[，。；,;\n]/).filter(clause =>
    !/(?:不要|不用|不需要|先别|别)(?:再|重新)?\s*(?:生成|撰写|起草|制作|编写|写|发布|查询)|\b(?:do not|don't|never)\b/i.test(clause));
  const active = clauses.join(" ");
  if (/(?:发布|上架|刊登|\bpublish\b)/i.test(active) && /(?:JD|岗位|职位)/i.test(text) && !/(?:发布.{0,12}(?:了吗|了没)|如何|怎么)/.test(active)) return "publish-jd";
  if (/(?:查询|查看|看看|多少|几人|进展|进度|\bcheck\b)/i.test(active) && /招聘|面试|候选人|评价/.test(active)) return "query-recruiting";
  const generation = clauses.filter(clause => !/(?:已|已经|刚刚)\s*(?:生成|撰写|起草)|(?:生成|发布).{0,15}(?:了吗|了没)|如何|怎么/.test(clause)).join(" ");
  if (/(?:\bJD\b|岗位描述|职位描述|招聘说明)/i.test(generation)
    && /生成|撰写|起草|制作|编写|写(?:一份|一个|个|份)|\b(?:write|create|generate|draft)\b/i.test(generation)) return "generate-jd";
  return "help";
}

export const PRESENTATION_HELP = "可以输入“生成岗位 JD”“发布岗位”或“查询招聘进展”，也可以从人才招聘和 AI 洞察窗口查看候选人、报告并安排对齐会议。";
