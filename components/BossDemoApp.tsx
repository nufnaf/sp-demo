"use client";

import { useEffect, useState } from "react";
import { BriefcaseBusiness, Building2, CheckCircle2, MapPin, Users } from "lucide-react";
import { BOSS_DEMO_ACCOUNT } from "@/lib/boss-demo";
import type { PublishedRecruitingJob } from "@/lib/recruiting-publication";
import "./BossDemoApp.css";

export function BossDemoApp() {
  const [jobs, setJobs] = useState<PublishedRecruitingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch("/api/apps/internal-recruiting", { cache: "no-store", signal: controller.signal });
        const data = await response.json() as { jobs?: PublishedRecruitingJob[] };
        if (!response.ok || !Array.isArray(data.jobs)) throw new Error("发布记录暂时无法读取，请稍后重试。");
        if (controller.signal.aborted) return;
        setJobs(data.jobs.filter(job => job.bossPublication?.status === "published"));
        setError(null);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "发布记录暂时无法读取。");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void refresh();
    window.addEventListener("agent-os:presentation-changed", refresh);
    return () => { controller.abort(); window.removeEventListener("agent-os:presentation-changed", refresh); };
  }, [revision]);

  return <div className="boss-demo">
    <header className="boss-demo-header">
      <div className="boss-demo-brand"><span aria-hidden="true">BOSS</span><div><h1>BOSS 直聘</h1><p>{BOSS_DEMO_ACCOUNT}</p></div></div>
      <span className="boss-demo-connected"><CheckCircle2 size={15}/>已连接</span>
    </header>
    <main>
      <section className="boss-demo-account"><Building2 size={22}/><div><strong>企业招聘空间</strong><p>职位发布与招聘工作台保持同步</p></div><small>演示预设</small></section>
      <div className="boss-demo-section-title"><h2>招聘中的职位</h2><span>{jobs.length} 个职位</span></div>
      {error ? <div className="boss-demo-empty" role="alert"><p>{error}</p><button type="button" onClick={() => setRevision(value => value + 1)}>重新加载</button></div>
        : loading ? <p role="status">正在读取职位…</p>
          : jobs.length ? <div className="boss-demo-jobs">{jobs.map(job => <article key={job.id}>
            <header><BriefcaseBusiness size={20}/><span>已发布</span></header>
            <h3>{job.title}</h3><p>{job.department} · {job.owner}</p>
            <div className="boss-demo-job-facts"><span><MapPin size={15}/>{job.location}</span><span><Users size={15}/>招聘 {job.headcount} 人</span></div>
            <footer><CheckCircle2 size={15}/><span>已同步到 BOSS 直聘<small>模拟发布结果 · {new Date(job.bossPublication!.publishedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}</small></span></footer>
          </article>)}</div>
            : <div className="boss-demo-empty"><BriefcaseBusiness size={32}/><h3>招聘账号已就绪</h3><p>在招聘工作台生成 JD 并发布岗位后，<br/>这里会同步显示职位和发布结果。</p></div>}
      <p className="boss-demo-footnote">本窗口展示演示数据，职位发布结果为模拟结果。</p>
    </main>
  </div>;
}
