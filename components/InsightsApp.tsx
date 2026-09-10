"use client";
/* eslint-disable @next/next/no-img-element -- exact Figma assets */
import type { JdArtifact } from "@/lib/recruiting-publication";
import type { InsightSelection, WorkspaceInsightItem } from "@/lib/workspace-insights";
import { FileViewer } from "./FileViewer";
import "./RecruitingDesign.css";

export function InsightsApp({ items, selection, analyzing, onSelect, onOpenFile }: {
  items: WorkspaceInsightItem[];
  selection: InsightSelection;
  analyzing: boolean;
  onSelect: (item: WorkspaceInsightItem) => void;
  onOpenFile: (artifact: JdArtifact & { modified: string }) => void;
}) {
  const report = selection.report;
  const entries: WorkspaceInsightItem[] = report && !items.some(item => item.id === selection.id)
    ? [{ kind: "report", id: report.filePath, title: report.title, detail: report.summary ?? "", modified: report.modified, result: report }, ...items]
    : items;
  const selected = entries.find(item => item.id === selection.id) ?? entries[0];
  const file = selected?.kind === "publication" ? selected.artifact : selected?.result;
  const modified = selected?.modified ?? "";
  return <div className="insights-app">
    <aside className="insights-sidebar">
      <header><img src="/icons/figma/insights-sparkles.svg" alt="" width="24" height="24"/><h1>AI 洞察</h1></header>
      <p className="insights-count">{entries.length} 条洞察{analyzing ? " · 正在分析" : ""}</p>
      <nav aria-label="洞察列表">{entries.map(item => <button type="button" key={item.id} className={item.id === selected?.id ? "selected" : ""} aria-current={item.id === selected?.id ? "page" : undefined} onClick={() => onSelect(item)}>
        <strong>{item.title}</strong><small>{item.detail || "查看完整分析与建议"}</small>
        {(item.modified || item.kind === "publication") && <span className="insights-item-meta">
          {item.kind === "publication" && <span className="insights-item-status">{item.actionLabel}</span>}
          {item.modified && <time dateTime={item.modified}>{formatDate(item.modified)}</time>}
        </span>}
      </button>)}</nav>
      <footer>基于当前工作台的资料与进展</footer>
    </aside>
    <main className="insights-detail">
      {selected && file ? <>
        <div className="insights-detail-toolbar"><span>{selected.kind === "publication" ? "岗位发布建议 · 对应 JD" : `分析于 ${formatDate(modified, true)}`}</span><button type="button" onClick={() => onOpenFile({ ...file, taskTitle: selected.kind === "publication" ? selected.artifact.taskTitle : "AI 洞察", modified })}>{selected.kind === "publication" ? "打开 JD 文件 ↗" : "打开报告文件 ↗"}</button></div>
        {selected.kind === "publication" && <section className="insights-publication" aria-label="岗位发布建议">
          <div><h2>{selected.title}</h2><p role="status">{selected.detail}</p></div>
          <button type="button" disabled={selected.disabled} onClick={selected.onPublish}>{selected.actionLabel}</button>
        </section>}
        {/* Switching details never restarts publication. Both entries preview
            their source file without opening another event connection. */}
        <div className="insights-report"><FileViewer key={`${file.cwd}:${file.filePath}:${modified}`} filePath={file.filePath} cwd={file.cwd} sourceSessionId={file.sessionId} initialDisplayMode="preview" showToolbar={false} watchEnabled={false}/></div>
      </> : <div className="insights-empty"><h2>洞察会在合适的时机出现</h2><p>岗位发布建议与分析报告会保留在这里，随时查看和继续处理。</p></div>}
    </main>
  </div>;
}
function formatDate(value: string, full = false) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "时间未知" : date.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", ...(full ? { hour: "2-digit", minute: "2-digit" } : {}) });
}
