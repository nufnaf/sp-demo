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

export function layout(title, body, active = "jobs") {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${e(title)} · NovaFlow 人才招聘</title><link rel="stylesheet" href="/style.css"></head><body>
  <aside class="sidebar"><a class="brand" href="/"><span class="brand-mark">✦</span><span><b>星流科技</b><small>NOVAFLOW</small></span></a><div class="workspace-label">人才与组织 <span>内部工作台</span></div>
  <nav aria-label="主导航"><a href="/" class="${active === "jobs" ? "active" : ""}"><span aria-hidden="true">▦</span> 招聘职位</a><a href="/candidates" class="${active === "candidates" ? "active" : ""}"><span aria-hidden="true">◎</span> 候选人</a><a href="/reviews" class="${active === "reviews" ? "active" : ""}"><span aria-hidden="true">☷</span> 面试评价</a></nav>
  <div class="side-note"><span>BUILD THE FUTURE OF WORK</span><p>让智能真正<br>进入工作流。</p><i>✦</i></div><a href="/settings" class="settings-link">系统设置 <span>↗</span></a><div class="identity"><span class="avatar">陈</span><div><b>陈晓</b><small>招聘负责人</small></div></div></aside>
  <div class="workspace"><header class="topbar"><span>人才招聘 <span class="slash">/</span> ${e(title)}</span><span class="environment"><i></i> 人才与组织 <span class="separator">|</span> NovaFlow 团队</span></header><main>${body}</main><footer>© 2026 NovaFlow Technology <span>NovaFlow · 内部招聘系统</span></footer></div></body></html>`;
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
    `${heading("HIRING WORKSPACE", "找到下一位，同行的人。", "从每一份简历到每一次判断，让招聘进展清晰可见。", '<span class="date-chip">2026 秋季招聘</span>')}
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

function candidateFilters(data, params, jobId) {
  return `<form class="filters candidate-filters" method="get"><label class="search"><span>搜索候选人</span><input name="q" type="search" value="${e(params.get("q"))}" placeholder="姓名、编号、学校或公司"></label>${!jobId ? `<label><span>职位</span><select name="job">${option("", "全部职位", params.get("job"))}${data.jobs.map((j) => option(j.id, j.title, params.get("job"))).join("")}</select></label>` : ""}<label><span>当前状态</span><select name="stage">${option("", "全部状态", params.get("stage"))}${Object.entries(
    STAGES,
  )
    .map(([key, label]) => option(key, label, params.get("stage")))
    .join(
      "",
    )}</select></label><label class="checkbox"><input type="checkbox" name="finished" value="1"${params.has("finished") ? " checked" : ""}>面试全部结束</label><label class="checkbox"><input type="checkbox" name="missing" value="1"${params.has("missing") ? " checked" : ""}>缺少已提交评价</label><button type="submit">应用筛选</button><a class="text-link" href="${jobId ? jobLink(jobId) : "/candidates"}">清除</a></form>`;
}

function candidateTable(applications, data) {
  return `<div class="table-wrap"><table><thead><tr><th>候选人</th><th>应聘职位 / 背景</th><th>当前状态</th><th>面试进度</th><th>评价完整度</th><th>操作</th></tr></thead><tbody>${
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
    `<a class="back" href="/">← 全部职位</a>${heading(j.department.toUpperCase(), j.title, `${j.location} · 全职 · ${j.owner}`, pill("已发布", "passed"))}
  <div class="role-summary"><p>${e(j.description)}</p><div>${j.skills.map((s) => pill(s)).join(" ")}<span class="target-inline">招聘目标 <b>${j.target} 人</b> · 面试通过 ${count.passed} 人</span></div></div>
  ${params.has("saved") ? '<div role="status" class="notice success">职位设置已保存。</div>' : ""}${stats(applications)}${metricNote}
  <section class="section"><div class="section-title"><h2>当前状态分布</h2><span class="muted">互斥状态，合计 ${applications.length} 人</span></div><div class="stage-strip">${Object.entries(
    STAGES,
  )
    .map(
      ([key, label]) =>
        `<a href="${jobLink(id)}?stage=${key}"><b>${count.current[key]}</b><span>${label}</span></a>`,
    )
    .join("")}</div></section>
  <section class="section"><div class="section-title"><h2>候选人 <span>${filtered.length}</span></h2><a class="text-link" href="${jobLink(id)}?finished=1&missing=1">查看面试结束且缺评价的候选人 (${count.missing}) →</a></div>${candidateFilters(data, params, id)}<p class="filter-summary" role="status">筛选结果：${filtered.length} 人${params.has("finished") ? " · 所有已安排面试均已结束" : ""}${params.has("missing") ? " · 至少一轮评价未提交（含草稿）" : ""}</p>${candidateTable(filtered, data)}</section>
  <details class="panel edit-job"><summary>职位设置 · 修改招聘目标与说明</summary><form method="post" action="/jobs/${e(id)}/save">${hidden(revision)}<div class="form-grid"><label>招聘目标（人）<input type="number" min="1" max="100" required name="target" value="${j.target}"></label><label>招聘负责人<input required maxlength="40" name="owner" value="${e(j.owner)}"></label></div><label>职位说明<textarea name="description" required maxlength="3000" rows="3">${e(j.description)}</textarea></label><button type="submit">保存职位设置</button></form></details>`,
  );
}

export function candidatesPage(state, params, reviews = false) {
  const applications = filterApplications(state.data, params);
  return layout(
    reviews ? "面试评价" : "候选人",
    `${heading(reviews ? "INTERVIEW FEEDBACK" : "TALENT PIPELINE", reviews ? "让每一次判断，有据可循。" : "每一份潜力，都值得看见。", reviews ? "跟进缺失评价，查看评分与面试结论。草稿不计入已提交评价。" : "统一查看全部职位的候选人、面试进度与流程记录。")}${candidateFilters(state.data, params)}<div class="section-title"><h2>${reviews ? "评价跟进" : "候选人列表"} <span>${applications.length}</span></h2><a class="text-link" href="/reviews?finished=1&missing=1">只看面试结束且缺评价</a></div><p role="status" class="filter-summary">筛选结果：${applications.length} 人${params.has("finished") ? " · 面试全部结束" : ""}${params.has("missing") ? " · 缺少已提交评价（含草稿）" : ""}</p>${candidateTable(applications, state.data)}`,
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
