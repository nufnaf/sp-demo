"use client";

import "./DesktopCollaboration.css";

interface ShelfItem { id: string; title: string; detail: string; running?: boolean; disabled?: boolean; actionLabel?: string; onOpen: () => void }
export function DesktopCollaboration({ tasks, artifacts, insights, working, analyzing, onOpenLibrary, onOpenInsights }: {
  tasks: ShelfItem[]; artifacts: ShelfItem[]; insights: ShelfItem[];
  working: boolean; analyzing: boolean; onOpenLibrary: () => void; onOpenInsights: () => void;
}) {
  const sections = [
    { key: "tasks", title: "当前任务", mark: "◷", status: working ? "进行中" : "就绪", live: working, items: tasks, empty: working ? "正在理解你的任务…" : "准备好继续下一件事", note: working ? "进展会在这里同步" : "任务开始后，在这里查看进展" },
    { key: "artifacts", title: "最近成果", mark: "▤", status: artifacts.length ? `${artifacts.length} 项` : "", live: false, items: artifacts, empty: "为新的成果留个位置", note: "生成的文件会收在这里" },
    { key: "insights", title: "AI 洞察", mark: "✧", status: analyzing ? "分析中" : "", live: analyzing, items: insights, empty: analyzing ? "正在整理最新变化…" : "暂无新洞察", note: "有值得关注的信息时，在这里查看" },
  ];
  return <div className="desktop-collaboration" aria-label="AI 协作状态">
    {sections.map((section) => <article className={`agent-os-card collaboration-card is-${section.key}`} key={section.key}>
      <header><span className="collaboration-title"><i aria-hidden="true">{section.mark}</i><strong>{section.title}</strong></span>{section.key === "insights" ? <button type="button" onClick={onOpenInsights} aria-label="查看全部 AI 洞察">查看全部 <span aria-hidden="true">›</span></button> : section.key === "artifacts" && artifacts.length ? <button type="button" onClick={onOpenLibrary}>全部 <span aria-hidden="true">›</span></button> : <span className={`collaboration-status${section.live ? " is-live" : ""}`}>{section.live && <i/>}{section.status}</span>}</header>
      <div className="collaboration-body">
        {section.items.length ? section.items.slice(0, 2).map((item) => <button type="button" className="collaboration-row" key={item.id} onClick={item.onOpen} disabled={item.disabled}><span><strong>{item.title}</strong><small>{item.detail}</small>{item.actionLabel && <small>{item.actionLabel}</small>}</span><i className={item.running ? "is-working" : ""} aria-hidden="true">{item.running ? "" : "›"}</i></button>) : <div className="collaboration-empty"><p>{section.empty}</p><small>{section.note}</small></div>}
        {section.items.length > 2 && <small className="collaboration-more">另有 {section.items.length - 2} 项</small>}
      </div>
    </article>)}
  </div>;
}
