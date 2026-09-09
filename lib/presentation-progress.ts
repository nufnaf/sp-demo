import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { presentationRoot, presentationCwd } from "./presentation-runtime";
import { recruitingSiteUrl } from "./browser/business-sites";
import { addInsightResult } from "./insight-event-store";
import { renderRecruitingInsightReport, recruitingInsightSummary } from "./recruiting-insight-report";
import type { RecruitingScene, DemoMeeting } from "./recruiting-scene";
interface Progress { insight?: { filePath: string; title: string; modified: string; summary?: string }; meeting?: DemoMeeting }
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
      const generatedAt = new Date().toISOString();
      const summary = recruitingInsightSummary(data);
      const html = renderRecruitingInsightReport(data, generatedAt);
      await writeFile(filePath, html, { mode: 0o600 });
      progress.insight = { filePath, title: insight.title, modified: generatedAt, summary };
      addInsightResult({ ...progress.insight, summary, cwd, fileName: "recruiting-interviewer-alignment-report.html", sessionId: `presentation:${job.id}` });
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
