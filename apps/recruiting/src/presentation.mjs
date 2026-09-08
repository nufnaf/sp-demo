import { metrics, stage, STAGES, interviewsFinished, missingReviews } from './domain.mjs';

export function presentationProjection(data) {
  if (!data.presentation) return null;
  const job = data.jobs.find((item) => item.id === data.presentation.jobId);
  if (!job) return { job: null, candidates: [], metrics: metrics([]), insight: null };
  const candidates = data.applications.filter((item) => item.jobId === job.id).map((item) => ({ ...item, currentStage: stage(item), currentStageLabel: STAGES[stage(item)], interviewsFinished: interviewsFinished(item), missingReviews: missingReviews(item).length }));
  const paired = candidates.filter((c) => c.interviews.length >= 2 && c.interviews.every((r) => r.review?.status === 'submitted'));
  const disagreements = paired.filter((c) => new Set(c.interviews.map((r) => r.review.conclusion === 'no' ? 'no' : 'yes')).size > 1);
  return { job, candidates, metrics: metrics(candidates), insight: {
    title: `${job.title} · 面试官评价标准不一致`,
    pairedCount: paired.length, disagreementCount: disagreements.length,
    candidates: disagreements.map((c) => ({ id: c.id, name: c.name, interviews: c.interviews })),
    interviewers: [...new Set(paired.flatMap((c) => c.interviews.map((r) => r.interviewer)))],
  } };
}
