import type { JarvisTask, JarvisTurn } from "../hooks/useJarvis";

/** Keep each task at its original position while updating it to its latest state. */
export function compactDesktopTurns(turns: JarvisTurn[], tasks: JarvisTask[]): JarvisTurn[] {
  const latest = new Map<string, JarvisTask>();
  for (const turn of turns) if (turn.task) latest.set(turn.task.sessionId, turn.task);
  for (const task of tasks) latest.set(task.sessionId, task);
  const seen = new Set<string>();
  return turns.flatMap((turn) => {
    if (turn.role !== "task" || !turn.task) return [turn];
    const id = turn.task.sessionId;
    if (seen.has(id)) return [];
    seen.add(id);
    const task = latest.get(id)!;
    return [{ ...turn, task, taskEvent: task.status === "running" ? "started" as const : "settled" as const }];
  });
}
