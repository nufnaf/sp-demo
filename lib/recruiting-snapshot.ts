import { recruitingSiteUrl } from "./browser/business-sites";
import type { PublishedRecruitingJob } from "./recruiting-publication";
import type { RecruitingScene } from "./recruiting-scene";

export interface RecruitingSnapshot {
  jobs: PublishedRecruitingJob[];
  scene: RecruitingScene | null;
}

/** Called only at an explicit publication/query boundary in the demo. */
export async function readRecruitingSnapshot(signal?: AbortSignal): Promise<RecruitingSnapshot> {
  const base = recruitingSiteUrl();
  // Bound the complete read (including the body), while preserving cancellation.
  const deadline = AbortSignal.timeout(30_000);
  const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
  let data;
  try {
    const response = await fetch(new URL("desktop/published-jobs", base), {
      cache: "no-store", redirect: "error", signal: requestSignal,
    });
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
  return { scene: data.scene ?? null, jobs: data.jobs.map((job: PublishedRecruitingJob) => ({
    ...job, url: new URL(`jobs/${encodeURIComponent(job.id)}`, base).href,
  })) };
}

/** Do not import another demo run's job or scene into this run. */
export function verifiedRecruitingSnapshot(data: RecruitingSnapshot, draft: string): RecruitingSnapshot {
  const job = data.jobs.find(item => item.draft === draft);
  if (!job) throw new Error("未找到当前工作台的已发布岗位，请核对网页后重试。");
  if (data.scene?.job?.id !== job.id) throw new Error("招聘统计与本轮岗位不一致，请重新查询招聘进展。");
  return { jobs: [job], scene: data.scene };
}
