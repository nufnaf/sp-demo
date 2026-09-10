import type { RecruitingScene } from "./recruiting-scene";

export interface RecruitingQueryResult {
  sessionId: string;
  question: string;
  checkedAt: string;
  jobId: string;
  title: string;
  summary: string;
  metrics: RecruitingScene["metrics"];
  missingCandidates: { id: string; name: string; missingReviews: number }[];
}

export function recruitingQueryResult(scene: RecruitingScene, sessionId: string, question: string, summary: string, checkedAt = new Date().toISOString()): RecruitingQueryResult {
  if (!scene.job) throw new Error("未找到查询对应的岗位。");
  return { sessionId, question, checkedAt, jobId: scene.job.id, title: scene.job.title, summary,
    metrics: structuredClone(scene.metrics),
    missingCandidates: scene.candidates.filter(c => c.interviewsFinished && c.missingReviews > 0)
      .map(({ id, name, missingReviews }) => ({ id, name, missingReviews })),
  };
}
