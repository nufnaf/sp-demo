/** Presentation timings; saved documents and actual task results remain complete. */
export const JD_PREPARATION_MS = 2500;
export const JD_PREVIEW_DURATION_MS = 18_000;
export const JD_INSIGHT_DELAY_MS = 2000;

export function jdInsightReadyAt(writtenAt: number, playback: { active: boolean; completedAt?: number }) {
  if (!Number.isFinite(writtenAt)) return null;
  if (playback.completedAt !== undefined) return playback.completedAt + JD_INSIGHT_DELAY_MS;
  // Wait for visible playback, but never require an open viewer to finish the workflow.
  if (playback.active) return null;
  return writtenAt + JD_PREVIEW_DURATION_MS + JD_INSIGHT_DELAY_MS;
}
