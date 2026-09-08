"use client";

import { useEffect, useState, type ReactNode } from "react";
import { DraggableDesktopWidget } from "./DraggableDesktopWidget";
import type { DemoMeeting, RecruitingScene } from "@/lib/recruiting-scene";
import "./DesktopWorkspaceWidgets.css";

export interface WorkspaceWidgetItem { id: string; title: string; detail: string; running?: boolean; onOpen: () => void }
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
  const profile = profiles[cwd.split("/").at(-1) ?? ""];
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
  const taskItems = tasks;
  const fileItems = [...artifacts, ...(profile && !artifacts.some(item => item.title === profile.file) ? [{ id: "reference", title: profile.file, detail: "工作台资料", onOpen: openProfile }] : [])];
  const insightItems = [...insights, ...(profile ? [{ id: "observation", title: profile.insight, detail: "来自工作台资料", onOpen: openProfile }] : [])];
  const rows = (items: WorkspaceWidgetItem[], empty: string, note: string) => items.length ? <div className="workspace-widget-list">{items.map(item => <button type="button" className="workspace-widget-row" key={item.id} onClick={item.onOpen}><span><strong>{item.title}</strong><small className={item.running ? "is-running" : undefined}>{item.running && <i/>}{item.detail}</small></span><b aria-hidden="true">›</b></button>)}</div> : <div className="workspace-widget-empty"><p>{empty}</p><small>{note}</small></div>;
  const card = (id: string, title: string, mark: string, children: ReactNode, action?: ReactNode) => <DraggableDesktopWidget key={`${cwd}:${id}`} widgetId={`${cwd}:workspace-${id}`} className={`workspace-widget workspace-widget-${id}`} defaultPosition={{}}><article className="agent-os-card" aria-label={title}><header><span><i aria-hidden="true">{mark}</i><strong>{title}</strong></span>{action}</header>{children}</article></DraggableDesktopWidget>;
  return <>
    {card("goal", "业务目标", "✧", <button type="button" className="workspace-goal" onClick={recruiting ? onOpenRecruiting : openProfile}><small>核心目标</small><strong>{recruiting ? "6 位 AI Agent 工程师到岗" : profile?.goal ?? "组织当前工作方向"}</strong><p>{recruiting ? "Agent 研发 · 杭州 / 上海" : profile?.note}</p>{recruiting && <div><span>目标期限<b>10 月 31 日</b></span><span>当前结果<b>0 / {scene?.job?.target ?? 6} 已到岗</b></span></div>}{recruiting && scene?.job && <small>已发布岗位 · {scene.metrics.applied} 人投递 · {scene.metrics.passed} 人面试通过</small>}</button>)}
    {card("schedule", "日程", "▦", meeting && recruiting ? rows([{ id: meeting.id, title: meeting.title, detail: `${new Date(meeting.startsAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} · 30 分钟`, onOpen: onOpenSchedule }], "", "") : <div className="workspace-calendar"><strong>{new Date().getDate()}<small>{new Date().toLocaleDateString("zh-CN", { month: "long" })}</small></strong><span>{profile ? "为重点工作预留时间" : "暂无待进行的日程"}<small>{profile ? "安排随工作推进逐步补充" : "安排会议后，会在这里同步"}</small></span></div>, <button type="button" onClick={onOpenSchedule}>查看日程</button>)}
    {card("tasks", "当前任务", "◷", rows(taskItems, working ? "正在理解你的任务…" : "任务会在这里持续推进", "执行进展与完成记录集中保留"), <small>{working ? "进行中" : taskItems.length ? `${taskItems.length} 项` : "就绪"}</small>)}
    {card("insights", "AI 洞察", "✦", rows(insightItems, "洞察会在合适的时机出现", "结合业务变化，发现值得关注的下一步"), <small>{insightItems.length ? `${insightItems.length} 条发现` : "持续关注"}</small>)}
    {card("artifacts", "最近成果", "▤", rows(fileItems, "新的成果会收在这里", "生成后即可打开、审阅和继续使用"), <button type="button" onClick={onOpenLibrary}>全部 ›</button>)}
  </>;
}
