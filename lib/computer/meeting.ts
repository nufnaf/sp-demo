import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CalendarEventDraft, FeishuCalendarClient, FeishuCalendarEvent } from "../feishu-calendar";
import { computerRuntime } from "./runtime";

interface GuiRequest { key: string; draft: CalendarEventDraft; eventId?: string; eventCalendarId?: string; gui?: { attempted: boolean; baseline: string[] } }
interface Executor { run: (id: string, draft: CalendarEventDraft, calendarName: string, beforeSubmit: () => Promise<void>) => Promise<void>; verified: (error?: string) => void }
declare global { var __syntropicGuiMeetingLocks: Map<string, Promise<FeishuCalendarEvent>> | undefined }
const normalized = (value: string) => value.replace(/\s+/g, " ").trim();
export function matchesGuiMeeting(event: FeishuCalendarEvent, draft: CalendarEventDraft) {
  return !event.allDay && event.status !== "cancelled" && event.title === draft.title
    && (!draft.description.trim() || (Date.parse(event.startsAt) === Date.parse(draft.startsAt) && Date.parse(event.endsAt) === Date.parse(draft.endsAt)))
    && normalized(event.description) === normalized(draft.description);
}

/** No GUI idempotency key exists: after Save might have run, retry ONLY reads. */
export async function ensureFeishuGuiMeeting(directory: string, id: string, draft: CalendarEventDraft, calendar: FeishuCalendarClient,
  executor: Executor = computerRuntime(), calendarName = calendar.calendarName, attempts = 12): Promise<FeishuCalendarEvent> {
  const folder = join(directory, "calendar-requests");
  const path = join(folder, `${createHash("sha256").update(`${calendar.identity}:${id}`).digest("hex")}.json`);
  const locks = globalThis.__syntropicGuiMeetingLocks ??= new Map();
  if (locks.has(path)) return locks.get(path)!;
  const work = (async () => {
    await mkdir(folder, { recursive: true });
    const save = async (request: GuiRequest) => { const tmp = `${path}.${randomUUID()}.tmp`; await writeFile(tmp, JSON.stringify(request), { mode: 0o600 }); await rename(tmp, path); };
    let request: GuiRequest;
    try { request = JSON.parse(await readFile(path, "utf8")); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("会议记录无法读取，已停止操作以避免重复创建。"); request = { key: randomUUID(), draft }; await save(request); }
    if (typeof request.key !== "string" || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(request.key) || !request.draft?.title || !Number.isFinite(Date.parse(request.draft.startsAt)) || !Number.isFinite(Date.parse(request.draft.endsAt))
      || typeof request.draft.description !== "string"
      || (request.gui && (typeof request.gui.attempted !== "boolean" || !Array.isArray(request.gui.baseline) || request.gui.baseline.some(value => typeof value !== "string")))) throw new Error("会议记录不完整，请检查后继续。");
    if (request.eventId) return calendar.get(request.eventId, request.eventCalendarId ?? calendar.calendarId);
    const range = () => calendar.eventsAcrossCalendars
      ? calendar.eventsAcrossCalendars(new Date(Date.parse(request.draft.startsAt) - (request.draft.description.trim() ? 3600_000 : 3 * 86400_000)).toISOString(), new Date(Date.parse(request.draft.endsAt) + (request.draft.description.trim() ? 3600_000 : 3 * 86400_000)).toISOString())
      : calendar.events(new Date(Date.parse(request.draft.startsAt) - (request.draft.description.trim() ? 3600_000 : 3 * 86400_000)).toISOString(), new Date(Date.parse(request.draft.endsAt) + (request.draft.description.trim() ? 3600_000 : 3 * 86400_000)).toISOString());
    const match = (events: FeishuCalendarEvent[]) => {
      const candidates = events.filter(event => matchesGuiMeeting(event, request.draft) && !request.gui?.baseline.includes(event.id));
      if (candidates.length > 1) throw new Error("发现多条相同会议，请在飞书中确认，系统不会再次创建。");
      return candidates[0];
    };
    const complete = async (event: FeishuCalendarEvent) => { await save({ ...request, eventId: event.id, eventCalendarId: event.calendarId }); executor.verified(); return event; };
    // Startup reset already removes every demo-owned title from all visible
    // calendars. A fresh request therefore has no preflight baseline to read;
    // open Computer Use immediately and enumerate calendars only when a Save
    // has crossed the uncertain-write boundary (or a retry is recovering it).
    const existing = request.gui?.attempted ? await range() : [];
    const recovered = match(existing);
    if (recovered) return complete(recovered);
    if (request.gui?.attempted) throw new Error("上次保存结果尚未确认。请检查飞书日历后重试核验，系统不会重复保存。");
    request.gui = { attempted: false, baseline: existing.map(event => event.id) }; await save(request);
    try {
      await executor.run(request.key, request.draft, calendarName ?? "", async () => { request.gui!.attempted = true; await save(request); });
    } catch (error) {
      if (!request.gui.attempted) throw error;
      // The worker can disappear after input. Always reconcile this same request.
    }
    for (let attempt = 0; attempt < attempts; attempt++) {
      const found = match(await range());
      if (found) return complete(found);
      if (attempt < attempts - 1) await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error("尚未在飞书日历中确认会议。请检查客户端后重试核验，系统不会重复保存。");
  })();
  locks.set(path, work);
  try { return await work; }
  catch (error) { executor.verified(error instanceof Error ? error.message : "会议核验未完成"); throw error; }
  finally { if (locks.get(path) === work) locks.delete(path); }
}
