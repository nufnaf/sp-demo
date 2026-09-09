import type { FeishuCalendarEvent } from "./feishu-calendar";
import { calendarDate } from "./calendar-view";
export interface CalendarSnapshot { events: FeishuCalendarEvent[]; date: string; loading: boolean; error: string; fetchedAt?: string }
export const EMPTY_CALENDAR: CalendarSnapshot = { events: [], date: "", loading: true, error: "" };

/** One snapshot and one in-flight read for the desktop card and every open schedule. */
export function createCalendarStore(request: typeof fetch = fetch) {
  let state = EMPTY_CALENDAR;
  let revision = 0;
  let active: Promise<void> | undefined;
  const listeners = new Set<() => void>();
  const publish = (next: CalendarSnapshot) => { state = next; for (const listener of listeners) listener(); };
  const refresh = (): Promise<void> => {
    if (active) return active;
    const current = revision;
    const date = state.date || calendarDate();
    publish({ ...state, date, loading: true, error: "" });
    const work = (async () => {
      try {
        const response = await request(`/api/apps/feishu/calendar?${new URLSearchParams({ date })}`, { cache: "no-store", signal: AbortSignal.timeout(25000) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "暂时无法读取飞书日程");
        if (!Array.isArray(data.events) || data.date !== date) throw new Error("日程数据不完整，请刷新重试");
        if (revision === current) publish({ events: data.events, date, fetchedAt: data.fetchedAt, loading: false, error: "" });
      } catch (error) {
        if (revision === current) publish({ ...state, loading: false, error: error instanceof Error ? error.message : "暂时无法读取飞书日程" });
      }
    })();
    active = work;
    void work.finally(() => { if (active === work) active = undefined; });
    return work;
  };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh,
    setDate(date: string) {
      revision++; active = undefined;
      publish({ events: [], date, loading: true, error: "" });
      return refresh();
    },
    invalidate() { revision++; active = undefined; return refresh(); },
  };
}
