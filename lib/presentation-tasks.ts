import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { presentationCwd, presentationSessionDir, presentationRoot } from "./presentation-runtime";
import { JARVIS_TASK_ORIGIN_TYPE, type JarvisTaskInfo } from "./jarvis";
import { createRecruitingJdDemoTask, demoAssistant } from "./recruiting-jd-demo";
import { recruitingSiteUrl } from "./browser/business-sites";
import { recruitingPublicationTask } from "./browser/recruiting-publication";
import type { PresentationAction } from "./presentation-actions";
import { readRecruitingSnapshot } from "./recruiting-snapshot";
import { saveRecruitingProgress } from "./presentation-progress";

export function publicationDraft(cwd: string): string {
  return createHash("sha256").update(`${cwd}\n${join(cwd, "ai-agent-engineer-jd.html")}`).digest("hex").slice(0, 32);
}

/** A persisted local task, with the browser Agent as its only model boundary. */
export function createPresentationTask(cwd: string, parentId: string, message: string, action: Exclude<PresentationAction, "help" | "cancel">) {
  if (cwd !== presentationCwd()) throw new Error("请切换到招聘工作台后执行此操作。");
  if (action === "generate-jd") return createRecruitingJdDemoTask(cwd, parentId, message);
  const root = presentationRoot();
  const manager = SessionManager.create(cwd, presentationSessionDir(cwd));
  const task: JarvisTaskInfo = { sessionId: manager.getSessionId(), jarvisSessionId: parentId, description: action === "publish-jd" ? "发布岗位 · 高级 AI Agent 研发工程师" : "查询招聘进展", status: "running", createdAt: new Date().toISOString() };
  manager.appendCustomEntry(JARVIS_TASK_ORIGIN_TYPE, { version: 1, jarvisSessionId: parentId, description: task.description, createdAt: task.createdAt });
  manager.appendCustomEntry("syntropic:demo", { kind: action, version: 1, simulated: true });
  manager.appendSessionInfo(task.description);
  manager.appendMessage({ role: "user", content: message, timestamp: Date.now() });
  return { task, manager, async run(signal: AbortSignal) {
    try {
      signal.throwIfAborted();
      let snapshot = await readRecruitingSnapshot();
      const published = snapshot.jobs.find(job => job.draft === publicationDraft(cwd));
      if (action === "publish-jd" && published) {
        task.summary = `“${published.title}”已发布，可在人才招聘中查看，无需重复创建。`;
      } else {
        if (action === "query-recruiting" && !published) throw new Error("请先生成并发布岗位，再查询招聘进展。");
        const url = action === "publish-jd" ? new URL("jobs/new", recruitingSiteUrl()) : new URL(`jobs/${encodeURIComponent(published!.id)}`, recruitingSiteUrl());
        if (action === "publish-jd") url.searchParams.set("draft", publicationDraft(cwd));
        const browserPrompt = action === "publish-jd"
          ? await recruitingPublicationTask(cwd, url.href, "ai-agent-engineer-jd.html")
          : `只读查询当前岗位“${published!.title}”的招聘进展。用户关心：${message}\n通过招聘网页核对候选人、面试和评价记录，说明累计统计与当前状态的区别。不修改、提交、删除任何业务数据，不安排或发送邀请。`;
        signal.throwIfAborted();
        const { startBrowserTask } = await import("./browser/tasks");
        const run = startBrowserTask({ cwd, parentSessionId: task.sessionId, url: url.href, task: browserPrompt }, signal);
        const toolCallId = randomUUID();
        manager.appendMessage(demoAssistant("", { stopReason: "toolUse", content: [{ type: "toolCall", id: toolCallId, name: "browser_task", arguments: { url: url.href, task: task.description } }] }));
        const result = await run.completion;
        manager.appendMessage({ role: "toolResult", toolCallId, toolName: "browser_task", content: [{ type: "text", text: result.result || result.error || result.status }], details: result, isError: result.status !== "completed", timestamp: Date.now() });
        signal.throwIfAborted();
        if (result.status !== "completed") throw new Error(result.error || result.result || "网页任务未完成。");
        snapshot = await readRecruitingSnapshot();
        signal.throwIfAborted();
        if (action === "publish-jd") {
          const saved = snapshot.jobs.find(job => job.draft === publicationDraft(cwd));
          if (!saved) throw new Error("浏览器任务已结束，但未找到已发布岗位，请核对网页后重试。");
          task.summary = `“${saved.title}”已发布，${saved.location}，招聘 ${saved.headcount} 人。可以查看招聘进展。`;
        } else task.summary = result.result || "招聘进展已核对，可以查看招聘窗口。";
      }
      signal.throwIfAborted();
      await saveRecruitingProgress(snapshot, publicationDraft(cwd), root);
      if (action === "publish-jd") task.summary += " 已同步生成 BOSS 直聘的模拟发布结果。";
      task.status = "completed";
      manager.appendMessage(demoAssistant(task.summary));
    } catch (error) {
      task.status = signal.aborted ? "aborted" : "failed";
      task.summary = signal.aborted ? "任务已停止；已提交的网页操作请在招聘窗口核对。" : error instanceof Error ? error.message : String(error);
      manager.appendMessage(demoAssistant(task.summary, { stopReason: signal.aborted ? "aborted" : "error", ...(signal.aborted ? {} : { errorMessage: task.summary }) }));
    }
    task.completedAt = new Date().toISOString();
    return task;
  } };
}
