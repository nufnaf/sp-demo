import { recruitingSiteUrl } from "./browser/business-sites";
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { PublishedRecruitingJob } from "./recruiting-publication";
import type { RecruitingScene } from "./recruiting-scene";

export interface RecruitingSnapshot {
  jobs: PublishedRecruitingJob[];
  scene: RecruitingScene | null;
}

async function diagnostic(event: string, details: Record<string, unknown> = {}) {
  const root = globalThis.process?.env?.SYNTROPIC_PRESENTATION_ROOT;
  if (!root) return;
  try {
    const directory = join(root, "diagnostics");
    await mkdir(directory, { recursive: true });
    await appendFile(join(directory, "recruiting-publication.ndjson"), `${JSON.stringify({ at: new Date().toISOString(), event, ...details })}\n`, { mode: 0o600 });
  } catch { /* Diagnostics must never change the publication result. */ }
}

/** Called only at an explicit publication/query boundary in the demo. */
export async function readRecruitingSnapshot(signal?: AbortSignal): Promise<RecruitingSnapshot> {
  const base = recruitingSiteUrl();
  await diagnostic("snapshot.request", { url: new URL("desktop/published-jobs", base).href });
  // Bound the complete read (including the body), while preserving cancellation.
  const deadline = AbortSignal.timeout(30_000);
  const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
  let data;
  try {
    const response = await fetch(new URL("desktop/published-jobs", base), {
      cache: "no-store", redirect: "error", signal: requestSignal,
    });
    await diagnostic("snapshot.response", { status: response.status });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`招聘网站暂时无法返回岗位信息（HTTP ${response.status}），请稍后重试。`);
    }
    data = await response.json();
  } catch (error) {
    signal?.throwIfAborted();
    if (deadline.aborted) throw new Error("招聘网站响应超时（已等待 30 秒），请检查网络后重试。");
    if (error instanceof TypeError) throw new Error("暂时无法连接招聘网站，请检查网络后重试。");
    if (error instanceof SyntaxError) throw new Error("招聘网站返回的数据无效，请稍后重试。");
    throw error;
  }
  if (data.app !== "syntropic-recruiting" || !Array.isArray(data.jobs)) throw new Error("招聘系统返回了无法识别的结果。");
  await diagnostic("snapshot.payload", { jobs: data.jobs.map((job: { id?: unknown; draft?: unknown }) => ({ id: job.id, draft: job.draft })), sceneJobId: data.scene?.job?.id ?? null });
  return { scene: data.scene ?? null, jobs: data.jobs.map((job: PublishedRecruitingJob) => ({
    ...job, url: new URL(`jobs/${encodeURIComponent(job.id)}`, base).href,
  })) };
}

/** Do not import another demo run's job or scene into this run. */
export function verifiedRecruitingSnapshot(data: RecruitingSnapshot, draft: string): RecruitingSnapshot {
  // The demo site owns its persisted draft id and may replace the query-string
  // draft hash with a UUID when it publishes. The endpoint is already scoped
  // to this presentation run, so when it returns exactly one job whose scene
  // points at that same job, accept that authoritative result and retain it.
  const siteOwnedDraft = data.jobs.length === 1 && data.scene?.job && data.jobs[0].id === data.scene.job.id
    && typeof data.jobs[0].draft === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.jobs[0].draft);
  const job = data.jobs.find(item => item.draft === draft)
    ?? (siteOwnedDraft ? data.jobs[0] : undefined);
  void diagnostic("snapshot.verify", { requestedDraft: draft, returnedDrafts: data.jobs.map(item => item.draft), returnedJobIds: data.jobs.map(item => item.id), sceneJobId: data.scene?.job?.id ?? null, matched: Boolean(job), matchedJobId: job?.id ?? null });
  if (!job) throw new Error("未找到当前工作台的已发布岗位，请核对网页后重试。");
  if (data.scene?.job?.id !== job.id) throw new Error("招聘统计与本轮岗位不一致，请重新查询招聘进展。");
  return { jobs: [job], scene: data.scene };
}
