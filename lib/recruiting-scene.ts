export interface SceneReview { status: string; score: number; conclusion: string; opinion: string }
export interface SceneInterview { id: string; name: string; interviewer: string; scheduledAt: string; endedAt: string | null; review: SceneReview | null }
export interface SceneCandidate { id: string; jobId: string; name: string; school: string; company: string; years: number; source: string; skills: string[]; summary: string; projects: string[]; interviews: SceneInterview[]; screenedAt: string | null; currentStage: string; currentStageLabel: string; interviewsFinished: boolean; missingReviews: number; history: { at: string; text: string }[] }
export interface RecruitingScene {
  job: { id: string; title: string; target: number; location: string; department: string; owner: string; description: string; publishedAt: string } | null;
  candidates: SceneCandidate[];
  metrics: { applied: number; screened: number; interviewing: number; finished: number; passed: number; failed: number; missing: number; current: Record<string, number> };
  insight: { title: string; pairedCount: number; disagreementCount: number; interviewers: string[]; candidates: Pick<SceneCandidate, "id" | "name" | "interviews">[] } | null;
}
export type DemoMeeting = import("./feishu-calendar").FeishuCalendarEvent;
