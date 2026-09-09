"use client";
import { useEffect, useState } from "react";
import type { RecruitingScene, DemoMeeting } from "@/lib/recruiting-scene";
import type { InsightResult } from "@/lib/insight-automation";
import { recruitingHomeSchedule } from "@/lib/desktop-home";
const stages: Record<string, string> = { applied: "待简历筛选", screened: "待安排面试", interviewing: "面试进行中", pending: "面试结束 · 待结论", passed: "面试通过", failed: "面试失败", rejected: "简历未通过" };
export function PresentationSchedule({ recruiting = true, demoAppointments = false }: { recruiting?: boolean; demoAppointments?: boolean } = {}) {
  const [meeting, setMeeting] = useState<DemoMeeting | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setMeeting(null);
    if (!recruiting) return;
    let live = true;
    const read = async () => { try { const r = await fetch("/api/desktop/scenario", { cache: "no-store" }); if (!r.ok) throw new Error(); const data = await r.json(); if (live) { setMeeting(data.meeting ?? null); setError(""); } } catch { if (live) setError("暂时无法读取日程，请稍后重试"); } };
    void read(); const timer = setInterval(() => void read(), 2500); return () => { live = false; clearInterval(timer); };
  }, [recruiting]);
  const events = recruiting && now ? demoAppointments ? recruitingHomeSchedule(now, meeting) : meeting ? [meeting] : [] : [];
  return <section className="presentation-schedule"><small>星流科技 · 团队协作</small><h1>团队日程</h1>{error && <p role="alert">{error}</p>}{!events.length ? <p>当前工作台暂无已安排的会议。</p> : events.map(event => <article key={event.id}><em>已安排</em><h2>{event.title}</h2><p>{new Date(event.startsAt).toLocaleString("zh-CN")} · 30 分钟</p><h3>参会人</h3><p>{event.attendees.join(" · ")}</p><h3>会议议程</h3><ol>{event.agenda.map((a) => <li key={a}>{a}</li>)}</ol></article>)}</section>;
}
export function RecruitingPipeline({ scene, cwd, onOpenWebsite, onOpenInsight }: { scene: RecruitingScene; cwd: string; onOpenWebsite?: (url: string) => void; onOpenInsight: (result: InsightResult) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ insight?: { title: string; filePath: string; modified: string }; meeting?: DemoMeeting }>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const jobId = scene.job?.id;
  useEffect(() => {
    if (!jobId) return;
    let live = true;
    const load = async (trigger = false) => {
      try {
        const r = await fetch("/api/desktop/scenario", trigger ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "insight" }) } : { cache: "no-store" });
        const data = await r.json(); if (!r.ok) throw new Error(data.error || "暂时无法读取洞察"); if (live) { setProgress(data); setError(""); }
      } catch (e) { if (live) setError(e instanceof Error ? e.message : "洞察暂时不可用"); }
    };
    void load(); const timer = setTimeout(() => void load(true), 7000); const poll = setInterval(() => void load(), 3000);
    return () => { live = false; clearTimeout(timer); clearInterval(poll); };
  }, [jobId]);
  const schedule = async () => {
    setBusy(true);
    try { const r = await fetch("/api/desktop/scenario", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "meeting" }) }); const data = await r.json(); if (!r.ok) throw new Error(data.error); setProgress(data); setScheduleOpen(true); }
    catch (e) { setError(e instanceof Error ? e.message : "会议暂时无法安排"); } finally { setBusy(false); }
  };
  if (!scene.job) return <section className="presentation-pipeline"><small>星流科技 · 招聘目标</small><h1>高级 AI Agent 研发工程师</h1><p>Agent Platform · 北京 / 上海 · 招聘 6 人</p><article><h2>从团队资料开始</h2><p>根据团队业务资料准备岗位 JD，确认后即可发布岗位。</p></article></section>;
  const visible = scene.candidates.filter((c) => (!query || `${c.name} ${c.id} ${c.school} ${c.company} ${c.skills.join(" ")}`.toLowerCase().includes(query.toLowerCase())) && (!filter || (filter === "missing" ? c.interviewsFinished && c.missingReviews > 0 : filter === "cumulative:screened" ? Boolean(c.screenedAt) : filter === "cumulative:interviewing" ? c.interviews.length > 0 : filter === "cumulative:finished" ? c.interviewsFinished : c.currentStage === filter)));
  const candidate = scene.candidates.find((c) => c.id === selected);
  const cumulative = [["累计投递", scene.metrics.applied, ""], ["累计简历通过", scene.metrics.screened, "cumulative:screened"], ["累计进入面试", scene.metrics.interviewing, "cumulative:interviewing"], ["面试全部结束", scene.metrics.finished, "cumulative:finished"], ["结束但评价未齐", scene.metrics.missing, "missing"]] as const;
  return <section className="presentation-pipeline"><header><small>星流科技 · 内部招聘系统</small><h1>{scene.job.title}</h1><p>{scene.job.department} · {scene.job.location} · 招聘 {scene.job.target} 人</p><button onClick={() => onOpenWebsite?.(`/jobs/${scene.job!.id}`)}>打开岗位网页 ↗</button></header>
    <div className="presentation-metrics">{cumulative.map(([label, count, value]) => <button key={label} onClick={() => { setQuery(""); setFilter(value); }}><small>{label}</small><strong>{count}</strong></button>)}</div>
    <article><header><h2>候选人管线</h2><small>以下为当前状态人数，每人只计入一个状态</small></header><div className="presentation-stage-filters"><button className={!filter ? "selected" : ""} onClick={() => setFilter("")}>全部 {scene.candidates.length}</button>{Object.entries(stages).map(([id, name]) => <button className={filter === id ? "selected" : ""} key={id} onClick={() => setFilter(id)}>{name} {scene.metrics.current[id]}</button>)}<button className={filter === "missing" ? "selected" : ""} onClick={() => setFilter("missing")}>面试结束且缺评价 {scene.metrics.missing}</button></div>
    <input aria-label="搜索候选人" placeholder="搜索姓名、编号、学校或能力" value={query} onChange={(e) => setQuery(e.target.value)}/><small>{cumulative.find(([, , value]) => value && value === filter)?.[0] ?? stages[filter] ?? "全部候选人"} · 找到 {visible.length} 人</small><div className="presentation-table-scroll"><table><thead><tr><th>候选人</th><th>当前阶段</th><th>评价提交情况</th><th>来源</th></tr></thead><tbody>{visible.map((c) => <tr key={c.id}><td><button onClick={() => setSelected(c.id)}><strong>{c.name}</strong><small>{c.id} · {c.years} 年经验</small></button></td><td>{c.currentStageLabel}</td><td>{c.interviews.length ? `${c.interviews.filter((r) => r.review?.status === "submitted").length} / ${c.interviews.length} 份已提交` : "尚未安排面试"}</td><td>{c.source}</td></tr>)}</tbody></table></div></article>
    {error && <p role="alert">{error}</p>}{progress.insight && <article className="presentation-insight"><small>SYNTROPIC INSIGHTS</small><h2>{progress.insight.title}</h2><p>在评价已齐的 {scene.insight?.pairedCount} 位候选人中，{scene.insight?.disagreementCount} 位存在推进判断分歧。建议对照生产交付证据，统一面试评分标准。</p><button onClick={() => onOpenInsight({ ...progress.insight!, cwd, fileName: "recruiting-interviewer-alignment-report.html", sessionId: `presentation:${scene.job!.id}` })}>查看完整洞察</button><button disabled={busy} onClick={() => void schedule()}>{progress.meeting ? "查看对齐会议" : "安排对齐会议"}</button></article>}
    {scheduleOpen && <article><button onClick={() => setScheduleOpen(false)}>收起日程</button><PresentationSchedule demoAppointments/></article>}
    {candidate && <div className="presentation-candidate-backdrop"><article role="dialog" aria-label={`${candidate.name}候选人档案`} aria-modal="true"><button className="presentation-close" onClick={() => setSelected(null)}>关闭档案</button><small>{candidate.id} · {scene.job.title}</small><h2>{candidate.name}</h2><p>{candidate.school} · {candidate.company}</p><p>{candidate.summary}</p><ul>{candidate.projects.map((project) => <li key={project}>{project}</li>)}</ul><h3>面试评价</h3>{candidate.interviews.map((r) => <section key={r.id}><strong>{r.name} · {r.interviewer}</strong><p>{r.endedAt ? "已结束" : "已安排，尚未结束"} · {r.review?.status === "submitted" ? "评价已提交" : r.review?.status === "draft" ? "评价草稿（未提交）" : "评价未提交"}</p>{r.review && <p>{r.review.score} 分 · {r.review.opinion}</p>}</section>)}<h3>流程记录</h3><ul>{candidate.history.map((event, i) => <li key={i}>{new Date(event.at).toLocaleDateString()} · {event.text}</li>)}</ul></article></div>}
  </section>;
}
