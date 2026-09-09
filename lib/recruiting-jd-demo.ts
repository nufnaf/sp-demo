import { randomUUID } from "node:crypto";
import { readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { presentationCwd, presentationSessionDir } from "./presentation-runtime";
import { JARVIS_TASK_ORIGIN_TYPE, type JarvisTaskInfo } from "./jarvis";
import { renderRecruitingJdDemo } from "./recruiting-jd-demo-renderer";
import { RECRUITING_JD_DEMO } from "./recruiting-jd-fixture";

export function isRecruitingJdDemoRequest(cwd: string, message: string): boolean {
  const expected = presentationCwd();
  return !!expected && resolve(cwd) === resolve(expected)
    && /(?:\bJD\b|岗位描述|职位描述|招聘说明)/i.test(message)
    && /生成|撰写|起草|制作|编写|写[一份个]|write|creat|draft/i.test(message)
    && !/(?:不要|别|不用|先别|不需要)(?:再)?(?:生成|撰写|起草|制作|编写|写)[^，。；,;]{0,20}(?:\bJD\b|岗位描述|职位描述|招聘说明)|仅讨论|只讨论|如何|怎么|生成.{0,30}(?:了吗|了没)/i.test(message);
}

/** Explicit simulated provenance, zero model usage. The file operation is real. */
export function demoAssistant(text: string, extra: Partial<AssistantMessage> = {}): AssistantMessage {
  return { role: "assistant", content: [{ type: "text", text }], api: "openai-responses", provider: "syntropic-demo", model: "fixed-jd",
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, stopReason: "stop", timestamp: Date.now(), ...extra };
}

export async function saveRecruitingJdDemo(cwd: string, signal?: AbortSignal) {
  const expected = presentationCwd();
  if (!expected || resolve(cwd) !== resolve(expected) || await realpath(cwd) !== await realpath(expected)) throw new Error("此操作仅用于当前招聘工作台。");
  signal?.throwIfAborted();
  const html = renderRecruitingJdDemo();
  const path = join(cwd, "ai-agent-engineer-jd.html");
  const temporary = join(cwd, `.jd-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, html, { encoding: "utf8", mode: 0o600, flag: "wx" });
    if (await readFile(temporary, "utf8") !== html) throw new Error("岗位文件写入核对失败。");
    signal?.throwIfAborted();
    await rename(temporary, path);
    return { path, title: RECRUITING_JD_DEMO.title, verified: true, simulated: true };
  } finally { await rm(temporary, { force: true }); }
}

export function createRecruitingJdDemoTask(cwd: string, jarvisSessionId: string, message: string) {
  if (!isRecruitingJdDemoRequest(cwd, message)) throw new Error("不是当前招聘演示的 JD 生成请求。");
  const manager = SessionManager.create(cwd, presentationSessionDir(cwd));
  const task: JarvisTaskInfo = { sessionId: manager.getSessionId(), jarvisSessionId, description: "生成岗位 JD", status: "running", createdAt: new Date().toISOString() };
  manager.appendCustomEntry(JARVIS_TASK_ORIGIN_TYPE, { version: 1, jarvisSessionId, description: task.description, createdAt: task.createdAt });
  manager.appendCustomEntry("syntropic:demo", { kind: "recruiting-jd", version: 1, simulated: true });
  manager.appendSessionInfo(task.description);
  manager.appendMessage({ role: "user", content: message, timestamp: Date.now() });
  manager.appendMessage(demoAssistant("正在准备岗位 JD…"));
  return { task, manager, async run(signal: AbortSignal) {
    try {
      await delay(1500, undefined, { signal });
      const saved = await saveRecruitingJdDemo(cwd, signal);
      const toolCallId = randomUUID();
      manager.appendMessage(demoAssistant("", { stopReason: "toolUse", content: [{ type: "toolCall", id: toolCallId, name: "save_recruiting_jd", arguments: { path: saved.path } }] }));
      manager.appendMessage({ role: "toolResult", toolCallId, toolName: "save_recruiting_jd", content: [{ type: "text", text: JSON.stringify(saved) }], details: saved, isError: false, timestamp: Date.now() });
      task.status = "completed";
      task.summary = "星流科技的高级 AI Agent 研发工程师 JD 已准备好，可以打开查看并发布岗位。";
      manager.appendMessage(demoAssistant(task.summary));
    } catch (error) {
      task.status = signal.aborted ? "aborted" : "failed";
      task.summary = signal.aborted ? "JD 准备已停止。" : `JD 准备失败：${error instanceof Error ? error.message : String(error)}`;
      manager.appendMessage(demoAssistant(task.summary, { stopReason: signal.aborted ? "aborted" : "error", ...(signal.aborted ? {} : { errorMessage: task.summary }) }));
    }
    task.completedAt = new Date().toISOString();
    return task;
  } };
}
