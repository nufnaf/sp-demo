"use client";
import "./PresentationSchedule.css";
import { useFeishuCalendar } from "@/hooks/useFeishuCalendar";
import { addCalendarDays, calendarDate, calendarDuration, calendarTimeLabel } from "@/lib/calendar-view";
import { calendarDescriptionForDisplay } from "@/lib/feishu-demo-calendar-marker";

export function PresentationSchedule({ recruiting = true }: { recruiting?: boolean } = {}) {
  const { events, date, loading, error, fetchedAt, refresh, setDate } = useFeishuCalendar(recruiting);
  return <section className="presentation-schedule">
    <small>星流科技 · 飞书日历 · 北京时间</small><h1>团队日程</h1>
    {recruiting && <div className="calendar-controls">
      <button disabled={!date} onClick={() => void setDate(addCalendarDays(date, -7))}>前 7 天</button>
      <button onClick={() => void setDate(calendarDate())}>今天</button>
      <button disabled={!date} onClick={() => void setDate(addCalendarDays(date, 7))}>后 7 天</button>
      <button disabled={loading} onClick={() => void refresh()}>{loading ? "正在同步…" : "刷新日程"}</button>
    </div>}
    {recruiting && date && <p>{date} 至 {addCalendarDays(date, 6)}</p>}
    {error && <p role="alert">{error}{events.length > 0 ? "（下方为上次读取的日程）" : ""}</p>}
    {recruiting && loading && !events.length && <p role="status">正在读取飞书日程…</p>}
    {(!recruiting || (!loading && !error && !events.length)) && <p>当前范围暂无已安排的会议。</p>}
    {recruiting && events.map(event => {
      const description = calendarDescriptionForDisplay(event.description);
      return <article key={event.id}>
        <em>已安排</em><h2>{event.title}</h2><p>{event.allDay ? event.startsAt : calendarTimeLabel(event)} · {calendarDuration(event)}</p>
        {event.allDay ? event.endsAt !== event.startsAt && <p>结束日期：{event.endsAt}</p> : <p>结束：{calendarTimeLabel({ ...event, startsAt: event.endsAt })}</p>}
        {event.location && <p>地点：{event.location}</p>}
        {description && <><h3>会议说明</h3><p style={{ whiteSpace: "pre-wrap" }}>{description}</p></>}
        {event.appLink && <a href={event.appLink} target="_blank" rel="noreferrer">在飞书中查看 ↗</a>}
      </article>;
    })}
    {recruiting && fetchedAt && <small>最近读取：{new Date(fetchedAt).toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai" })}</small>}
  </section>;
}
