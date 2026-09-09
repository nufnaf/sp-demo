import type { RecruitingScene, SceneCandidate } from "./recruiting-scene.ts";

export const recruitingStages: Record<string, string> = {
  applied: "待简历筛选", screened: "待安排面试", interviewing: "面试进行中",
  pending: "面试结束 · 待结论", passed: "面试通过", failed: "面试失败", rejected: "简历未通过",
};
export function recruitingMetrics(scene: RecruitingScene) {
  return [
    { label: "累计投递", count: scene.metrics.applied, filter: "" },
    { label: "累计简历通过", count: scene.metrics.screened, filter: "cumulative:screened" },
    { label: "累计进入面试", count: scene.metrics.interviewing, filter: "cumulative:interviewing" },
    { label: "面试全部结束", count: scene.metrics.finished, filter: "cumulative:finished" },
    { label: "结束但评价未齐", count: scene.metrics.missing, filter: "missing" },
  ];
}
export function filterRecruitingCandidates(candidates: SceneCandidate[], filter: string, query: string) {
  const term = query.trim().toLowerCase();
  return candidates.filter(c => (!term || `${c.name} ${c.id} ${c.school} ${c.company} ${c.skills.join(" ")}`.toLowerCase().includes(term)) &&
    (!filter || (filter === "missing" ? c.interviewsFinished && c.missingReviews > 0
      : filter === "cumulative:screened" ? Boolean(c.screenedAt)
      : filter === "cumulative:interviewing" ? c.interviews.length > 0
      : filter === "cumulative:finished" ? c.interviewsFinished : c.currentStage === filter)));
}
