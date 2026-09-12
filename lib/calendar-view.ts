import type { FeishuCalendarEvent } from "./feishu-calendar";
export const CALENDAR_TIME_ZONE = "Asia/Shanghai";
export function calendarDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: CALENDAR_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)!.value).join("-");
}
export function addCalendarDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function calendarRange(date = calendarDate()) {
  return { date, start: `${date}T00:00:00+08:00`, end: `${addCalendarDays(date, 7)}T00:00:00+08:00` };
}
export function calendarTimeLabel(event: FeishuCalendarEvent): string {
  if (event.allDay) return `${event.startsAt} · 全天`;
  return new Date(event.startsAt).toLocaleString("zh-CN", { timeZone: CALENDAR_TIME_ZONE, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}
export function calendarDuration(event: FeishuCalendarEvent): string {
  return event.allDay ? "全天" : `${Math.round((Date.parse(event.endsAt) - Date.parse(event.startsAt)) / 60000)} 分钟`;
}
