import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RECRUITING_JD_DEMO as jd } from "./recruiting-jd-fixture";

const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
// Embed the exact project/exported asset bytes so the saved HTML also works offline.
const asset = (path: string) => `data:image/svg+xml;base64,${readFileSync(join(process.cwd(), "public", path)).toString("base64")}`;


const icon = (name: string) => `<span class="jd-icon" style="--jd-icon:url(${asset(`icons/jd/${name}.svg`)})" aria-hidden="true"></span>`;

export function renderRecruitingJdDemo(): string {
  const cards = (items: readonly { icon: string; title: string; body: readonly string[] }[]) => items.map(item => `<div class="detail-card"><span class="card-icon" aria-hidden="true">${item.icon === "product" ? `<span class="product-arrow" aria-hidden="true">↗</span>` : item.icon === "⌘" ? icon("terminal") : item.icon === "◈" ? icon("network") : escape(item.icon)}</span><div><h3>${escape(item.title)}</h3>${item.body.map(text => `<p>${escape(text)}</p>`).join("")}</div></div>`).join("");
  const list = (title: string, items: readonly string[]) => `<section class="list-section"><h2>${title}</h2><ul>${items.map(item => `<li>${escape(item)}</li>`).join("")}</ul></section>`;
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="syntropic-artifact" content="recruiting-jd-demo"><title>${jd.title} · ${jd.company}</title>
<style>
${readFileSync(join(process.cwd(), "public/design/company/brand.css"), "utf8")}
${readFileSync(join(process.cwd(), "public/design/jd/result.css"), "utf8")}
</style></head><body><main><div class="content"><header class="hero"><div class="status"><i></i>正在招聘 · ${jd.headcount}个HC</div><div><h1>${jd.title}</h1><p class="subtitle">Agent Platform · 构建能在真实业务中可靠完成工作的智能体系统</p></div><div class="chips"><span class="chip">${icon("map-pin")}${jd.location}</span><span class="chip">${icon("briefcase-business")}全职 · 3–8 年</span><span class="chip">${icon("code-xml")}研发工程</span></div></header>
<section class="about"><h2>关于 ${jd.company}</h2>${jd.about.map(text => `<p>${escape(text)}</p>`).join("")}</section>
<article class="panel">${list("职位职责",jd.responsibilities)}${list("任职要求",jd.requirements)}</article>
<section class="panel"><h2>加分项</h2>${cards(jd.bonus)}</section><section class="panel"><h2>你将获得</h2>${cards(jd.benefits)}</section>
<section class="panel"><h2>招聘流程</h2><div class="process">${jd.process.map(([title,detail],i)=>`<div class="step"><b>${i+1}</b><h3>${title}</h3><p>${detail}</p></div>`).join("")}</div></section>
<footer class="closing"><h2>一起把 Agent 带进真实工作流</h2><p>${jd.closing}</p></footer></div>
<aside class="sidebar"><div class="brand"><img src="${asset("icons/company-careers-logo.svg")}" alt="星流科技标识"><div><strong>${jd.company}</strong><small>${jd.department}</small></div></div><p class="sidebar-label">招聘信息</p><dl>${[["招聘人数",`${jd.headcount} 位`],["工作地点",jd.location],["职位类型","全职"],["经验要求","3–8 年"],["工作方式","混合办公"]].map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl><div class="tags">${["Agent Runtime","Tool Use","Evaluation","Observability","Context Engineering"].map(tag=>`<span>${tag}</span>`).join("")}</div><div class="source"><div><small>内容依据</small><strong>飞书 · 星流科技业务介绍</strong></div><span aria-hidden="true">›</span></div><p class="updated">更新于今天 · 职位编号 AGT-ENG-026</p></aside></main></body></html>`;
}
