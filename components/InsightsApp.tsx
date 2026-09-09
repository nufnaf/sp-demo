"use client";
/* eslint-disable @next/next/no-img-element -- exact Figma assets */
import type { InsightResult } from "@/lib/insight-automation";
import { FileViewer } from "./FileViewer";
import "./RecruitingDesign.css";

export function InsightsApp({ results, selected, analyzing, onSelect, onOpenFile }: {
  results: InsightResult[];
  selected: InsightResult;
  analyzing: boolean;
  onSelect: (result: InsightResult) => void;
  onOpenFile: () => void;
}) {
  const items = results.some(item => item.filePath === selected.filePath)
    ? results : [selected, ...results];
  return <div className="insights-app">
    <aside className="insights-sidebar">
      <header><img src="/icons/figma/insights-sparkles.svg" alt="" width="24" height="24"/><h1>AI 洞察</h1></header>
      <p className="insights-count">{items.length} 条洞察{analyzing ? " · 正在分析" : ""}</p>
      <nav aria-label="洞察列表">{items.map(item => <button type="button" key={item.filePath} className={item.filePath === selected.filePath ? "selected" : ""} aria-current={item.filePath === selected.filePath ? "page" : undefined} onClick={() => onSelect(item)}>
        <span className="insights-item-meta"><span><img src="/icons/figma/insight-active.svg" alt="" width="20" height="20"/>主动洞察</span><time dateTime={item.modified}>{formatDate(item.modified)}</time></span>
        <strong>{item.title}</strong><small>{item.summary || "查看完整分析与建议"}</small>
      </button>)}</nav>
      <footer>基于当前工作台的资料与进展</footer>
    </aside>
    <main className="insights-detail">
      <div className="insights-detail-toolbar"><span>分析于 {formatDate(selected.modified, true)}</span><button type="button" onClick={onOpenFile}>打开报告文件 ↗</button></div>
      {/* Reports are snapshots. Existing insight events refresh their revision;
          a second file SSE here consumes connections needed to read the report. */}
      <div className="insights-report"><FileViewer key={`${selected.cwd}:${selected.filePath}:${selected.modified}`} filePath={selected.filePath} cwd={selected.cwd} sourceSessionId={selected.sessionId} initialDisplayMode="preview" showToolbar={false} watchEnabled={false}/></div>
    </main>
  </div>;
}
function formatDate(value: string, full = false) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "时间未知" : date.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", ...(full ? { hour: "2-digit", minute: "2-digit" } : {}) });
}
