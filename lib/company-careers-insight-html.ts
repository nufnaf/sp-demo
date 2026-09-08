import "server-only";

import type { CompanyCareersData, InterviewEvaluation } from "@/lib/company-careers";

function escapeHtml(value: string | number): string {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

function recommendationLabel(value: InterviewEvaluation["recommendation"] | undefined): string {
  if (value === "strong_yes") return "强烈推荐";
  if (value === "yes") return "推荐进入下一轮";
  return "不推荐";
}

function recommendationClass(value: InterviewEvaluation["recommendation"] | undefined): string {
  if (value === "no") return "no";
  if (value === "strong_yes") return "strong";
  return "yes";
}

function averageScore(evaluation: InterviewEvaluation | undefined): number {
  if (!evaluation) return 0;
  const values = Object.values(evaluation.scorecard);
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function renderCompanyCareersInsightHtml(data: CompanyCareersData): string {
  const insight = data.interviewerAlignment;
  const targetJob = data.jobs.find((job) => job.title === "高级 AI Agent 研发工程师");
  const targetApplications = data.applications.filter((application) => application.jobId === targetJob?.id);
  const stageDefinitions = [
    { id: "talent_pool", label: "人才库" },
    { id: "screening", label: "初筛" },
    { id: "interview", label: "面试" },
    { id: "final", label: "终面" },
    { id: "offer", label: "Offer" },
  ] as const;
  const stageCounts = stageDefinitions.map((stage) => ({
    ...stage,
    count: targetApplications.filter((application) => application.stage === stage.id).length,
  }));
  const maxStageCount = Math.max(...stageCounts.map((stage) => stage.count), 1);
  const affectedCandidates = insight.impact.candidateIds.flatMap((candidateId) => {
    const candidate = data.candidates.find((item) => item.id === candidateId);
    return candidate ? [candidate] : [];
  });

  const interviewerEvaluations = new Map(insight.interviewers.map((interviewer) => [
    interviewer.id,
    data.interviewEvaluations.filter((evaluation) => evaluation.interviewerId === interviewer.id),
  ]));
  const markEvaluations = interviewerEvaluations.get("interviewer_mark") ?? [];
  const timEvaluations = interviewerEvaluations.get("interviewer_tim") ?? [];
  const pairedCandidateIds = [...new Set(markEvaluations.map((evaluation) => evaluation.candidateId))]
    .filter((candidateId) => timEvaluations.some((evaluation) => evaluation.candidateId === candidateId));
  const alignedPairCount = pairedCandidateIds.filter((candidateId) => {
    const mark = markEvaluations.find((evaluation) => evaluation.candidateId === candidateId);
    const tim = timEvaluations.find((evaluation) => evaluation.candidateId === candidateId);
    return (mark?.recommendation === "no") === (tim?.recommendation === "no");
  }).length;
  const alignmentRate = pairedCandidateIds.length ? Math.round(alignedPairCount / pairedCandidateIds.length * 100) : 0;
  const affectedRate = insight.impact.highMatchCandidates
    ? Math.round(insight.impact.incorrectlyRejected / insight.impact.highMatchCandidates * 100)
    : 0;

  const reasonDefinitions = [
    { id: "education", label: "学历背景", className: "education" },
    { id: "experience", label: "工作/生产经验", className: "experience" },
    { id: "capability", label: "能力与项目证据", className: "capability" },
  ] as const;
  const reasonRows = insight.interviewers.map((interviewer) => {
    const evaluations = interviewerEvaluations.get(interviewer.id) ?? [];
    const counts = reasonDefinitions.map((reason) => ({
      ...reason,
      count: evaluations.filter((evaluation) => reason.id === "capability"
        ? evaluation.decisionReasonCode === "capability" || evaluation.decisionReasonCode === "evidence"
        : evaluation.decisionReasonCode === reason.id).length,
    }));
    return { interviewer, evaluations, counts };
  });

  const stageChart = stageCounts.map((stage, index) => `
    <div class="stage-row">
      <span class="stage-index">0${index + 1}</span>
      <span class="stage-name">${escapeHtml(stage.label)}</span>
      <span class="stage-track"><i style="width:${Math.round(stage.count / maxStageCount * 100)}%"></i></span>
      <strong>${stage.count}</strong>
      <small>${targetApplications.length ? Math.round(stage.count / targetApplications.length * 100) : 0}%</small>
    </div>`).join("");

  const interviewerCards = insight.interviewers.map((interviewer) => `
    <article class="interviewer-card">
      <header>
        <span class="avatar">${escapeHtml(interviewer.name.slice(0, 1))}</span>
        <span><strong>${escapeHtml(interviewer.name)}</strong><small>${escapeHtml(interviewer.role)} · n=${interviewer.evaluationCount}</small></span>
      </header>
      <div class="weight-row"><span>学历背景</span><b><i class="education" style="width:${interviewer.schoolBackgroundWeight}%"></i></b><em>${interviewer.schoolBackgroundWeight}</em></div>
      <div class="weight-row"><span>生产经验</span><b><i class="experience" style="width:${interviewer.productionExperienceWeight}%"></i></b><em>${interviewer.productionExperienceWeight}</em></div>
      <p>${escapeHtml(interviewer.conclusion)}</p>
    </article>`).join("");

  const reasonChart = reasonRows.map(({ interviewer, evaluations, counts }) => `
    <div class="reason-row">
      <span><strong>${escapeHtml(interviewer.name)}</strong><small>n=${evaluations.length}</small></span>
      <div class="stack" role="img" aria-label="${escapeHtml(interviewer.name)} 的主要决策依据构成">
        ${counts.map((reason) => `<i class="${reason.className}" style="width:${evaluations.length ? reason.count / evaluations.length * 100 : 0}%" title="${escapeHtml(reason.label)} ${reason.count} 份"><b>${reason.count || ""}</b></i>`).join("")}
      </div>
      <em>${counts.map((reason) => `${reason.label} ${reason.count}`).join(" · ")}</em>
    </div>`).join("");

  const candidateCards = affectedCandidates.map((candidate) => {
    const application = targetApplications.find((item) => item.candidateId === candidate.id);
    const mark = markEvaluations.find((evaluation) => evaluation.candidateId === candidate.id);
    const tim = timEvaluations.find((evaluation) => evaluation.candidateId === candidate.id);
    const evaluationCard = (name: string, evaluation: InterviewEvaluation | undefined) => `
      <section class="candidate-evaluation">
        <header><strong>${escapeHtml(name)}</strong><span class="decision ${recommendationClass(evaluation?.recommendation)}">${escapeHtml(recommendationLabel(evaluation?.recommendation))}</span></header>
        <div class="score-line"><span>综合评分卡</span><b><i style="width:${averageScore(evaluation)}%"></i></b><em>${averageScore(evaluation)}</em></div>
        <p>${escapeHtml(evaluation?.evidenceSummary ?? "暂无评价")}</p>
      </section>`;
    return `
      <article class="candidate-card">
        <header class="candidate-head">
          <span class="candidate-avatar">${escapeHtml(candidate.name.slice(0, 1))}</span>
          <span><strong>${escapeHtml(candidate.name)}</strong><small>${escapeHtml(candidate.currentTitle)}</small></span>
          <em>${candidate.matchScore}%<small>岗位匹配</small></em>
        </header>
        <div class="candidate-facts">
          <span><small>教育背景</small><b>${escapeHtml(candidate.topDegree)} · ${escapeHtml(candidate.educationSchool)}</b></span>
          <span><small>工作经验</small><b>${candidate.experienceYears} 年 · Agent ${candidate.agentExperienceYears} 年</b></span>
          <span><small>生产项目</small><b>${candidate.productionAgentProjects} 个</b></span>
        </div>
        <blockquote><small>关键能力证据</small>${escapeHtml(candidate.strongestEvidence)}</blockquote>
        <div class="candidate-comparison">${evaluationCard("Mark", mark)}${evaluationCard("TIM", tim)}</div>
        <footer><span>流程影响</span><strong>${escapeHtml(application?.status ?? "待复核")}</strong><p>${escapeHtml(application?.decisionReason ?? insight.impact.explanation)}</p></footer>
      </article>`;
  }).join("");

  const standardCards = insight.proposedStandard.principles.map((principle, index) => `
    <article class="standard ${principle.changed ? "changed" : ""}">
      <span>${String(index + 1).padStart(2, "0")}</span>
      <div><small>${escapeHtml(principle.category)}${principle.changed ? " · 建议更新" : ""}</small><strong>${escapeHtml(principle.title)}</strong><p>${escapeHtml(principle.description)}</p></div>
    </article>`).join("");
  const attendeeChips = insight.meetingProposal.attendees.map((attendee) => `<span><b>${escapeHtml(attendee.name)}</b><small>${escapeHtml(attendee.role)}</small></span>`).join("");
  const sourceRows = insight.sources.map((source, index) => `<li><span>0${index + 1}</span><div><strong>${escapeHtml(source.name)}</strong><small>${escapeHtml(source.detail)} · 更新于 ${escapeHtml(formatTime(source.updatedAt))}</small></div></li>`).join("");
  const generatedAt = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" }).format(new Date());

  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(insight.title)}</title>
<style>
:root{--ink:#17211d;--muted:#64716b;--paper:#f3f5f2;--card:#fff;--line:#dde3df;--line-strong:#cbd4ce;--forest:#174f3d;--forest-2:#246a52;--mint:#dceee6;--blue:#5d75a5;--gold:#bb7b36;--olive:#69766d;--orange:#b95f3d;--orange-open:#f8e9e3;--shadow:0 16px 45px rgba(25,45,36,.07)}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:var(--ink);background:var(--paper);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","Microsoft YaHei",sans-serif;-webkit-font-smoothing:antialiased}.shell{width:min(1160px,calc(100% - 44px));margin:0 auto}.mono,.metric-strip strong,.stage-row strong,.stage-row small,.weight-row em,.candidate-head>em{font-variant-numeric:tabular-nums}.topbar{height:58px;color:#fff;background:#123d30;border-bottom:1px solid rgba(255,255,255,.13)}.topbar .shell{height:100%;display:flex;align-items:center;justify-content:space-between}.brand{display:flex;align-items:center;gap:10px;font-size:12px;font-weight:760;letter-spacing:.02em}.brand i{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;color:#123d30;background:#d9ef73;font-style:normal}.top-meta{display:flex;align-items:center;gap:16px;color:rgba(255,255,255,.62);font-size:10px}.top-meta span:first-child{padding-right:16px;border-right:1px solid rgba(255,255,255,.15)}.hero{padding:56px 0 52px;color:#fff;background:#174f3d}.hero-grid{display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:54px;align-items:end}.eyebrow{display:flex;align-items:center;gap:9px;color:#c4ded3;font-size:10px;font-weight:750;letter-spacing:.11em;text-transform:uppercase}.eyebrow i{width:7px;height:7px;border-radius:50%;background:#d9ef73;box-shadow:0 0 0 5px rgba(217,239,115,.12)}h1{max-width:790px;margin:18px 0 0;font-size:42px;line-height:1.14;letter-spacing:-.045em}.hero-copy{max-width:790px;margin:18px 0 0;color:rgba(255,255,255,.68);font-size:14px;line-height:1.75}.hero-verdict{border:1px solid rgba(255,255,255,.15);padding:20px;background:rgba(8,33,25,.18)}.hero-verdict small,.hero-verdict strong,.hero-verdict span{display:block}.hero-verdict small{color:#bdd7cc;font-size:9px;font-weight:750;letter-spacing:.08em}.hero-verdict strong{margin-top:10px;font-size:22px;line-height:1.28}.hero-verdict span{margin-top:12px;color:rgba(255,255,255,.58);font-size:10px;line-height:1.55}.content{padding:28px 0 70px}.executive{border:1px solid var(--line);background:var(--card);box-shadow:var(--shadow)}.section-label{padding:13px 18px;border-bottom:1px solid var(--line);color:var(--forest-2);font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.executive-list{display:grid;grid-template-columns:repeat(3,1fr)}.executive-list article{min-height:138px;padding:20px 22px;border-right:1px solid var(--line)}.executive-list article:last-child{border:0}.executive-list small{display:block;color:#8a958f;font-size:9px}.executive-list strong{display:block;margin-top:8px;font-size:15px;line-height:1.45}.executive-list p{margin:8px 0 0;color:var(--muted);font-size:10px;line-height:1.65}.metric-strip{display:grid;grid-template-columns:repeat(5,1fr);margin-top:14px;border:1px solid var(--line);background:#fafbf9}.metric-strip article{padding:15px 17px;border-right:1px solid var(--line)}.metric-strip article:last-child{border:0}.metric-strip small,.metric-strip strong,.metric-strip span{display:block}.metric-strip small{color:#87928c;font-size:9px}.metric-strip strong{margin-top:5px;font-size:23px;letter-spacing:-.04em}.metric-strip span{margin-top:3px;color:var(--muted);font-size:9px}.narrative{margin:34px 0 14px}.narrative small{color:var(--forest-2);font-size:9px;font-weight:800;letter-spacing:.08em}.narrative h2{margin:7px 0 0;font-size:24px;line-height:1.28;letter-spacing:-.03em}.narrative p{max-width:870px;margin:10px 0 0;color:var(--muted);font-size:12px;line-height:1.75}.panel{border:1px solid var(--line);background:var(--card);box-shadow:0 9px 28px rgba(25,45,36,.045)}.panel-head{padding:16px 19px;display:flex;align-items:flex-start;justify-content:space-between;border-bottom:1px solid var(--line)}.panel-head strong,.panel-head small{display:block}.panel-head strong{font-size:13px}.panel-head small{margin-top:4px;color:#84908a;font-size:9px}.panel-head em{padding:5px 8px;color:var(--forest-2);background:var(--mint);font-size:9px;font-style:normal;font-weight:750}.evidence-grid{display:grid;grid-template-columns:1.03fr .97fr;gap:14px}.stage-chart{padding:17px 20px 20px}.stage-row{display:grid;grid-template-columns:28px 58px 1fr 28px 36px;align-items:center;gap:9px;min-height:34px}.stage-index{color:#a4ada8;font-size:8px}.stage-name{font-size:10px;font-weight:650}.stage-track{height:10px;background:#edf0ee;border-left:1px solid #aab4ae}.stage-track i{display:block;height:100%;min-width:3px;background:var(--forest-2)}.stage-row strong{text-align:right;font-size:11px}.stage-row small{text-align:right;color:#89948e;font-size:9px}.chart-note{padding:11px 19px;border-top:1px solid var(--line);color:#7c8881;background:#fafbf9;font-size:9px;line-height:1.6}.bias-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:15px}.interviewer-card{padding:16px;border:1px solid var(--line);background:#fcfdfc}.interviewer-card header{display:flex;align-items:center;gap:9px}.avatar{width:34px;height:34px;border:1px solid #c9d7d0;border-radius:50%;display:grid;place-items:center;color:var(--forest);background:var(--mint);font-size:11px;font-weight:800}.interviewer-card header strong,.interviewer-card header small{display:block}.interviewer-card header strong{font-size:12px}.interviewer-card header small{margin-top:3px;color:#8b958f;font-size:8px}.weight-row{margin-top:14px;display:grid;grid-template-columns:58px 1fr 25px;align-items:center;gap:8px;font-size:9px}.weight-row>b{height:8px;overflow:hidden;background:#ecefed}.weight-row b i{display:block;height:100%}.education{background:var(--blue)}.experience{background:var(--gold)}.capability{background:var(--olive)}.weight-row em{text-align:right;font-size:9px;font-style:normal;font-weight:750}.interviewer-card>p{margin:14px 0 0;padding-top:11px;border-top:1px solid var(--line);color:var(--muted);font-size:9px;line-height:1.6}.reason-chart{padding:19px}.reason-legend{display:flex;gap:14px;margin-bottom:16px;color:#6f7a74;font-size:9px}.reason-legend i{width:8px;height:8px;display:inline-block;margin-right:5px}.reason-row{display:grid;grid-template-columns:75px 1fr;gap:7px 12px;margin-top:14px}.reason-row>span strong,.reason-row>span small{display:block}.reason-row>span strong{font-size:10px}.reason-row>span small{margin-top:3px;color:#929c96;font-size:8px}.stack{height:22px;display:flex;overflow:hidden;background:#eef1ef}.stack i{display:grid;place-items:center;min-width:0;font-style:normal}.stack i b{color:#fff;font-size:8px}.reason-row>em{grid-column:2;color:#87918c;font-size:8px;font-style:normal}.divergence{margin-top:14px;border:1px solid #ddc5b9;background:#fffaf7}.divergence-inner{padding:19px 21px;display:grid;grid-template-columns:110px 1fr auto;gap:19px;align-items:center}.divergence-value strong{display:block;color:var(--orange);font-size:35px;letter-spacing:-.05em}.divergence-value small{display:block;margin-top:3px;color:#8e766b;font-size:9px}.divergence-copy strong{display:block;font-size:13px}.divergence-copy p{margin:6px 0 0;color:#725f56;font-size:10px;line-height:1.6}.divergence-meta{padding-left:18px;border-left:1px solid #e6d4ca;text-align:right}.divergence-meta strong,.divergence-meta small{display:block}.divergence-meta strong{font-size:18px}.divergence-meta small{margin-top:3px;color:#8e7e75;font-size:8px}.candidate-list{display:grid;gap:12px}.candidate-card{border:1px solid var(--line);background:var(--card);box-shadow:0 8px 25px rgba(25,45,36,.04)}.candidate-head{padding:15px 18px;display:flex;align-items:center;border-bottom:1px solid var(--line)}.candidate-avatar{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;color:var(--forest);background:var(--mint);font-size:11px;font-weight:800}.candidate-head>span:nth-child(2){margin-left:10px}.candidate-head>span strong,.candidate-head>span small{display:block}.candidate-head>span strong{font-size:12px}.candidate-head>span small{margin-top:3px;color:#8a958f;font-size:9px}.candidate-head>em{margin-left:auto;color:var(--forest-2);font-size:18px;font-style:normal;font-weight:800}.candidate-head>em small{display:block;color:#8b958f;font-size:7px;font-weight:500}.candidate-facts{display:grid;grid-template-columns:1.4fr 1fr .7fr;padding:13px 18px;border-bottom:1px solid var(--line);background:#fafbf9}.candidate-facts span{padding-right:14px;border-right:1px solid var(--line)}.candidate-facts span+span{padding-left:14px}.candidate-facts span:last-child{border:0}.candidate-facts small,.candidate-facts b{display:block}.candidate-facts small{color:#909a95;font-size:8px}.candidate-facts b{margin-top:4px;font-size:9px}.candidate-card blockquote{margin:0;padding:13px 18px;border-bottom:1px solid var(--line);color:#3f4c46;font-size:10px;line-height:1.6}.candidate-card blockquote small{display:block;margin-bottom:4px;color:var(--forest-2);font-size:8px;font-weight:750}.candidate-comparison{display:grid;grid-template-columns:1fr 1fr}.candidate-evaluation{padding:15px 18px;border-right:1px solid var(--line)}.candidate-evaluation:last-child{border:0}.candidate-evaluation header{display:flex;align-items:center;justify-content:space-between}.candidate-evaluation header strong{font-size:10px}.decision{padding:4px 7px;border:1px solid #c8dcd2;color:var(--forest-2);background:#eef7f3;font-size:8px;font-weight:750}.decision.no{border-color:#e4c9bd;color:#9d5136;background:var(--orange-open)}.decision.strong{border-color:#bcd5c9;color:#174f3d;background:#e1f0e9}.score-line{margin-top:12px;display:grid;grid-template-columns:60px 1fr 24px;align-items:center;gap:8px;font-size:8px}.score-line>b{height:6px;background:#ebefec}.score-line b i{display:block;height:100%;background:var(--forest-2)}.score-line em{text-align:right;font-style:normal;font-weight:750}.candidate-evaluation p{margin:10px 0 0;color:var(--muted);font-size:9px;line-height:1.55}.candidate-card>footer{padding:12px 18px;display:grid;grid-template-columns:55px auto 1fr;align-items:center;gap:10px;border-top:1px solid var(--line);background:#fffaf7}.candidate-card>footer span{color:#9a6956;font-size:8px;font-weight:750}.candidate-card>footer strong{font-size:9px}.candidate-card>footer p{margin:0;color:#79665d;font-size:8px;line-height:1.5}.standards{display:grid;grid-template-columns:1fr 1fr}.standard{min-height:137px;padding:18px;display:grid;grid-template-columns:29px 1fr;gap:9px;border-right:1px solid var(--line);border-bottom:1px solid var(--line)}.standard:nth-child(even){border-right:0}.standard:nth-last-child(-n+2){border-bottom:0}.standard.changed{background:#eef6f2}.standard>span{color:#a0aaa4;font-size:9px}.standard.changed>span{color:var(--forest-2);font-weight:750}.standard small,.standard strong{display:block}.standard small{color:#89948e;font-size:8px}.standard.changed small{color:var(--forest-2);font-weight:750}.standard strong{margin-top:7px;font-size:12px;line-height:1.45}.standard p{margin:7px 0 0;color:var(--muted);font-size:9px;line-height:1.6}.meeting{margin-top:14px;border:1px solid #bad3c7;background:#eef6f2}.meeting-main{padding:19px 20px;display:grid;grid-template-columns:44px 1fr auto;align-items:center;gap:14px}.meeting-icon{width:44px;height:44px;display:grid;place-items:center;color:#fff;background:var(--forest-2);font-size:11px;font-weight:800}.meeting-copy>small,.meeting-copy>strong,.meeting-copy>p{display:block}.meeting-copy>small{color:var(--forest-2);font-size:8px;font-weight:800}.meeting-copy>strong{margin-top:5px;font-size:14px}.meeting-copy>p{margin:4px 0 0;color:var(--muted);font-size:9px}.attendees{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.attendees span{padding:5px 7px;border:1px solid #d0ded7;background:#fff;font-size:8px}.attendees small{margin-left:5px;color:#8b958f}.meeting button{height:39px;border:0;padding:0 16px;color:#fff;background:var(--forest-2);cursor:pointer;font-size:10px;font-weight:760}.meeting button:hover{background:#174f3d}.meeting button:focus-visible{outline:3px solid rgba(93,117,165,.35);outline-offset:3px}.meeting button:disabled{opacity:.58;cursor:default}.meeting.done{border-color:#8dbba5}.meeting.done .meeting-icon{color:#174f3d;background:#d9ef73}.caveat{margin-top:28px;padding:17px 19px;border-left:3px solid var(--gold);color:#665d50;background:#f7f3eb}.caveat strong{display:block;font-size:10px}.caveat p{margin:6px 0 0;font-size:9px;line-height:1.65}.source-panel{margin-top:14px;border-top:1px solid var(--line-strong);padding-top:18px;display:grid;grid-template-columns:180px 1fr;gap:24px}.source-panel>header strong,.source-panel>header small{display:block}.source-panel>header strong{font-size:11px}.source-panel>header small{margin-top:5px;color:#8a958f;font-size:8px;line-height:1.5}.source-panel ul{margin:0;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;list-style:none}.source-panel li{display:flex;gap:8px;padding:10px;border:1px solid var(--line);background:#fafbf9}.source-panel li>span{color:#a0aaa4;font-size:8px}.source-panel li strong,.source-panel li small{display:block}.source-panel li strong{font-size:9px}.source-panel li small{margin-top:4px;color:#8b958f;font-size:7px;line-height:1.45}@media(max-width:900px){.hero-grid,.evidence-grid{grid-template-columns:1fr}.hero-verdict{max-width:430px}.metric-strip{grid-template-columns:repeat(3,1fr)}.metric-strip article:nth-child(3){border-right:0}.executive-list{grid-template-columns:1fr}.executive-list article{min-height:auto;border-right:0;border-bottom:1px solid var(--line)}.executive-list article:last-child{border-bottom:0}.source-panel{grid-template-columns:1fr}.source-panel ul{grid-template-columns:1fr}}@media(max-width:640px){.shell{width:min(100% - 24px,1160px)}.top-meta span:first-child{display:none}.hero{padding:38px 0}.hero-grid{gap:24px}h1{font-size:31px}.metric-strip{grid-template-columns:1fr 1fr}.metric-strip article:nth-child(3){border-right:1px solid var(--line)}.metric-strip article:nth-child(even){border-right:0}.bias-grid,.candidate-comparison,.standards{grid-template-columns:1fr}.candidate-evaluation,.standard{border-right:0;border-bottom:1px solid var(--line)}.standard:last-child{border-bottom:0}.candidate-facts{grid-template-columns:1fr}.candidate-facts span,.candidate-facts span+span{padding:7px 0;border-right:0;border-bottom:1px solid var(--line)}.candidate-facts span:last-child{border:0}.candidate-card>footer{grid-template-columns:1fr}.divergence-inner{grid-template-columns:1fr}.divergence-meta{padding:0;border:0;text-align:left}.meeting-main{grid-template-columns:44px 1fr}.meeting button{grid-column:2}.source-panel ul{grid-template-columns:1fr}.reason-row{grid-template-columns:58px 1fr}}@media print{body{background:#fff}.topbar{background:#123d30!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.hero{background:#174f3d!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.panel,.candidate-card,.executive{box-shadow:none;break-inside:avoid}.meeting button{display:none}.content{padding-bottom:20px}.narrative{break-after:avoid}}
</style></head><body>
<header class="topbar"><div class="shell"><span class="brand"><i>✦</i>Syntropic · AI 招聘洞察</span><span class="top-meta"><span>分析窗口：最近 ${insight.sample.periodDays} 天</span><span>生成于 ${escapeHtml(generatedAt)}</span></span></div></header>
<section class="hero"><div class="shell hero-grid"><div><span class="eyebrow"><i></i>Recruiting intelligence · 主动洞察</span><h1>${escapeHtml(insight.title)}</h1><p class="hero-copy">${escapeHtml(insight.summary)}</p></div><aside class="hero-verdict"><small>管理判断</small><strong>立即校准评价标准</strong><span>当前偏差已影响高匹配人才留存，并可能拖慢 ${targetJob?.headcount ?? 6} 个 HC 的招聘目标。</span></aside></div></section>
<main class="content shell">
  <section class="executive"><div class="section-label">Executive Summary · 管理结论</div><div class="executive-list">
    <article><small>01 · 核心判断</small><strong>两位面试官在使用不同的隐性门槛</strong><p>Mark 更依赖学历信号，TIM 更依赖工作与生产经验；共同评价候选人的推进结论一致率仅 ${alignmentRate}%（${alignedPairCount}/${pairedCandidateIds.length}）。</p></article>
    <article><small>02 · 业务影响</small><strong>${insight.impact.incorrectlyRejected} 位高匹配候选人被过早筛除</strong><p>占本轮 ${insight.impact.highMatchCandidates} 位重点候选人的 ${affectedRate}%，其中两人受学历门槛影响，一人受年限门槛影响。</p></article>
    <article><small>03 · 建议动作</small><strong>将学历和年限降为参考项，并复核候选人</strong><p>采用 ${escapeHtml(insight.proposedStandard.version)} 的能力证据标准，复核林然、许宁、苏悦，并召开 30 分钟评分校准会。</p></article>
  </div></section>
  <section class="metric-strip" aria-label="洞察样本概览">
    <article><small>招聘目标</small><strong>${targetJob?.headcount ?? 6}</strong><span>高级 Agent 工程师 HC</span></article>
    <article><small>洞察分析样本</small><strong>${insight.sample.candidates}</strong><span>最近 ${insight.sample.periodDays} 天可比评价候选人</span></article>
    <article><small>评价样本</small><strong>${insight.sample.evaluations}</strong><span>Mark 14 · TIM 13</span></article>
    <article><small>推进一致率</small><strong>${alignmentRate}%</strong><span>共同评价样本 n=${pairedCandidateIds.length}</span></article>
    <article><small>高匹配误筛率</small><strong>${affectedRate}%</strong><span>${insight.impact.incorrectlyRejected}/${insight.impact.highMatchCandidates} 位重点候选人</span></article>
  </section>

  <section class="narrative"><small>01 · 招聘现状</small><h2>目标岗位已有 ${targetApplications.length} 位候选人，但关键问题不在漏斗规模</h2><p>当前候选人分布覆盖从人才库到 Offer 的完整流程。阶段分布说明招聘活动在正常推进；真正的风险发生在评价规则层——相似能力证据因面试官不同而得到不同推进结论。</p></section>
  <div class="evidence-grid">
    <figure class="panel" style="margin:0"><figcaption class="panel-head"><span><strong>当前候选人阶段分布</strong><small>目标岗位 · 当前快照 · n=${targetApplications.length}</small></span><em>完整漏斗</em></figcaption><div class="stage-chart" role="img" aria-label="人才库 2 人，初筛 5 人，面试 5 人，终面 4 人，Offer 2 人">${stageChart}</div><div class="chart-note">数值为当前所在阶段人数，不代表历史阶段转化率；横条以人数最多阶段为 100% 显示。</div></figure>
    <figure class="panel" style="margin:0"><figcaption class="panel-head"><span><strong>面试官评价权重对比</strong><small>预设偏好指数 · 0–100 · n=${insight.sample.evaluations}</small></span><em>差异显著</em></figcaption><div class="bias-grid">${interviewerCards}</div><div class="chart-note">Mark 的学历权重比 TIM 高 ${Math.abs(insight.interviewers[0].schoolBackgroundWeight - insight.interviewers[1].schoolBackgroundWeight)} 点；TIM 的生产经验权重比 Mark 高 ${Math.abs(insight.interviewers[1].productionExperienceWeight - insight.interviewers[0].productionExperienceWeight)} 点。</div></figure>
  </div>

  <section class="narrative"><small>02 · 偏差证据</small><h2>评价分歧来自“用什么作为主要判断依据”</h2><p>对 27 份评价的主要决策原因进行归类后，Mark 的结论更多由学历与通用能力信号驱动；TIM 的结论高度集中在工作年限和生产经验。两种口径都可作为参考，但任何一项成为单项淘汰门槛，都会覆盖掉候选人的真实工程证据。</p></section>
  <figure class="panel" style="margin:0"><figcaption class="panel-head"><span><strong>主要决策依据构成</strong><small>每份评价仅归入一个首要原因 · Mark n=${markEvaluations.length} · TIM n=${timEvaluations.length}</small></span><em>100% 构成</em></figcaption><div class="reason-chart"><div class="reason-legend">${reasonDefinitions.map((reason) => `<span><i class="${reason.className}"></i>${reason.label}</span>`).join("")}</div>${reasonChart}</div><div class="chart-note">分类来自结构化评价的 decisionReasonCode；“能力与项目证据”合并 capability 与 evidence 两类。图表展示相关性和口径差异，不证明面试官偏好是唯一原因。</div></figure>
  <aside class="divergence"><div class="divergence-inner"><div class="divergence-value"><strong>${100 - alignmentRate}%</strong><small>推进结论分歧率</small></div><div class="divergence-copy"><strong>共同评价的 ${pairedCandidateIds.length} 人中，有 ${pairedCandidateIds.length - alignedPairCount} 人得到相反的推进判断</strong><p>其中 3 人属于高匹配候选人且已在流程中受到实际影响；另 1 人的生产交付证据确实不足，应保留为合理分歧而非误筛。</p></div><div class="divergence-meta"><strong>${insight.impact.incorrectlyRejected}/${pairedCandidateIds.length}</strong><small>已造成流程影响</small></div></div></aside>

  <section class="narrative"><small>03 · 候选人级审计</small><h2>三位候选人的能力证据充足，但被单项门槛覆盖</h2><p>以下不是抽象的“可能有偏差”，而是可以回到候选人资料、评分卡、评价原文和流程结论逐项核验的案例。综合评分卡为四项能力的等权平均，仅用于对照，不替代最终招聘决策。</p></section>
  <section class="candidate-list" aria-label="受影响候选人评价明细">${candidateCards}</section>

  <section class="narrative"><small>04 · 标准修正</small><h2>把隐性偏好改写成可审计的能力标准</h2><p>建议保留学历和工作年限作为背景信息，但不得作为单项淘汰依据。所有不通过结论必须对应岗位必备项，并引用候选人的具体行为或项目证据。</p></section>
  <section class="panel"><header class="panel-head"><span><strong>高级 AI Agent 研发工程师 · ${escapeHtml(insight.proposedStandard.version)}</strong><small>建议评分框架 · 2 项保持，2 项更新</small></span><em>等待 HR 确认</em></header><div class="standards">${standardCards}</div></section>
  <section class="meeting" id="meeting"><div class="meeting-main"><span class="meeting-icon" id="meeting-icon">日</span><div class="meeting-copy"><small id="meeting-status">推荐行动 · 需要 HR 确认</small><strong>${escapeHtml(insight.meetingProposal.title)}</strong><p>${escapeHtml(formatTime(insight.meetingProposal.recommendedSlot.startsAt))} · ${insight.meetingProposal.durationMinutes} 分钟 · ${escapeHtml(insight.meetingProposal.recommendedSlot.reason)}</p><div class="attendees">${attendeeChips}</div></div><button id="schedule" type="button">采用新标准并安排会议</button></div></section>

  <aside class="caveat"><strong>范围与限制</strong><p>结论只适用于最近 ${insight.sample.periodDays} 天、该目标岗位与当前 ${insight.sample.evaluations} 份评价；后续分析可结合更长时间窗口、岗位难度、面试轮次和候选人结构等控制变量。</p></aside>
  <section class="source-panel"><header><strong>证据与数据来源</strong><small>所有数字均来自已连接的招聘官网快照；未使用外部候选人数据。</small></header><ul>${sourceRows}</ul></section>
</main>
<script>
function scheduleLocalCalendar(){
  if(window.parent===window){
    return fetch('/api/apps/company-careers/actions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'schedule_alignment_meeting'})}).then(async function(response){var result=await response.json();result.ok=response.ok;return result;});
  }
  return new Promise(function(resolve,reject){
    var requestId='calendar-'+Date.now()+'-'+Math.random().toString(36).slice(2);
    var timer=setTimeout(function(){cleanup();reject(new Error('本地日历响应超时，请重试'));},120000);
    function cleanup(){clearTimeout(timer);window.removeEventListener('message',receive);}
    function receive(event){var data=event.data;if(event.source!==window.parent||!data||data.type!=='recruiting-calendar-result'||data.requestId!==requestId)return;cleanup();resolve(data);}
    window.addEventListener('message',receive);
    window.parent.postMessage({type:'recruiting-calendar',action:'schedule',requestId:requestId},'*');
  });
}
document.getElementById('schedule').addEventListener('click',async function(){var button=this;var status=document.getElementById('meeting-status');button.disabled=true;button.textContent='正在写入本地日历…';status.textContent='Agent 执行中 · 首次使用请确认 macOS 授权';try{var result=await scheduleLocalCalendar();if(!result.ok||!result.meeting||!result.localCalendar)throw new Error(result.error||'写入本地日历失败');document.getElementById('meeting').classList.add('done');document.getElementById('meeting-icon').textContent='✓';status.textContent=(result.localCalendar.status==='existing'?'日程已存在':'执行完成')+' · 已写入“'+result.localCalendar.calendarName+'”并打开 Mac 日历';button.textContent='已添加并打开日历';}catch(error){button.disabled=false;status.textContent=error&&error.message?error.message:'写入本地日历失败';button.textContent='重试添加到本地日历';}});
</script>
</body></html>`;
}
