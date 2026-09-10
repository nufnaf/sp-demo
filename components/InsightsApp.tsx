"use client";
/* eslint-disable @next/next/no-img-element -- exact Figma assets */
import type { JdArtifact } from "@/lib/recruiting-publication";
import type { InsightSelection, PublicationInsightItem, WorkspaceInsightItem } from "@/lib/workspace-insights";
import { Check, ArrowUpRight, FileText, LoaderCircle, CircleAlert } from "lucide-react";
import { AppBrandImage } from "./AppBrandImage";
import { FileViewer } from "./FileViewer";
import "./RecruitingDesign.css";

export function InsightsApp({ items, selection, analyzing, onSelect, onOpenFile, onOpenRecruiting }: {
  items: WorkspaceInsightItem[];
  selection: InsightSelection;
  analyzing: boolean;
  onSelect: (item: WorkspaceInsightItem) => void;
  onOpenFile: (artifact: JdArtifact & { modified: string }) => void;
  onOpenRecruiting: () => void;
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
        {selected.kind === "publication" ? <PublicationDetail item={selected} onOpenRecruiting={onOpenRecruiting}/>
          : <div className="insights-report"><FileViewer key={`${file.cwd}:${file.filePath}:${modified}`} filePath={file.filePath} cwd={file.cwd} sourceSessionId={file.sessionId} initialDisplayMode="preview" showToolbar={false} watchEnabled={false}/></div>}
      </> : <div className="insights-empty"><h2>洞察会在合适的时机出现</h2><p>岗位发布建议与分析报告会保留在这里，随时查看和继续处理。</p></div>}
    </main>
  </div>;
}

function PublicationDetail({ item, onOpenRecruiting }: { item: PublicationInsightItem; onOpenRecruiting: () => void }) {
  const { stage, job } = item;
  const complete = stage === "published";
  const busy = stage === "preparing" || stage === "publishing";
  const attention = stage === "attention";
  const StatusIcon = complete ? Check : busy ? LoaderCircle : attention ? CircleAlert : FileText;
  const channels = [
    { id: "internal", title: "内部招聘系统", done: Boolean(job), icon: <AppBrandImage src="/icons/company-careers-logo.svg"/> },
    ...(item.includesBoss ? [{ id: "boss", title: "BOSS 直聘", done: job?.bossPublication?.status === "published", icon: <AppBrandImage appId="boss-zhipin"/> }] : []),
  ];
  const heading = complete ? "岗位已发布" : busy ? "正在发布岗位" : attention ? "发布需要处理" : "岗位 JD 已准备好";
  return <section className={`insights-publication is-${stage}`} aria-label="岗位发布建议">
    <header className="publication-heading"><span className="publication-status-icon"><StatusIcon size={25}/></span><div>
      <small>Syntropic · 主动洞察</small><h2>{heading}</h2><p role={attention ? "alert" : "status"}>{item.detail}</p>
    </div></header>
    <div className="publication-job"><div><small>{job ? "招聘岗位" : "岗位文档"}</small><strong>{job?.title ?? item.artifact.filePath.split(/[\\/]/).at(-1)}</strong>
      <small>{job ? `${job.department} · ${job.location}` : "已保存在工作台，可打开 JD 查看完整内容"}</small></div>
      {job && <div><small>招聘计划</small><strong>{job.headcount} 人</strong></div>}
      <span className="publication-badge">{complete ? "已发布" : busy ? "处理中" : attention ? "待核对" : "待发布"}</span>
    </div>
    <div className="publication-grid">
      <article><small>发布流程</small><h3>{complete ? "本次已完成" : "从文档到招聘岗位"}</h3>
        <ol className="publication-steps">
          <li className="is-done"><Check size={16}/><div><strong>准备岗位 JD</strong><small>文档已生成，可随时查看</small></div></li>
          <li className={complete ? "is-done" : ""}>{complete ? <Check size={16}/> : <span>2</span>}<div><strong>发布并核对岗位</strong><small>{complete ? "岗位保存结果已核对" : busy ? "正在处理，请等待执行结果" : attention ? "请核对任务提示和网页保存结果" : "确认后开始发布"}</small></div></li>
          <li className={complete ? "is-done" : ""}>{complete ? <Check size={16}/> : <span>3</span>}<div><strong>同步招聘进展</strong><small>{complete ? "已加入人才招聘工作台" : "发布完成后同步更新"}</small></div></li>
        </ol>
      </article>
      <article><small>发布渠道</small><h3>{complete ? "查看渠道结果" : "岗位将发布到"}</h3><div className="publication-channels">
        {channels.map(channel => <div key={channel.id}><span className="publication-channel-icon">{channel.icon}</span><div><strong>{channel.title}</strong><small>{channel.done ? "已发布" : complete ? "未发布" : attention ? "待核对" : busy ? "处理中" : "待发布"}</small></div>{channel.done && <Check size={17}/>}</div>)}
      </div></article>
    </div>
    <footer className="publication-next"><div><small>下一步</small><h3>{complete ? "查看招聘进展，跟进候选人" : attention ? "核对结果后，继续发布" : "确认岗位内容，开始招聘"}</h3>
      <p>{complete ? "岗位与渠道结果已同步，可继续查看候选人和面试进度。" : "通过右上角打开 JD，查看职位要求和招聘信息。"}</p></div>
      {complete ? <button type="button" onClick={onOpenRecruiting}>查看招聘进展 <ArrowUpRight size={16}/></button>
        : <button type="button" disabled={item.disabled} onClick={item.onPublish}>{item.actionLabel}</button>}
    </footer>
  </section>;
}
function formatDate(value: string, full = false) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "时间未知" : date.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", ...(full ? { hour: "2-digit", minute: "2-digit" } : {}) });
}
