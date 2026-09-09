import type { RecruitingScene } from "./recruiting-scene.ts";

const escapeHtml = (value: string | number) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export const recruitingReportStyle = `
*{box-sizing:border-box}html{color-scheme:light}body{margin:0;padding:28px;background:#fff;color:#14211e;font:14px/1.75 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}h1{font-size:36px;font-weight:600;line-height:1.4;letter-spacing:-1px;margin:12px 0 16px}h2{font-size:18px;font-weight:600;line-height:1.6;margin:0 0 14px}p{color:#6f7e79;margin:8px 0}small{display:block;color:#77847f;font-size:12px}.eyebrow{color:#087457;font-size:14px;letter-spacing:1px}.role{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;border:1px solid #e3ebe7;border-radius:18px;background:#f6faf8;padding:18px 20px;margin:24px 0}.role strong{font-size:18px;font-weight:600}.role em{font-size:12px;font-style:normal;color:#087457;background:#e9f7f2;padding:6px 12px;border-radius:999px}section{background:#fff;border:1px solid #e3ebe7;border-radius:22px;padding:22px;margin:20px 0}.numbers{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.numbers>div+div{border-left:1px solid #e3ebe7;padding-left:20px}.numbers b{font-size:32px;line-height:1.5;color:#00a67d;font-weight:600}.numbers small{font-size:12px}.numbers-note{font-size:12px;color:#77847f}.evidence-scroll{overflow:auto}table{width:100%;border-collapse:collapse;min-width:540px;font-size:13px}th{color:#77847f;font-weight:500;text-align:left;background:#f7faf9}td,th{padding:16px;text-align:left;vertical-align:top;border-bottom:1px solid #e3ebe7}td p{margin-top:8px;font-size:13px}td b{font-weight:500}tr:last-child td{border-bottom:0}.recommendation{background:linear-gradient(100deg,#e7f6f0,#f5fbf8);border-color:#d4ece2}.recommendation .eyebrow{margin-bottom:10px}button{background:linear-gradient(130deg,#168c6c,#2bad87);color:white;border:0;padding:14px 22px;border-radius:14px;font-family:inherit;font-size:13px;font-weight:500;line-height:1.4;cursor:pointer;margin-top:12px}button:disabled{opacity:.65;cursor:default}button:focus-visible{outline:3px solid #00a67d66;outline-offset:3px}.scope-note{font-size:12px}.meeting-state{font-size:13px;color:#087457}@media(max-width:600px){body{padding:20px}h1{font-size:28px}.numbers{gap:12px}.numbers>div+div{padding-left:12px}.numbers b{font-size:28px}section{padding:18px}.role strong{font-size:16px}}
`;

export function recruitingInsightSummary(scene: RecruitingScene) {
  const insight = scene.insight;
  return insight ? `评价已齐的 ${insight.pairedCount} 位候选人中，${insight.disagreementCount} 位存在推进判断分歧。建议对照生产交付证据，统一面试评分标准。` : "";
}

export function renderRecruitingInsightReport(scene: RecruitingScene, generatedAt: string) {
  if (!scene.job || !scene.insight) throw new Error("招聘岗位与洞察尚未就绪");
  const { job, insight } = scene;
  const rows = insight.candidates.map(c => `<tr><td><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.id)}</small></td>${insight.interviewers.map(name => { const review = c.interviews.find(r => r.interviewer === name)?.review; return `<td><b>${escapeHtml(name)} · ${review ? `${escapeHtml(review.score)} 分` : "未提交评价"}</b><p>${escapeHtml(review?.opinion ?? "")}</p></td>`; }).join("")}</tr>`).join("");
  const time = new Date(generatedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(insight.title)}</title><style>${recruitingReportStyle}</style></head><body data-recruiting-presentation="true">
<small class="eyebrow">Syntropic · 主动洞察</small><h1>${escapeHtml(insight.title)}</h1><p>${escapeHtml(recruitingInsightSummary(scene))}</p>
<div class="role"><div><small>分析岗位 · 星流科技</small><strong>${escapeHtml(job.title)}</strong><small>${escapeHtml(job.department)} · ${escapeHtml(job.location)}</small></div><div><small>招聘计划</small><strong>${job.target} 位到岗</strong></div><em>内部招聘系统 · 已发布</em></div>
<section class="numbers"><div><b>${insight.pairedCount}</b><small>评价已齐的候选人</small></div><div><b>${insight.disagreementCount}</b><small>其中：推进判断存在分歧</small></div><div><b>${scene.metrics.missing}</b><small>面试结束但评价未齐（另计）</small></div></section>
<p class="numbers-note">未齐评价样本不纳入上述分歧统计。候选人进度以人才招聘中的当前状态为准。</p>
<section><small class="eyebrow">评价证据</small><h2>回到候选人的实际评价</h2><div class="evidence-scroll"><table><thead><tr><th>候选人</th>${insight.interviewers.map(name => `<th>${escapeHtml(name)} · 评价</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div></section>
<section><small class="eyebrow">标准建议</small><h2>建议统一面试标准</h2><p>使用共同的证据评分表：工具编排与系统边界、生产交付与故障恢复、评测与可观测性、沟通与学习能力。院校经历作为背景，不直接替代工程证据。</p><p>由 ${escapeHtml(insight.interviewers.join("、"))} 与 ${escapeHtml(job.owner)} 对照以上案例校准判断，再复核存在分歧的候选人。</p></section>
<section class="recommendation"><small class="eyebrow">推荐下一步</small><h2>安排标准对齐会议</h2><p>30 分钟 · 确认评价标准、讨论分歧案例、约定后续复核</p><button id="schedule">安排对齐会议</button><p id="result" class="meeting-state" role="status"></p></section>
<p class="scope-note">分析快照：${escapeHtml(time)}（北京时间）。以上结论基于生成时该岗位的候选人及评价记录；会议状态同步当前工作台。</p>
<script>document.getElementById('schedule').onclick=async function(){this.disabled=true;try{const r=await fetch('/api/apps/company-careers/actions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'schedule_alignment_meeting'})});const d=await r.json();if(!r.ok)throw Error(d.error);document.getElementById('result').textContent='已加入团队日程 · '+d.meeting.title;this.textContent='会议已安排';}catch(e){document.getElementById('result').textContent=e.message;this.disabled=false;}};</script></body></html>`;
}
