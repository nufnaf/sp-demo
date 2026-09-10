import { fromHtml } from "hast-util-from-html";

import { CALENDAR_TIME_ZONE } from "./calendar-view";
export interface FeishuCalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  description: string;
  location: string;
  appLink?: string;
  status: string;
  source: "feishu";
}
export interface CalendarEventDraft {
  title: string;
  startsAt: string;
  endsAt: string;
  description: string;
  location?: string;
}
export type CalendarRequest = (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;

function plainText(value: unknown): string {
  if (typeof value !== "string") return "";
  if (!/<\/?[a-z][\s\S]*>/i.test(value)) return value;
  const tree = fromHtml(value, { fragment: true });
  function visit(node: { type: string; value?: string; tagName?: string; children?: typeof tree.children }): string {
    if (node.type === "text") return node.value ?? "";
    if (["script", "style"].includes(node.tagName ?? "")) return "";
    if (node.tagName === "br") return "\n";
    return (node.children ?? []).map(visit).join("") + (["p", "div", "li", "h1", "h2", "h3", "tr"].includes(node.tagName ?? "") ? "\n" : "");
  }
  return visit(tree).trim();
}
function eventTime(value: unknown): { value: string; allDay: boolean } {
  const time = value as { date?: string; timestamp?: string } | undefined;
  if (time?.date && /^\d{4}-\d{2}-\d{2}$/.test(time.date) && Number.isFinite(Date.parse(time.date)) && new Date(time.date).toISOString().slice(0, 10) === time.date) return { value: time.date, allDay: true };
  if (typeof time?.timestamp === "string" && /^\d+$/.test(time.timestamp)) {
    const date = new Date(Number(time.timestamp) * 1000);
    if (Number.isFinite(date.getTime())) return { value: date.toISOString(), allDay: false };
  }
  throw new Error("飞书日程的时间数据不完整，请刷新重试。");
}
export function normalizeCalendarEvent(value: unknown, calendarId: string): FeishuCalendarEvent {
  const event = value as Record<string, unknown> | undefined;
  if (!event || typeof event.event_id !== "string" || !event.event_id) throw new Error("飞书未返回有效日程，请刷新重试。");
  const start = eventTime(event.start_time), end = eventTime(event.end_time);
  if (start.allDay !== end.allDay || (start.allDay ? end.value < start.value : end.value <= start.value)) throw new Error("飞书日程的时间数据不完整，请刷新重试。");
  let appLink: string | undefined;
  try {
    const url = new URL(String(event.app_link));
    if (url.protocol === "https:" && ["applink.feishu.cn", "applink.larkoffice.com", "applink.larksuite.com"].includes(url.hostname)) appLink = url.href;
  } catch { /* A missing link does not invalidate the event. */ }
  return { id: event.event_id, calendarId, title: typeof event.summary === "string" ? event.summary : "未命名日程", startsAt: start.value, endsAt: end.value, allDay: start.allDay, description: plainText(event.description), location: plainText((event.location as { name?: unknown } | undefined)?.name), appLink, status: typeof event.status === "string" ? event.status : "confirmed", source: "feishu" };
}
export class FeishuCalendarClient {
  constructor(readonly calendarId: string, readonly identity: string, private request: CalendarRequest, readonly resetEventIds: readonly string[] = []) {}
  private path(suffix: string) { return `/calendar/v4/calendars/${encodeURIComponent(this.calendarId)}/events${suffix}`; }
  /** Full pagination, including past events, so old demo runs do not accumulate. */
  async allEvents(): Promise<FeishuCalendarEvent[]> {
    const events = new Map<string, FeishuCalendarEvent>();
    const seen = new Set<string>();
    let token = "";
    for (let page = 0; page < 100; page++) {
      // Feishu only returns page_token when anchor_time is supplied.
      const query = new URLSearchParams({ page_size: "500", anchor_time: "0" });
      if (token) query.set("page_token", token);
      const data = await this.request(this.path(`?${query}`));
      if (data.items !== undefined && !Array.isArray(data.items)) throw new Error("飞书日程列表不完整，已暂停同步，请重试。");
      if (data.items === undefined && data.has_more) throw new Error("飞书日程列表不完整，已暂停同步，请重试。");
      for (const item of (data.items ?? []) as Record<string, unknown>[]) {
        if (item.status === "cancelled") continue;
        const event = normalizeCalendarEvent(item, this.calendarId);
        events.set(event.id, event);
      }
      if (!data.has_more) return [...events.values()];
      token = typeof data.page_token === "string" ? data.page_token : "";
      if (!token || seen.has(token)) break;
      seen.add(token);
    }
    throw new Error("飞书日程列表加载未完成，已暂停同步，请重试。");
  }
  async remove(eventId: string): Promise<void> {
    if (!eventId) throw new Error("日程标识无效。");
    await this.request(this.path(`/${encodeURIComponent(eventId)}?need_notification=false`), { method: "DELETE" });
  }
  async events(start: string, end: string): Promise<FeishuCalendarEvent[]> {
    const from = Date.parse(start), to = Date.parse(end);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from >= 40 * 86400000) throw new Error("请选择小于 40 天的有效日程范围。");
    const query = new URLSearchParams({ start_time: String(Math.floor(from / 1000)), end_time: String(Math.floor(to / 1000)) });
    const data = await this.request(this.path(`/instance_view?${query}`));
    // Feishu returns code=0, data={} for a newly created, empty calendar.
    if (Object.keys(data).length === 0) return [];
    if (!Array.isArray(data.items)) throw new Error("飞书日程列表不完整，请刷新重试。");
    const events = data.items.filter(event => event?.status !== "cancelled").map(event => normalizeCalendarEvent(event, this.calendarId));
    return [...new Map(events.map(event => [event.id, event])).values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }
  async get(eventId: string): Promise<FeishuCalendarEvent> {
    const data = await this.request(this.path(`/${encodeURIComponent(eventId)}`));
    if ((data.event as { status?: string } | undefined)?.status === "cancelled") throw new Error("此会议已在飞书中取消，请在飞书中查看或重新安排。");
    return normalizeCalendarEvent(data.event, this.calendarId);
  }
  async create(draft: CalendarEventDraft, key: string): Promise<FeishuCalendarEvent> {
    const start = Date.parse(draft.startsAt), end = Date.parse(draft.endsAt);
    if (!draft.title.trim() || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || !key) throw new Error("会议标题或时间无效。");
    const data = await this.request(this.path(`?${new URLSearchParams({ idempotency_key: key })}`), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary: draft.title, description: draft.description, start_time: { timestamp: String(Math.floor(start / 1000)), timezone: CALENDAR_TIME_ZONE }, end_time: { timestamp: String(Math.floor(end / 1000)), timezone: CALENDAR_TIME_ZONE }, ...(draft.location?.trim() ? { location: { name: draft.location.trim() } } : {}), need_notification: false, visibility: "public", vchat: { vc_type: "no_meeting" } }),
    });
    if ((data.event as { status?: string } | undefined)?.status === "cancelled") throw new Error("此会议已在飞书中取消，请在飞书中重新安排。");
    return normalizeCalendarEvent(data.event, this.calendarId);
  }
}
