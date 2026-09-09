import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { presentationRoot, presentationCwd } from "./presentation-runtime";
import { recruitingSiteUrl } from "./browser/business-sites";
import { addInsightResult } from "./insight-event-store";
import type { RecruitingScene, DemoMeeting } from "./recruiting-scene";
interface Progress { insight?: { filePath: string; title: string; modified: string }; meeting?: DemoMeeting }
let tail: Promise<unknown> = Promise.resolve();
export async function readProgress(): Promise<Progress> {
  if (!presentationRoot()) return {};
  try { return JSON.parse(await readFile(join(presentationRoot()!, "progress.json"), "utf8")); } catch { return {}; }
}
async function scene(): Promise<RecruitingScene> {
  const response = await fetch(new URL("/desktop/published-jobs", recruitingSiteUrl()), { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("招聘数据暂时不可用");
  const data = await response.json();
  if (!data.scene?.job || !data.scene?.insight) throw new Error("请先通过网页发布岗位并查看招聘进展");
  return data.scene;
}
const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
export function advancePresentation(action: "insight" | "meeting"): Promise<Progress> {
  const operation = tail.then(async () => {
    const root = presentationRoot(); const cwd = presentationCwd();
    if (!root || !cwd) throw new Error("当前工作台不可用");
    const progress = await readProgress();
    const data = await scene();
    const insight = data.insight!; const job = data.job!;
    if (action === "insight" && !progress.insight && insight.disagreementCount) {
      const directory = join(cwd, ".pi-web", "insights"); await mkdir(directory, { recursive: true });
      const filePath = join(directory, "recruiting-interviewer-alignment-report.html");
      const rows = insight.candidates.map((c) => `<tr><td>${escape(c.name)}<small>${escape(c.id)}</small></td>${c.interviews.map((r) => `<td><b>${escape(r.interviewer)} · ${r.review?.score} 分</b><p>${escape(r.review?.opinion ?? "")}</p></td>`).join("")}</tr>`).join("");
      const html = `<!doctype html><html lang="zh"><meta charset="utf-8"><title>${escape(insight.title)}</title><style>body{margin:0;padding:42px;background:#f5f7f3;color:#233e32;font:16px/1.7 system-ui}small{display:block;color:#76847b}h1{font-size:30px}section{background:white;border:1px solid #dde6dd;border-radius:18px;padding:24px;margin:20px 0}.numbers{display:flex;gap:60px}.numbers b{font-size:36px}table{width:100%;border-collapse:collapse}td,th{padding:18px;text-align:left;vertical-align:top;border-bottom:1px solid #e3e8e2}button{background:#277758;color:white;border:0;padding:14px 22px;border-radius:10px;font:inherit;cursor:pointer}</style><body><small>SYNTROPIC INSIGHTS · 星流科技</small><h1>${escape(insight.title)}</h1><p>候选人具备的生产交付证据，在不同面试官的评分中得到不同权重。</p><section class="numbers"><div><b>${insight.pairedCount}</b><small>评价已齐的候选人</small></div><div><b>${insight.disagreementCount}</b><small>推进判断存在分歧</small></div><div><b>${data.metrics.missing}</b><small>面试结束但评价未齐（另计）</small></div></section><section><h2>回到候选人的实际评价</h2><table>${rows}</table></section><section><h2>建议统一面试标准</h2><p>使用共同的证据评分表：工具编排与系统边界、生产交付与故障恢复、评测与可观测性、沟通与学习能力。院校经历作为背景，不直接替代工程证据。</p><p>由 ${escape(insight.interviewers.join("、"))} 与 ${escape(job.owner)} 对照以上案例校准判断，再复核存在分歧的候选人。</p></section><section><h2>安排标准对齐会议</h2><p>30 分钟 · 确认评价标准、讨论分歧案例、约定后续复核</p><button id="schedule">安排对齐会议</button><p id="result"></p></section><script>document.getElementById('schedule').onclick=async function(){this.disabled=true;try{const r=await fetch('/api/apps/company-careers/actions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'schedule_alignment_meeting'})});const d=await r.json();if(!r.ok)throw Error(d.error);document.getElementById('result').textContent='已加入团队日程 · '+d.meeting.title;this.textContent='会议已安排';}catch(e){document.getElementById('result').textContent=e.message;this.disabled=false;}};</script></body></html>`;
      await writeFile(filePath, html, { mode: 0o600 });
      progress.insight = { filePath, title: insight.title, modified: new Date().toISOString() };
      addInsightResult({ ...progress.insight, summary: `评价已齐的 ${insight.pairedCount} 位候选人中，${insight.disagreementCount} 位存在推进判断分歧。建议对照生产交付证据，统一面试评分标准。`, cwd, fileName: "recruiting-interviewer-alignment-report.html", sessionId: `presentation:${job.id}` });
    }
    if (action === "meeting" && !progress.meeting) {
      if (!progress.insight) throw new Error("请先查看招聘洞察");
      const startsAt = new Date(); startsAt.setDate(startsAt.getDate() + 1); startsAt.setHours(14, 0, 0, 0);
      progress.meeting = { id: `alignment-${job.id}`, title: `星流科技 · ${job.title}面试标准对齐`, startsAt: startsAt.toISOString(), endsAt: new Date(startsAt.getTime() + 30 * 60000).toISOString(), attendees: [...insight.interviewers, job.owner], agenda: ["对齐生产级 Agent 工程能力的证据标准", `讨论 ${insight.candidates.map((c) => c.name).join("、")} 的评价分歧`, "确定共同评分表和候选人复核分工"], simulated: true };
    }
    const temporary = join(root, `progress-${randomUUID()}.tmp`); await writeFile(temporary, JSON.stringify(progress), { mode: 0o600 }); await rename(temporary, join(root, "progress.json"));
    return progress;
  });
  tail = operation.catch(() => {}); return operation;
}
