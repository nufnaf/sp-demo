"use client";
import { useEffect, useState } from "react";
import { Check, ArrowUpRight, FileText } from "lucide-react";
import type { Progress } from "@/lib/presentation-progress";
import { recruitingQueryResult } from "@/lib/recruiting-query-result";
import type { InsightResult } from "@/lib/insight-automation";
import { DesktopReadingArea } from "./DesktopReadingArea";
import { MarkdownBody } from "./MarkdownBody";
import "./RecruitingQueryResult.css";

export function RecruitingQueryResult({ sessionId, cwd, onOpenCandidates, onOpenReport, onOpenBrowser }: {
  sessionId: string; cwd: string;
  onOpenCandidates: (jobId: string) => void;
  onOpenReport: (report: InsightResult) => void;
  onOpenBrowser?: () => void;
}) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let request: AbortController | undefined;
    const refresh = () => {
      request?.abort();
      const controller = new AbortController(); request = controller;
      fetch("/api/desktop/scenario", { cache: "no-store", signal: controller.signal })
        .then(async r => { if (!r.ok) throw new Error("查询结果暂时无法读取，请重试。"); return r.json(); })
        .then(data => { if (!controller.signal.aborted) { setProgress(data); setError(""); } })
        .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "查询结果暂时无法读取，请重试。"); });
    };
    refresh();
    window.addEventListener("agent-os:presentation-changed", refresh);
    return () => { request?.abort(); window.removeEventListener("agent-os:presentation-changed", refresh); };
  }, [sessionId, retry]);
  const saved = progress?.queries?.[sessionId];
  const scene = progress?.recruiting?.scene;
  // Older tasks have no per-query snapshot. Label the existing synchronized data honestly.
  const result = saved ?? (scene?.job ? recruitingQueryResult(scene, sessionId, "", "", "") : null);
  const report = progress?.insight;
  const currentJob = scene?.job?.id === result?.jobId;
  return <DesktopReadingArea><div className="recruiting-query-result">
    {error ? <div role="alert"><h1>暂时无法打开查询结果</h1><p>{error}</p><button onClick={() => setRetry(n => n + 1)}>重新读取</button></div>
      : !progress ? <p role="status">正在读取查询结果…</p>
      : !result ? <div><h1>暂无可读取的招聘进展</h1><p>可以返回任务网页核对结果，或重新查询招聘进展。</p>{onOpenBrowser && <button onClick={onOpenBrowser}>查看任务网页 <ArrowUpRight size={16}/></button>}</div>
      : <>
        <header className="recruiting-query-heading"><span><Check size={24}/></span><div><small>{saved ? "招聘查询 · 已完成" : "最近同步的招聘进展"}</small><h1>{result.title}</h1>{saved ? <p>查询于 {new Date(result.checkedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}（北京时间）</p> : <p>此任务未保留当时的查询快照，以下展示最近同步的进展。</p>}</div></header>
        {result.question && <p className="recruiting-query-question">{result.question}</p>}
        <section className="recruiting-query-counts" aria-label="查询统计"><article><strong>{result.metrics.finished}</strong><span>人面试全部结束</span></article><article><strong>{result.metrics.missing}</strong><span>人评价尚未齐全</span></article></section>
        <p className="recruiting-query-scope">“评价尚未齐全”计入已结束面试的人数；累计进度不等同于候选人当前状态。</p>
        <section className="recruiting-query-followup"><header><div><h2>待补齐评价</h2><p>{result.missingCandidates.length ? "优先跟进以下候选人的面试评价。" : "已结束面试的候选人评价均已齐全。"}</p></div>{currentJob && <button onClick={() => onOpenCandidates(result.jobId)}>查看候选人 <ArrowUpRight size={16}/></button>}</header>
          <ul>{result.missingCandidates.map(candidate => <li key={candidate.id}><span><strong>{candidate.name}</strong><small>{candidate.id}</small></span><span>缺 {candidate.missingReviews} 份评价</span></li>)}</ul>
        </section>
        {result.summary && <section className="recruiting-query-answer"><h2>查询结论</h2><MarkdownBody>{result.summary}</MarkdownBody></section>}
        <footer>{report && currentJob && <button onClick={() => onOpenReport({ ...report, cwd, fileName: "recruiting-interviewer-alignment-report.html", sessionId: `presentation:${result.jobId}` })}><FileText size={16}/> 查看完整报告</button>}{onOpenBrowser && <button onClick={onOpenBrowser}>查看任务网页 <ArrowUpRight size={16}/></button>}</footer>
      </>}
  </div></DesktopReadingArea>;
}
