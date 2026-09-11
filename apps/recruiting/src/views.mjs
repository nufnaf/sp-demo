import { randomUUID } from "node:crypto";
import {
  STAGES,
  stage,
  metrics,
  missingReviews,
  interviewsFinished,
  filterApplications,
} from "./domain.mjs";

export const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const e = escape;
const fmt = (value) =>
  value
    ? new Date(value).toLocaleString("zh-CN", {
        timeZone: "Asia/Shanghai",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "—";
const option = (value, label, current) =>
  `<option value="${e(value)}"${current === value ? " selected" : ""}>${e(label)}</option>`;
const hidden = (revision) =>
  `<input type="hidden" name="revision" value="${e(revision)}">`;
const pill = (text, tone = "") =>
  `<span class="pill ${tone}">${e(text)}</span>`;
const badge = (a) => pill(STAGES[stage(a)], stage(a));
const chevron = '<span aria-hidden="true">↗</span>';
const jobLink = (id) => `/jobs/${encodeURIComponent(id)}`;
const candidateLink = (a) => `/candidates/${encodeURIComponent(a.id)}`;

const navIcon = (name) => {
  const paths = {
    jobs: '<rect x="4" y="6" width="16" height="15" rx="2"/><path d="M9 6V3h6v3M4 11h16M10 11v3h4v-3"/>',
    candidates: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 4v2"/>',
    reviews: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 9 2 2 5-5M8 16h8"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
};

export function layout(title, body, active = "jobs") {
  const nav = (key, url, label) => `<a href="${url}" class="${active === key ? "active" : ""}"${active === key ? ' aria-current="page"' : ""}>${navIcon(key)}${label}</a>`;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><title>${e(title)} · 星流科技人才招聘</title><link rel="icon" type="image/svg+xml" href="/company-logo.svg"><link rel="stylesheet" href="/brand.css"><link rel="stylesheet" href="/style.css"><script src="/ui.js"></script></head><body>
  <a class="skip-link" href="#main">跳至主要内容</a>
  <aside class="sidebar"><a class="brand" href="/" aria-label="星流科技招聘首页"><img class="brand-mark" src="/company-logo.svg" width="38" height="38" alt=""><span><b>星流科技</b><small>NOVAFLOW</small></span></a><div class="workspace-label">人才与组织</div>
  <nav aria-label="主导航">${nav("jobs", "/", "招聘职位")}${nav("candidates", "/candidates", "候选人")}${nav("reviews", "/reviews", "面试评价")}</nav>
  <div class="sidebar-bottom"><nav aria-label="工作空间设置"><a href="/settings" class="${active === "settings" ? "active" : ""}"${active === "settings" ? ' aria-current="page"' : ""}>系统设置</a></nav><div class="identity"><span class="avatar">陈</span><div><b>陈晓</b><small>招聘负责人</small></div></div></div></aside>
  <div class="workspace"><header class="topbar"><span class="breadcrumb">人才招聘 <span class="slash">/</span> ${e(title)}</span><label class="theme-control" hidden><span>外观</span><select data-theme-select aria-label="外观主题"><option value="system">跟随系统</option><option value="light">浅色模式</option><option value="dark">深色模式</option></select></label></header><main id="main" tabindex="-1">${body}</main><footer>© 2026 星流科技 <span>人才与组织 · 内部招聘系统</span></footer></div></body></html>`;
}

function heading(kicker, title, description, action = "") {
  return `<div class="page-heading"><div><span class="eyebrow">${e(kicker)}</span><h1>${e(title)}</h1><p>${e(description)}</p></div>${action}</div>`;
}

function stats(applications, compact = false) {
  const m = metrics(applications);
  return `<div class="stats ${compact ? "compact" : ""}">${[
    ["已投递简历", m.applied, "累计人数"],
    ["通过简历筛选", m.screened, "累计人数"],
    ["进入面试流程", m.interviewing, "累计人数"],
    ["面试结束", m.finished, "所有已安排面试已结束"],
    ["面试通过", m.passed, "当前最终结论"],
    ["面试失败", m.failed, "当前最终结论"],
  ]
    .map(
      ([label, count, note], i) =>
        `<div class="stat ${i === 4 ? "success" : ""}"><span>${label}</span><strong>${count}<small>人</small></strong><small>${note}</small></div>`,
    )
    .join("")}</div>`;
}

const metricNote =
  '<p class="metric-note">统计口径：前四项为累计人数，不可相加；通过／失败为当前最终结论。待结论包含面试已结束、评价尚未齐全的候选人。</p>';

export function jobsPage(state, params) {
  const { data } = state;
  const m = metrics(data.applications);
  const q = (params.get("q") || "").trim().toLowerCase();
  const filtered = data.jobs.filter(
    (j) =>
      (!q ||
        `${j.title} ${j.department} ${j.owner}`.toLowerCase().includes(q)) &&
      (!params.get("department") || j.department === params.get("department")),
  );
  return layout(
    "招聘职位",
    `${heading("HIRING WORKSPACE", "招聘职位", "管理在招岗位，跟进候选人与面试评价。", '<a class="publish-link" href="/jobs/new">发布职位 ↗</a>')}
  <section class="overview"><div><span>正在招聘</span><strong>${data.jobs.length}<small>个职位</small></strong></div><div><span>招聘目标</span><strong>${data.jobs.reduce((s, j) => s + j.target, 0)}<small>人</small></strong></div><div><span>候选人总数</span><strong>${m.applied}<small>人</small></strong></div><a href="/reviews?finished=1&missing=1"><span>面试结束 · 待补评价</span><strong>${m.missing}<small>人 ${chevron}</small></strong></a></section>
  <section class="section"><div class="section-title"><h2>已发布职位 <span>${data.jobs.length}</span></h2><span class="muted">优先关注招聘进展与评价完整度</span></div>
  <form class="filters" method="get"><label class="search"><span>搜索职位</span><input name="q" type="search" value="${e(params.get("q"))}" placeholder="职位、部门或负责人"></label><label><span>部门</span><select name="department">${option("", "全部部门", params.get("department"))}${[...new Set(data.jobs.map((j) => j.department))].map((d) => option(d, d, params.get("department"))).join("")}</select></label><button type="submit">搜索职位</button><a href="/" class="text-link">清除</a></form>
  <div class="job-list">${
    filtered
      .map((j) => {
        const applications = data.applications.filter((a) => a.jobId === j.id);
        const count = metrics(applications);
        return `<article class="job-card"><div class="job-head"><div class="job-icon">${e(j.title.slice(0, 2))}</div><div class="job-title"><div>${pill(j.department)} ${j.priority ? pill("优先招聘", "warm") : ""}</div><h2><a href="${jobLink(j.id)}">${e(j.title)}</a></h2><p>${e(j.location)} <span>·</span> 全职 <span>·</span> ${e(j.owner)}</p></div><a class="button secondary" href="${jobLink(j.id)}">查看职位 ${chevron}</a></div>
    ${stats(applications, true)}<div class="job-footer"><div class="target">招聘目标 <b>${j.target} 人</b><span class="progress-track"><i style="width:${Math.min(100, Math.round((count.passed / j.target) * 100))}%"></i></span><span>面试通过 ${count.passed} / ${j.target} · 非入职人数</span></div><a href="${jobLink(j.id)}?finished=1&missing=1">${count.missing ? `${count.missing} 人待补评价` : "评价记录完整"} →</a></div></article>`;
      })
      .join("") || '<div class="empty">没有匹配的职位。试试其他关键词。</div>'
  }</div>${metricNote}</section>`,
    "jobs",
  );
}

function candidateFilters(data, params, jobId, listPath = "/candidates") {
  return `<form class="filters candidate-filters" method="get"><label class="search"><span>搜索候选人</span><input name="q" type="search" value="${e(params.get("q"))}" placeholder="姓名、编号、学校或公司"></label>${!jobId ? `<label><span>职位</span><select name="job">${option("", "全部职位", params.get("job"))}${data.jobs.map((j) => option(j.id, j.title, params.get("job"))).join("")}</select></label>` : ""}<label><span>当前状态</span><select name="stage">${option("", "全部状态", params.get("stage"))}${Object.entries(
    STAGES,
  )
    .map(([key, label]) => option(key, label, params.get("stage")))
    .join(
      "",
    )}</select></label><label class="checkbox"><input type="checkbox" name="finished" value="1"${params.has("finished") ? " checked" : ""}>面试全部结束</label><label class="checkbox"><input type="checkbox" name="missing" value="1"${params.has("missing") ? " checked" : ""}>缺少已提交评价</label><button type="submit">应用筛选</button><a class="text-link" href="${jobId ? jobLink(jobId) : listPath}">清除</a></form>`;
}

function candidateTable(applications, data) {
  return `<div class="table-wrap" role="region" aria-label="候选人列表，可横向滚动" tabindex="0"><table><thead><tr><th scope="col">候选人</th><th scope="col">应聘职位 / 背景</th><th scope="col">当前状态</th><th scope="col">面试进度</th><th scope="col">评价完整度</th><th scope="col">操作</th></tr></thead><tbody>${
    applications
      .map((a) => {
        const missing = missingReviews(a);
        const submitted = a.interviews.filter(
          (r) => r.review?.status === "submitted",
        ).length;
        return `<tr><td><a class="person" href="${candidateLink(a)}"><span class="avatar">${e(a.name.slice(-2))}</span><span><b>${e(a.name)}</b><small>${a.id} · ${e(a.source)}</small></span></a></td><td><b class="cell-title">${e(data.jobs.find((j) => j.id === a.jobId).title)}</b><small>${e(a.company)} · ${a.years} 年经验</small></td><td>${badge(a)}</td><td><b class="cell-title">${a.interviews.filter((r) => r.endedAt).length} / ${a.interviews.length} 轮已结束</b><small>${interviewsFinished(a) ? "全部已安排面试结束" : a.interviews.length ? "还有面试待完成" : "尚未进入面试"}</small></td><td>${a.interviews.length ? `<b class="cell-title ${missing.length ? "attention" : ""}">${submitted} / ${a.interviews.length} 份已提交</b><small>${missing.length ? missing.map((r) => `${e(r.interviewer)} · ${e(r.name)}${r.review?.status === "draft" ? "（草稿）" : "（未填写）"}`).join("<br>") : "已结束轮次无缺漏"}</small>` : '<span class="muted">—</span>'}</td><td><a class="text-link" aria-label="查看${e(a.name)}详情" href="${candidateLink(a)}">查看详情 ↗</a></td></tr>`;
      })
      .join("") ||
    '<tr><td colspan="6" class="empty">没有符合条件的候选人。请调整筛选条件。</td></tr>'
  }</tbody></table></div>`;
}

export function jobPage(state, id, params) {
  const { data, revision } = state;
  const j = data.jobs.find((j) => j.id === id);
  if (!j) return null;
  const applications = data.applications.filter((a) => a.jobId === id);
  const count = metrics(applications);
  const filters = new URLSearchParams(params);
  filters.set("job", id);
  const filtered = filterApplications(data, filters);
  return layout(
    j.title,
    `<a class="back" href="/">← 全部职位</a>${heading(j.department.toUpperCase(), j.title, `${j.location} · 全职 · ${j.owner}`, pill("已发布", "published"))}
  ${params.has("published") ? '<div role="status" class="notice success">职位发布成功，已加入内部招聘系统。</div>' : ""}
  ${j.publishedAt ? `<p class="muted">发布时间：${fmt(j.publishedAt)} · 职位编号：${e(j.id)}</p>` : ""}
  <div class="role-summary"><p class="job-description">${e(j.description)}</p><div>${j.skills.map((s) => pill(s)).join(" ")}<span class="target-inline">招聘目标 <b>${j.target} 人</b> · 面试通过 ${count.passed} 人</span></div></div>
  ${params.has("saved") ? '<div role="status" class="notice success">职位设置已保存。</div>' : ""}${stats(applications)}${metricNote}
  <section class="section"><div class="section-title"><h2>当前状态分布</h2><span class="muted">互斥状态，合计 ${applications.length} 人</span></div><div class="stage-strip">${Object.entries(
    STAGES,
  )
    .map(
      ([key, label]) =>
        `<a href="${jobLink(id)}?stage=${key}"${params.get("stage") === key ? ' aria-current="true"' : ""}><b>${count.current[key]}</b><span>${label}</span></a>`,
    )
    .join("")}</div></section>
  <section class="section"><div class="section-title"><h2>候选人 <span>${filtered.length}</span></h2><a class="text-link" href="${jobLink(id)}?finished=1&missing=1">查看面试结束且缺评价的候选人 (${count.missing}) →</a></div>${candidateFilters(data, params, id)}<p class="filter-summary" role="status">筛选结果：${filtered.length} 人${params.has("finished") ? " · 所有已安排面试均已结束" : ""}${params.has("missing") ? " · 至少一轮评价未提交（含草稿）" : ""}</p>${candidateTable(filtered, data)}</section>
  <details class="panel edit-job"><summary>职位设置 · 修改招聘目标与说明</summary><form method="post" action="/jobs/${e(id)}/save">${hidden(revision)}<div class="form-grid"><label>招聘目标（人）<input type="number" min="1" max="100" required name="target" value="${j.target}"></label><label>招聘负责人<input required maxlength="40" name="owner" value="${e(j.owner)}"></label></div><label>职位说明<textarea name="description" required maxlength="12000" rows="3">${e(j.description)}</textarea></label><button type="submit">保存职位设置</button></form></details>`,
  );
}

export function candidatesPage(state, params, reviews = false) {
  const applications = filterApplications(state.data, params);
  return layout(
    reviews ? "面试评价" : "候选人",
    `${heading(reviews ? "INTERVIEW FEEDBACK" : "TALENT PIPELINE", reviews ? "面试评价" : "候选人", reviews ? "跟进缺失评价，查看评分与面试结论。草稿不计入已提交评价。" : "统一查看全部职位的候选人、面试进度与流程记录。")}${candidateFilters(state.data, params, undefined, reviews ? "/reviews" : "/candidates")}<div class="section-title"><h2>${reviews ? "评价跟进" : "候选人列表"} <span>${applications.length}</span></h2><a class="text-link" href="/reviews?finished=1&missing=1">只看面试结束且缺评价</a></div><p role="status" class="filter-summary">筛选结果：${applications.length} 人${params.has("finished") ? " · 面试全部结束" : ""}${params.has("missing") ? " · 缺少已提交评价（含草稿）" : ""}</p>${candidateTable(applications, state.data)}`,
    reviews ? "reviews" : "candidates",
  );
}

const CONCLUSIONS = {
  undecided: "待判断",
  strong_yes: "强烈推荐",
  yes: "建议通过",
  no: "建议不通过",
};

export function candidatePage(state, id, params) {
  const a = state.data.applications.find((a) => a.id === id);
  if (!a) return null;
  const j = state.data.jobs.find((j) => j.id === a.jobId);
  const missing = missingReviews(a);
  return layout(
    a.name,
    `<a class="back" href="${jobLink(j.id)}">← ${e(j.title)} · 候选人列表</a><div class="candidate-heading"><span class="avatar large">${e(a.name.slice(-2))}</span><div><span class="eyebrow">${a.id} · ${e(a.source)}</span><h1>${e(a.name)} ${badge(a)}</h1><p>${e(a.company)} · ${a.years} 年经验 · ${e(a.school)}</p></div></div>
  ${params.has("saved") ? '<div role="status" class="notice success">保存成功，候选人记录已更新。</div>' : ""}
  ${missing.length ? `<div class="notice"><b>${interviewsFinished(a) ? "面试已全部结束，仍有" : "面试仍在进行，已结束轮次中有"} ${missing.length} 份评价待提交</b><span>${missing.map((r) => `${e(r.name)} · ${e(r.interviewer)}${r.review?.status === "draft" ? "（草稿）" : "（未填写）"}`).join("；")}</span></div>` : ""}
  <div class="detail-grid"><div><section class="panel"><h2>简历摘要</h2><p>${e(a.summary)}</p><div class="skills">${a.skills.map((s) => pill(s)).join(" ")}</div><h3>项目经历</h3>${a.projects.map((p, i) => `<div class="project"><span>0${i + 1}</span><p>${e(p)}</p></div>`).join("")}<div class="meta-line"><span>应聘职位 <a href="${jobLink(j.id)}">${e(j.title)}</a></span><span>投递日期 ${fmt(a.appliedAt)}</span></div></section>
  <section class="section" id="reviews"><div class="section-title"><h2>面试与评价</h2><span class="muted">${a.interviews.filter((r) => r.review?.status === "submitted").length} / ${a.interviews.length} 份已提交</span></div>${
    a.interviews
      .map(
        (
          r,
        ) => `<article class="panel review-card"><header><div><h3>${e(r.name)} <span>· ${e(r.interviewer)}</span></h3><small>${r.endedAt ? `面试结束 ${fmt(r.endedAt)}` : `计划时间 ${fmt(r.scheduledAt)}`}</small></div>${pill(r.review?.status === "submitted" ? "评价已提交" : r.review ? "评价草稿" : r.endedAt ? "缺少评价" : "待面试", r.review?.status === "submitted" ? "passed" : "warm")}</header>
  ${r.review ? `<div class="review-summary"><div><strong>${r.review.score}<small>/ 5</small></strong><b>${CONCLUSIONS[r.review.conclusion]}</b></div><p>${e(r.review.opinion || "草稿暂无意见")}</p><small>评价人 ${e(r.interviewer)} · 最近保存 ${fmt(r.review.updatedAt)}</small></div>` : '<p class="muted">尚未提交面试评价。</p>'}
  ${
    r.endedAt
      ? `<details${!r.review || r.review.status === "draft" ? " open" : ""}><summary>${r.review?.status === "submitted" ? "修改面试评价" : "填写面试评价"}</summary><form method="post" action="/candidates/${e(a.id)}/review/${e(r.id)}">${hidden(state.revision)}<div class="form-grid"><label>${e(r.name)}评分<select name="score">${[1, 2, 3, 4, 5].map((n) => option(String(n), `${n} 分${n === 5 ? " · 优秀" : n === 1 ? " · 明显不符" : ""}`, String(r.review?.score ?? 4))).join("")}</select></label><label>${e(r.name)}结论<select name="conclusion">${Object.entries(
          CONCLUSIONS,
        )
          .map(([key, text]) =>
            option(key, text, r.review?.conclusion ?? "undecided"),
          )
          .join(
            "",
          )}</select></label></div><label>${e(r.name)}评价意见<textarea name="opinion" maxlength="3000" rows="4" placeholder="记录具体证据、优势与待提升项">${e(r.review?.opinion)}</textarea></label><div class="form-actions"><button type="submit" name="status" value="submitted">提交${e(r.name)}评价</button><button class="secondary" type="submit" name="status" value="draft"${a.decision ? " disabled" : ""}>保存${e(r.name)}草稿</button></div></form></details>`
      : '<p class="muted">本轮面试尚未结束，暂不能评价。</p>'
  }</article>`,
      )
      .join("") || '<div class="panel empty">候选人尚未进入面试流程。</div>'
  }</section></div>
  <aside class="detail-aside"><section class="panel"><h2>招聘结论</h2>${badge(a)}<p>${e(a.decisionReason || "完成全部面试并提交所有评价后，记录最终结论。")}</p>${interviewsFinished(a) && !missing.length ? `<form method="post" action="/candidates/${e(a.id)}/decision">${hidden(state.revision)}<label>最终面试结论<select name="decision">${option("passed", "面试通过", a.decision ?? "passed")}${option("failed", "面试失败", a.decision)}</select></label><label>决策说明<textarea rows="3" required name="reason" maxlength="1000">${e(a.decisionReason)}</textarea></label><button type="submit">保存招聘结论</button></form>` : '<p class="hint">评价完整前无法标记最终通过／失败。</p>'}</section>
  <section class="panel"><h2>流程记录</h2><ol class="timeline">${a.history
    .slice()
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .map((h) => `<li><small>${fmt(h.at)}</small><p>${e(h.text)}</p></li>`)
    .join("")}</ol></section></aside></div>`,
    "candidates",
  );
}

export function settingsPage(state, params) {
  return layout(
    "系统设置",
    `${heading("WORKSPACE SETTINGS", "招聘工作空间", "管理团队信息与招聘数据。")}${params.has("reset") ? '<div class="notice success" role="status">招聘数据已恢复初始状态。</div>' : ""}<section class="panel settings-panel"><h2>工作空间</h2><p>所属组织：星流科技 NovaFlow</p><p>当前成员：陈晓 · 招聘负责人</p><p>业务范围：职位管理、候选人跟进与面试评价</p></section><section class="panel settings-panel"><h2>数据管理</h2><h3>恢复初始数据</h3><p>恢复职位、候选人和面试评价的初始记录，并清除后续修改。此操作仅影响当前招聘工作空间。</p><form method="post" action="/reset">${hidden(state.revision)}<label class="checkbox"><input type="checkbox" name="confirm" value="reset" required>我确认恢复初始记录，并清除当前招聘工作空间中的后续修改</label><button type="submit" class="danger">恢复初始数据</button></form></section>`,
    "settings",
  );
}

export function publishJobPage(state, params) {
  const requestedDraft = params.get("draft");
  const draft = requestedDraft && /^[a-zA-Z0-9-]{8,80}$/.test(requestedDraft) ? requestedDraft : randomUUID();
  const existing = state.data.jobs.find((job) => job.draft === draft);
  if (existing) return jobPage(state, existing.id, new URLSearchParams("published=1"));
  return layout("发布职位", `<a class="back" href="/">← 已发布职位</a>
    ${heading("NEW OPPORTUNITY", "发布新职位", "完善岗位信息，让合适的人找到我们。")}
    <form class="panel publish-job-form" method="post" action="/jobs/publish">
      ${hidden(state.revision)}<input type="hidden" name="draft" value="${e(draft)}">
      <label>岗位名称<input name="title" required maxlength="100" placeholder="例如：高级 AI Agent 研发工程师"></label>
      <div class="form-grid"><label>所属部门<input name="department" required maxlength="80" value="Agent Platform"></label><label>工作地点<input name="location" required maxlength="100" value="北京 / 上海"></label><label>招聘目标（人）<input name="target" type="number" min="1" max="100" value="6" required></label><label>招聘负责人<input name="owner" required maxlength="40" value="陈晓"></label></div>
      <label>岗位 JD<textarea name="description" required maxlength="12000" rows="12" placeholder="填写岗位介绍、职责与任职要求"></textarea></label>
      <footer><span>发布后可在职位详情中查看和维护。</span><button type="submit">发布职位</button></footer>
    </form>`);
}
