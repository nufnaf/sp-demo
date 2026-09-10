import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { presentationRoot } from "./presentation-runtime";
import { emitFileEvent } from "./files-app/events";
import { verifiedRecruitingSnapshot, type RecruitingSnapshot } from "./recruiting-snapshot";
import { addInsightResult } from "./insight-event-store";
import { renderRecruitingInsightReport, recruitingInsightSummary } from "./recruiting-insight-report";
import { scheduleFeishuAlignmentMeeting } from "./feishu-meeting";
import type { DemoMeeting } from "./recruiting-scene";
interface Progress { recruiting?: RecruitingSnapshot; insight?: { filePath: string; title: string; modified: string; summary?: string }; meeting?: DemoMeeting }
declare global { var __syntropicProgressTail: Promise<unknown> | undefined; }
export async function readProgress(root = presentationRoot()): Promise<Progress> {
  if (!root) return {};
  try {
    const progress = JSON.parse(await readFile(join(root, "progress.json"), "utf8"));
    if (progress.meeting?.source !== "feishu") delete progress.meeting;
    return progress;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new Error("工作台记录无法读取，请联系管理员检查。");
  }
}

function updateProgress(update: (progress: Progress, cwd: string) => Promise<void>, root = presentationRoot()): Promise<Progress> {
  const operation = (globalThis.__syntropicProgressTail ?? Promise.resolve()).then(async () => {
    if (!root) throw new Error("当前工作台不可用");
    const cwd = join(root, "workspace");
    const progress = await readProgress(root);
    await update(progress, cwd);
    const temporary = join(root, `progress-${randomUUID()}.tmp`);
    await writeFile(temporary, JSON.stringify(progress), { mode: 0o600 });
    await rename(temporary, join(root, "progress.json"));
    emitFileEvent({ type: "presentation.updated", cwd });
    return progress;
  });
  globalThis.__syntropicProgressTail = operation.catch(() => {});
  return operation;
}

async function ensureRecruitingInsight(progress: Progress, cwd: string) {
    const data = progress.recruiting?.scene;
    if (!data?.job || !data.insight) return;
    const insight = data.insight; const job = data.job;
    if (!progress.insight && insight.disagreementCount) {
      const directory = join(cwd, ".pi-web", "insights"); await mkdir(directory, { recursive: true });
      const filePath = join(directory, "recruiting-interviewer-alignment-report.html");
      const generatedAt = new Date().toISOString();
      const summary = recruitingInsightSummary(data);
      const html = renderRecruitingInsightReport(data, generatedAt);
      await writeFile(filePath, html, { mode: 0o600 });
      progress.insight = { filePath, title: insight.title, modified: generatedAt, summary };
      addInsightResult({ ...progress.insight, summary, cwd, fileName: "recruiting-interviewer-alignment-report.html", sessionId: `presentation:${job.id}` });
    }
}

export function saveRecruitingProgress(data: RecruitingSnapshot, draft: string, root = presentationRoot()): Promise<Progress> {
  return updateProgress(async (progress) => {
    const verified = verifiedRecruitingSnapshot(data, draft);
    // Only a verified current-run website result can produce the mock receipt.
    // Derive it from the same job so retries and later queries preserve identity.
    progress.recruiting = {
      ...verified,
      jobs: verified.jobs.map(job => ({
        ...job,
        bossPublication: { mode: "demo", status: "published", publishedAt: job.publishedAt },
      })),
    };
  }, root);
}

export function advancePresentation(action: "insight" | "meeting"): Promise<Progress> {
  return updateProgress(async (progress, cwd) => {
    const data = progress.recruiting?.scene;
    if (!data?.job || !data.insight) throw new Error("请先通过网页发布岗位并查看招聘进展");
    if (action === "insight") await ensureRecruitingInsight(progress, cwd);
    if (action === "meeting") {
      if (!progress.insight) throw new Error("请先查看招聘洞察");
      progress.meeting = await scheduleFeishuAlignmentMeeting(dirname(cwd), data);
    }
  });
}
