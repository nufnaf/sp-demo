import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { getFeishuDemoClient } from "./feishu-demo-client";
import type { CalendarEventDraft, FeishuCalendarClient, FeishuCalendarEvent } from "./feishu-calendar";
import type { RecruitingScene } from "./recruiting-scene";
import { addCalendarDays, calendarDate } from "./calendar-view";
import { demoCalendarDescription, computerCalendarDescription, SYNTROPIC_ALIGNMENT_EVENT_TITLE } from "./feishu-demo-calendar-marker";
import { computerAvailable } from "./computer/runtime";
import { ensureFeishuGuiMeeting } from "./computer/meeting";
import { presentationRoot } from "./presentation-runtime";

interface MeetingRequest { key: string; draft: CalendarEventDraft; eventId?: string }
declare global { var __syntropicFeishuMeetingLocks: Map<string, Promise<FeishuCalendarEvent>> | undefined }

/** Persist the request before sending it: retries after a lost response use the same key and times. */
export async function ensureFeishuMeeting(directory: string, id: string, draft: CalendarEventDraft, calendar: FeishuCalendarClient): Promise<FeishuCalendarEvent> {
  const name = createHash("sha256").update(`${calendar.identity}:${id}`).digest("hex");
  const folder = join(directory, "calendar-requests"), path = join(folder, `${name}.json`);
  const locks = globalThis.__syntropicFeishuMeetingLocks ??= new Map();
  const active = locks.get(path);
  if (active) return active;
  const work = (async () => {
    await mkdir(folder, { recursive: true });
    const save = async (request: MeetingRequest) => {
      const temporary = `${path}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(request), { mode: 0o600 });
      await rename(temporary, path);
    };
    let request: MeetingRequest;
    try { request = JSON.parse(await readFile(path, "utf8")); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("会议记录无法读取，请联系管理员检查，避免重复创建。");
      request = { key: randomUUID(), draft };
      await save(request);
    }
    if (!request.key || !request.draft?.startsAt || !request.draft?.endsAt || !request.draft?.title) throw new Error("会议记录不完整，请联系管理员检查，避免重复创建。");
    if (request.eventId) return calendar.get(request.eventId);
    const event = await calendar.create(request.draft, request.key);
    await save({ ...request, eventId: event.id });
    return event;
  })();
  locks.set(path, work);
  try { return await work; }
  finally { if (locks.get(path) === work) locks.delete(path); }
}

export function alignmentMeetingDraft(scene: RecruitingScene, now = new Date()): CalendarEventDraft {
  const { job, insight } = scene;
  if (!job || !insight) throw new Error("请先查看招聘洞察");
  const date = addCalendarDays(calendarDate(now), 1);
  const agenda = ["对齐生产级 Agent 工程能力的证据标准", `讨论 ${insight.candidates.map(c => c.name).join("、")} 的评价分歧`, "确定共同评分表和候选人复核分工"];
  return {
    title: SYNTROPIC_ALIGNMENT_EVENT_TITLE,
    startsAt: `${date}T14:00:00+08:00`, endsAt: `${date}T14:30:00+08:00`,
    description: `参会人：${[...new Set([job.owner, ...(insight.interviewers ?? [])].filter(Boolean))].join("、")}\n议程：${agenda.join("；")}`,
  };
}
export async function scheduleFeishuAlignmentMeeting(root: string, scene: RecruitingScene): Promise<FeishuCalendarEvent> {
  const calendar = (await getFeishuDemoClient()).calendar();
  const draft = alignmentMeetingDraft(scene);
  if (computerAvailable()) {
    if (presentationRoot() && draft.description.trim()) draft.description = computerCalendarDescription(draft.description);
    return ensureFeishuGuiMeeting(root, `alignment-${scene.job?.id}`, draft, calendar);
  }
  if (presentationRoot()) draft.description = demoCalendarDescription(draft.description);
  return ensureFeishuMeeting(root, `alignment-${scene.job?.id}`, draft, calendar);
}
