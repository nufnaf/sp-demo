"use client";

import { useEffect, useState, type ReactNode } from "react";
import { DraggableDesktopWidget } from "./DraggableDesktopWidget";
import { DesktopDesignIcon } from "./DesktopDesignIcon";
import { recruitingHomeSchedule } from "@/lib/desktop-home";
import type { DemoMeeting, RecruitingScene } from "@/lib/recruiting-scene";
import "./DesktopWorkspaceWidgets.css";

export interface WorkspaceWidgetItem { id: string; title: string; detail: string; running?: boolean; actionLabel?: string; disabled?: boolean; onOpen: () => void }
const profiles: Record<string, { goal: string; note: string; file: string; insight: string }> = {
  "product-release": { goal: "完成企业 Agent 系统季度版本发布", note: "发布材料、产品体验与支持安排同步就绪", file: "产品发布计划.md", insight: "发布材料需要统一核心叙事与适用场景" },
  "research-insights": { goal: "理解用户对 Agent 协作的核心诉求", note: "访谈记录 → 核心发现 → 下一轮研究", file: "用户访谈记录.md", insight: "用户更关注持续可见的进展，而不只是最终结果" },
  "personal-focus": { goal: "把注意力留给本周重点", note: "审阅资料 · 完成评审 · 整理反馈", file: "本周重点.md", insight: "将资料审阅集中安排，减少工作切换" },
};
export function workspaceReference(cwd: string) { return profiles[cwd.split("/").at(-1) ?? ""]?.file; }

export function DesktopWorkspaceWidgets({ cwd, recruiting, tasks, artifacts, insights, working, onOpenLibrary, onOpenRecruiting, onOpenSchedule, onOpenPreset }: {
  cwd: string; recruiting: boolean; tasks: WorkspaceWidgetItem[]; artifacts: WorkspaceWidgetItem[]; insights: WorkspaceWidgetItem[]; working: boolean;
  onOpenLibrary: () => void; onOpenRecruiting: () => void; onOpenSchedule: () => void; onOpenPreset: (file: string) => void;
}) {
  const [meeting, setMeeting] = useState<DemoMeeting | null>(null);
  const [scene, setScene] = useState<RecruitingScene | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const profile = profiles[cwd.split("/").at(-1) ?? ""];
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!recruiting) return;
    let live = true;
    const refresh = async () => {
      const results = await Promise.allSettled([
        fetch("/api/desktop/scenario", { cache: "no-store" }).then(r => r.ok ? r.json() : null),
        fetch("/api/apps/internal-recruiting", { cache: "no-store" }).then(r => r.ok ? r.json() : null),
      ]);
      if (!live) return;
      if (results[0].status === "fulfilled" && results[0].value) setMeeting(results[0].value.meeting ?? null);
      if (results[1].status === "fulfilled" && results[1].value) setScene(results[1].value.scene ?? null);
    };
    void refresh(); const timer = setInterval(() => void refresh(), 2500);
    return () => { live = false; clearInterval(timer); };
  }, [recruiting]);
  const openProfile = () => { if (profile) onOpenPreset(profile.file); };
  const fileItems = [...artifacts, ...(profile && !artifacts.some(item => item.title === profile.file) ? [{ id: "reference", title: profile.file, detail: "工作台资料", onOpen: openProfile }] : [])];
  const insightItems: WorkspaceWidgetItem[] = [...insights, ...(profile ? [{ id: "observation", title: profile.insight, detail: "来自工作台资料", onOpen: openProfile }] : [])];
  const schedule = recruiting && now ? recruitingHomeSchedule(now, meeting) : [];
  const hasGoal = recruiting || Boolean(profile);
  const empty = !hasGoal && !tasks.length && !insightItems.length && !fileItems.length;
  const target = scene?.job?.target ?? 6;
  const activeCount = tasks.filter(task => task.running).length;
  const emptyState = (title: string, note: string, extra?: ReactNode) => <div className="workspace-widget-empty"><strong>{title}</strong><p>{note}</p>{extra}</div>;
  const card = (id: string, title: string, heading: ReactNode, children: ReactNode, action?: ReactNode) => (
    <DraggableDesktopWidget key={`${cwd}:${id}`} widgetId={`${cwd}:workspace-${id}:home-v2`} className={`workspace-widget workspace-widget-${id}`} defaultPosition={{}}>
      <article className="agent-os-card" aria-label={title}><header><span>{heading}</span>{action}</header>{children}</article>
    </DraggableDesktopWidget>
  );
  return <div className={`workspace-widgets${empty ? " is-empty" : ""}`} role="group" aria-label="工作台概览">
    {card("goal", "业务目标", <span className="workspace-eyebrow">核心业务目标</span>, hasGoal ? <>
      <button type="button" className="workspace-goal" onClick={recruiting ? onOpenRecruiting : openProfile}>
        <strong>{recruiting ? <><em>{target}位</em>高级 AI Agent 研发工程师<span className="workspace-goal-outcome">到岗</span></> : profile?.goal}</strong>
        <p>{recruiting ? "Agent Platform · 北京 / 上海" : profile?.note}</p>
      </button>
      {recruiting && <div className="workspace-goal-progress">
        <div><span>当前进度</span><strong>0 / {target} · 0%</strong></div>
        <div className="workspace-progress-track" role="progressbar" aria-label="工程师到岗进度" aria-valuenow={0} aria-valuemin={0} aria-valuemax={target}>
          {Array.from({ length: Math.min(target, 12) }, (_, index) => <i key={index}/>)}
        </div>
        <div className="workspace-deadline"><span>截止日期</span><span>10月31日</span></div>
        {scene?.job && <small>已发布岗位 · {scene.metrics.applied} 人投递 · {scene.metrics.passed} 人面试通过</small>}
      </div>}
    </> : emptyState("把意图变成可追踪的目标", "在对话中梳理工作方向，组织结果、期限和验收标准"),
    hasGoal ? <button className="workspace-outline-action" type="button" onClick={recruiting ? onOpenRecruiting : openProfile}>查看目标 <span aria-hidden="true">↗</span></button> : <small>未设定</small>)}
    {card("schedule", "日程", <span className="workspace-sr-only">日程</span>,
      <div className="workspace-calendar">
        <div className="workspace-schedule-list">
          {schedule.length ? schedule.map((event, index) => {
            const start = new Date(event.startsAt);
            const sameDay = now && start.toDateString() === now.toDateString();
            return <button type="button" className={`workspace-schedule-event tone-${index % 3}`} key={event.id} onClick={onOpenSchedule} title={event.title}>
              <time dateTime={event.startsAt}>{!sameDay && `${start.getMonth() + 1}/${start.getDate()} `}{start.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}</time>
              <strong>{event.title}</strong><small>已排期 · 30 分钟</small>
            </button>;
          }) : emptyState("今天没有工作日程", "新的协作与会议安排会出现在这里")}
        </div>
        <div className="workspace-calendar-date" aria-label={now?.toLocaleDateString("zh-CN")}>
          <span>{now?.toLocaleDateString("zh-CN", { weekday: "short" })}</span><span>{now && `${now.getMonth() + 1}月`}</span><strong>{now?.getDate() ?? "—"}</strong>
        </div>
      </div>, <button type="button" className="workspace-schedule-count" onClick={onOpenSchedule} aria-label={`查看日程，共 ${schedule.length} 个事件`}>{schedule.length} 个事件</button>)}
    {card("insights", "AI 洞察", <><DesktopDesignIcon name="sparkles"/><strong>AI 洞察</strong></>,
      insightItems.length ? <div className="workspace-insight-list">{insightItems.map(item => <button type="button" className="workspace-insight" key={item.id} onClick={item.onOpen} disabled={item.disabled} title={item.title}>
        <span className="workspace-insight-title">{item.title}</span>{item.detail && <span className="workspace-insight-summary">{item.detail}</span>}<span className="workspace-insight-link">{item.actionLabel ?? "查看依据与下一步"} <span aria-hidden="true">↗</span></span>
      </button>)}</div> : emptyState("洞察会在合适的时机出现", "Syntropic 会理解新任务和产物，主动发现值得推进的下一步", <span className="workspace-observing"><DesktopDesignIcon name="sparkles" size={16}/>持续观察</span>),
      <small>{insightItems.length} 条最新发现</small>)}
    {card("tasks", "当前任务", <span className="workspace-task-total"><strong>{tasks.length}</strong><span>当前任务</span></span>,
      tasks.length ? <div className="workspace-task-list">{tasks.map(item => <button type="button" className={`workspace-task${item.running ? " is-running" : ""}`} key={item.id} onClick={item.onOpen} title={item.title}>
        <strong><i/>{item.title}</strong><small>{item.detail}</small>
      </button>)}</div> : emptyState(working ? "正在理解你的任务…" : "任务会在这里持续推进", "发送任务后，执行状态和结果会出现在这里"),
      <small>{working ? `${activeCount || 1} 项进行中` : tasks.length ? "执行记录" : "就绪"}</small>)}
    {card("artifacts", "最近成果", <><span className="workspace-artifact-mark" aria-hidden="true"/><strong>最近成果</strong></>,
      fileItems.length ? <div className="workspace-artifact-list">{fileItems.map(item => <button type="button" className="workspace-artifact" key={item.id} onClick={item.onOpen} title={item.title}>
        <span className="workspace-file-type" aria-hidden="true">{item.title.split(".").at(-1)?.slice(0, 4).toUpperCase() || "FILE"}</span>
        <span><strong>{item.title}</strong><small>{item.detail}</small></span><span aria-hidden="true">↗</span>
      </button>)}</div> : emptyState("让每一步工作，都留下成果", "生成的文档与报告会收在这里，随时打开、审阅和继续使用"),
      <button type="button" onClick={onOpenLibrary} aria-label="打开全部成果">全部{fileItems.length ? ` ${fileItems.length}` : ""} <span aria-hidden="true">↗</span></button>)}
  </div>;
}
