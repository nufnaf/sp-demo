"use client";
import { useEffect, useState } from "react";
import type { RecruitingScene, DemoMeeting } from "@/lib/recruiting-scene";
import type { InsightResult } from "@/lib/insight-automation";
import { recruitingStages as stages, recruitingMetrics, filterRecruitingCandidates } from "@/lib/recruiting-view";
import { PresentationSchedule } from "./PresentationSchedule";
import { notifyCalendarChanged } from "@/hooks/useFeishuCalendar";
export { PresentationSchedule } from "./PresentationSchedule";

export function RecruitingPipeline({ scene, cwd, onOpenWebsite, onOpenInsight, initialFilter = "" }: { scene: RecruitingScene | null; cwd: string; onOpenWebsite?: (url: string) => void; onOpenInsight: (result: InsightResult) => void; initialFilter?: string }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(initialFilter);
  useEffect(() => { setFilter(initialFilter); }, [initialFilter]);
  const [selected, setSelected] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ insight?: { title: string; filePath: string; modified: string; summary?: string }; meeting?: DemoMeeting }>({});
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const jobId = scene?.job?.id;
  useEffect(() => {
    if (!jobId) return;
    let live = true;
    const load = async (trigger = false) => {
      try {
        const r = await fetch("/api/desktop/scenario", trigger ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "insight" }) } : { cache: "no-store" });
        const data = await r.json(); if (!r.ok) throw new Error(data.error || "暂时无法读取洞察"); if (live) { setProgress(data); setLoadError(""); }
      } catch (e) { if (live) setLoadError(e instanceof Error ? e.message : "洞察暂时不可用"); }
    };
    const refresh = () => void load();
    void load();
    const timer = setTimeout(() => void load(true), 7000);
    window.addEventListener("agent-os:presentation-changed", refresh);
    return () => { live = false; clearTimeout(timer); window.removeEventListener("agent-os:presentation-changed", refresh); };
  }, [jobId]);
  const schedule = async () => {
    setBusy(true);
    try { const r = await fetch("/api/desktop/scenario", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "meeting" }) }); const data = await r.json(); if (!r.ok) throw new Error(data.error); setProgress(data); setError(""); notifyCalendarChanged(); setScheduleOpen(true); }
    catch (e) { setError(e instanceof Error ? e.message : "会议暂时无法安排"); } finally { setBusy(false); }
  };
  if (!scene?.job) return <section className="presentation-pipeline"><small>星流科技 · 招聘目标</small><h1>高级 AI Agent 研发工程师</h1><p>Agent Platform · 北京 / 上海 · 招聘 6 人</p><article><h2>从团队资料开始</h2><p>根据团队业务资料准备岗位 JD，确认后即可发布岗位。</p></article></section>;
  const visible = filterRecruitingCandidates(scene.candidates, filter, query);
  const candidate = scene.candidates.find(c => c.id === selected);
  const cumulative = recruitingMetrics(scene);
  const filterLabel = filter === "missing" ? "面试结束且缺评价" : cumulative.find(item => item.filter === filter)?.label ?? stages[filter] ?? "全部候选人";
  return <section className="presentation-pipeline">
    <header className="recruiting-scene-heading"><div><small>星流科技 · 招聘目标</small><h1>{scene.job.title} · {scene.job.target} 位到岗</h1><p>{scene.job.department} · {scene.job.location} · 内部招聘系统</p></div><button className="recruiting-job-link" onClick={() => onOpenWebsite?.(`/jobs/${scene.job!.id}`)}>查看已发布岗位 ↗</button></header>
    <section className="recruiting-funnel"><header><div><h2>招聘管道</h2><p>累计进度 · 点击卡片查看对应候选人</p></div><button onClick={() => { setFilter(""); setQuery(""); }}>查看全部</button></header>
      <div className="presentation-metrics">{cumulative.map(item => <button key={item.label} className={filter === item.filter ? "selected" : ""} aria-pressed={filter === item.filter} onClick={() => { setQuery(""); setFilter(item.filter); }}><strong>{item.count}</strong><small>{item.label}</small></button>)}</div>
    </section>
    <article className="recruiting-candidates"><header><div><h2>候选人</h2><p>{!filter ? "全部候选人" : filterLabel} · {visible.length} 条记录</p></div><label className="recruiting-search"><input aria-label="搜索候选人" placeholder="搜索姓名、编号、学校或能力" value={query} onChange={e => setQuery(e.target.value)}/></label></header>
      <details className="recruiting-filters"><summary>按当前状态筛选{filter && !filter.startsWith("cumulative:") ? ` · ${filterLabel}` : ""}<small>每人只计入一个当前状态</small></summary>
        <div className="presentation-stage-filters"><button className={!filter ? "selected" : ""} onClick={() => setFilter("")}>全部 {scene.candidates.length}</button>{Object.entries(stages).map(([id, name]) => <button className={filter === id ? "selected" : ""} key={id} onClick={() => setFilter(id)}>{name} {scene.metrics.current[id]}</button>)}<button className={filter === "missing" ? "selected" : ""} onClick={() => setFilter("missing")}>面试结束且缺评价 {scene.metrics.missing}</button></div>
      </details>
      <div className="presentation-table-scroll"><table><thead><tr><th>候选人</th><th>当前状态</th><th>评价提交情况</th><th>数据来源</th><th><span className="sr-only">详情</span></th></tr></thead><tbody>{visible.map(c => <tr key={c.id}>
        <td><button className="recruiting-person" onClick={() => setSelected(c.id)}><span className="recruiting-avatar">{c.name.slice(0, 1)}</span><span><strong>{c.name}</strong><small>{c.skills.slice(0, 2).join(" · ")}</small><small>{c.id} · {c.years} 年经验</small></span></button></td>
        <td><span className={`recruiting-status is-${c.currentStage}`}>{c.currentStageLabel}</span></td><td><span>{c.interviews.length ? `${c.interviews.filter(r => r.review?.status === "submitted").length} / ${c.interviews.length} 份已提交` : "尚未安排面试"}</span>{c.interviewsFinished && c.missingReviews > 0 && <small className="recruiting-missing">缺 {c.missingReviews} 份评价</small>}</td><td>{c.source}</td><td><button aria-label={`查看${c.name}档案`} onClick={() => setSelected(c.id)}>›</button></td>
      </tr>)}</tbody></table>{!visible.length && <p className="recruiting-no-results">没有符合当前条件的候选人</p>}</div>
    </article>
    {(error || loadError) && <p role="alert">{error || loadError}</p>}{progress.insight && <article className="presentation-insight"><small>Syntropic · 主动洞察</small><h2>{progress.insight.title}</h2><p>{progress.insight.summary ?? "查看候选人的评价证据与面试标准对齐建议。"}</p><small>分析快照 · {new Date(progress.insight.modified).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</small><div className="recruiting-insight-actions"><button onClick={() => onOpenInsight({ ...progress.insight!, cwd, fileName: "recruiting-interviewer-alignment-report.html", sessionId: `presentation:${scene.job!.id}` })}>查看完整洞察</button><button disabled={busy} onClick={() => void schedule()}>{progress.meeting ? "查看对齐会议" : "安排对齐会议"}</button></div>{progress.meeting && <p className="recruiting-meeting-status">已安排 · {progress.meeting.title}</p>}</article>}
    {scheduleOpen && <article><button onClick={() => setScheduleOpen(false)}>收起日程</button><PresentationSchedule/></article>}
    {candidate && <div className="presentation-candidate-backdrop"><article role="dialog" aria-label={`${candidate.name}候选人档案`} aria-modal="true"><button className="presentation-close" onClick={() => setSelected(null)}>关闭档案</button><small>{candidate.id} · {scene.job.title}</small><h2>{candidate.name}</h2><p>{candidate.school} · {candidate.company}</p><p>{candidate.summary}</p><ul>{candidate.projects.map((project) => <li key={project}>{project}</li>)}</ul><h3>面试评价</h3>{candidate.interviews.map((r) => <section key={r.id}><strong>{r.name} · {r.interviewer}</strong><p>{r.endedAt ? "已结束" : "已安排，尚未结束"} · {r.review?.status === "submitted" ? "评价已提交" : r.review?.status === "draft" ? "评价草稿（未提交）" : "评价未提交"}</p>{r.review && <p>{r.review.score} 分 · {r.review.opinion}</p>}</section>)}<h3>流程记录</h3><ul>{candidate.history.map((event, i) => <li key={i}>{new Date(event.at).toLocaleDateString()} · {event.text}</li>)}</ul></article></div>}
  </section>;
}
