"use client";
import { useEffect, useSyncExternalStore } from "react";
import { createCalendarStore, EMPTY_CALENDAR } from "@/lib/feishu-calendar-store";
const store = createCalendarStore();
let consumers = 0;
let stop: (() => void) | undefined;
const serverSnapshot = () => EMPTY_CALENDAR;
const noSubscription = () => () => {};
export function notifyCalendarChanged() { window.dispatchEvent(new Event("agent-os:calendar-changed")); }
export function useFeishuCalendar(enabled = true) {
  const snapshot = useSyncExternalStore(enabled ? store.subscribe : noSubscription, enabled ? store.getSnapshot : serverSnapshot, serverSnapshot);
  useEffect(() => {
    if (!enabled) return;
    consumers++;
    if (consumers === 1) {
      const refresh = () => { if (document.visibilityState !== "hidden") void store.refresh(); };
      const changed = () => { void store.invalidate(); };
      const timer = window.setInterval(refresh, 30000);
      window.addEventListener("focus", refresh);
      window.addEventListener("online", refresh);
      window.addEventListener("agent-os:calendar-changed", changed);
      window.addEventListener("agent-os:presentation-changed", changed);
      document.addEventListener("visibilitychange", refresh);
      stop = () => {
        clearInterval(timer);
        window.removeEventListener("focus", refresh);
        window.removeEventListener("online", refresh);
        window.removeEventListener("agent-os:calendar-changed", changed);
        window.removeEventListener("agent-os:presentation-changed", changed);
        document.removeEventListener("visibilitychange", refresh);
      };
      refresh();
    }
    return () => { consumers--; if (!consumers) { stop?.(); stop = undefined; } };
  }, [enabled]);
  return { ...snapshot, refresh: store.refresh, setDate: store.setDate };
}
