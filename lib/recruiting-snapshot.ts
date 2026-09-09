import { recruitingSiteUrl } from "./browser/business-sites";
import type { PublishedRecruitingJob } from "./recruiting-publication";
import type { RecruitingScene } from "./recruiting-scene";

export interface RecruitingSnapshot {
  jobs: PublishedRecruitingJob[];
  scene: RecruitingScene | null;
}

/** Called only at an explicit publication/query boundary in the demo. */
export async function readRecruitingSnapshot(): Promise<RecruitingSnapshot> {
  const base = recruitingSiteUrl();
  const response = await fetch(new URL("desktop/published-jobs", base), {
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("暂时无法核对招聘网页的保存结果。");
  const data = await response.json();
  if (data.app !== "syntropic-recruiting" || !Array.isArray(data.jobs)) throw new Error("招聘系统返回了无法识别的结果。");
  return { scene: data.scene ?? null, jobs: data.jobs.map((job: PublishedRecruitingJob) => ({
    ...job, url: new URL(`jobs/${encodeURIComponent(job.id)}`, base).href,
  })) };
}

/** Do not import another demo run's job or scene into this run. */
export function verifiedRecruitingSnapshot(data: RecruitingSnapshot, draft: string): RecruitingSnapshot {
  const job = data.jobs.find(item => item.draft === draft);
  if (!job) throw new Error("未找到本轮演示的已发布岗位，请核对网页后重试。");
  if (data.scene?.job?.id !== job.id) throw new Error("招聘统计与本轮岗位不一致，请重新查询招聘进展。");
  return { jobs: [job], scene: data.scene };
}
