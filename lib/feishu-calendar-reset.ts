import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { calendarDate } from "./calendar-view";
import type { CalendarEventDraft, FeishuCalendarClient } from "./feishu-calendar";
import { DEMO_CALENDAR_MARKER, COMPUTER_CALENDAR_MARKER, demoCalendarDescription } from "./feishu-demo-calendar-marker";
import { ensureFeishuMeeting } from "./feishu-meeting";

interface ResetState { date: string; staleIds: string[]; complete: boolean }
declare global { var __syntropicCalendarResetLocks: Map<string, Promise<void>> | undefined }

export function presetCalendarDrafts(date: string): CalendarEventDraft[] {
  return [
    { title: "招聘进展周会", startsAt: `${date}T10:00:00+08:00`, endsAt: `${date}T10:30:00+08:00`, description: demoCalendarDescription("梳理招聘进展、候选人状态及本周重点。") },
    { title: "用人需求沟通", startsAt: `${date}T15:00:00+08:00`, endsAt: `${date}T15:30:00+08:00`, description: demoCalendarDescription("沟通岗位需求、能力要求及招聘优先级。") },
  ];
}

/** Called in the background after desktop entry, once per run and calendar identity.
 * Persist the old-event snapshot BEFORE deleting: a retry must never delete the
 * presets it already created. Creation requests themselves are durable/idempotent.
 */
export async function resetPresentationCalendar(root: string, calendar: FeishuCalendarClient, now = new Date()): Promise<void> {
  const directory = join(root, "calendar-reset", createHash("sha256").update(calendar.identity).digest("hex"));
  const file = join(directory, "state.json");
  const locks = globalThis.__syntropicCalendarResetLocks ??= new Map();
  const active = locks.get(file);
  if (active) return active;
  const work = (async () => {
    await mkdir(directory, { recursive: true });
    const save = async (state: ResetState) => {
      const temp = `${file}.${randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify(state), { mode: 0o600 });
      await rename(temp, file);
    };
    let state: ResetState | undefined;
    try { state = JSON.parse(await readFile(file, "utf8")); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("日程同步记录无法读取，请重新打开 App。");
    }
    if (state && (!/^\d{4}-\d{2}-\d{2}$/.test(state.date) || !Array.isArray(state.staleIds) || !state.staleIds.every(id => typeof id === "string") || typeof state.complete !== "boolean")) throw new Error("日程同步记录不完整，请重新打开 App。");
    if (state?.complete) return;
    // Read every page before any mutation. Cancelled tombstones are excluded.
    const events = await calendar.allEvents();
    if (!state) {
      state = {
        date: calendarDate(now), complete: false,
        staleIds: events.filter(event => event.description.split("\n").some(line => [DEMO_CALENDAR_MARKER, COMPUTER_CALENDAR_MARKER].includes(line.trim())) || calendar.resetEventIds.includes(event.id)).map(event => event.id),
      };
      await save(state);
    }
    const currentIds = new Set(events.map(event => event.id));
    for (const id of state.staleIds) if (currentIds.has(id)) await calendar.remove(id);
    const drafts = presetCalendarDrafts(state.date);
    for (let index = 0; index < drafts.length; index++) await ensureFeishuMeeting(directory, `preset-${index}`, drafts[index], calendar);
    await save({ ...state, complete: true });
  })();
  locks.set(file, work);
  try { await work; }
  finally { if (locks.get(file) === work) locks.delete(file); }
}
