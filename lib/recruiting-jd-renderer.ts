export interface RecruitingJdContent {
  title: string;
  sections: { heading: string; content: string }[];
}

export const RECRUITING_JD_MAX_CHARACTERS = 1200;

/** Unicode code points in model-supplied text, including punctuation and whitespace. */
export function countRecruitingJdCharacters(input: RecruitingJdContent): number {
  return [input.title, ...input.sections.flatMap(section => [section.heading, section.content])]
    .reduce((total, text) => total + Array.from(text).length, 0);
}

function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

/** The model supplies all business content; the host supplies only layout. */
export function renderRecruitingJd(input: RecruitingJdContent): string {
  if (typeof input.title !== "string" || !input.title.trim() || input.title.length > 120
    || !Array.isArray(input.sections) || input.sections.length < 3 || input.sections.length > 12
    || input.sections.some(section => typeof section.heading !== "string" || !section.heading.trim() || section.heading.length > 80
      || typeof section.content !== "string" || !section.content.trim() || section.content.length > 8000)
    || JSON.stringify(input).length > 18000) throw new Error("请提供完整岗位标题与 3–12 节纯文本正文。");
  const characters = countRecruitingJdCharacters(input);
  if (characters > RECRUITING_JD_MAX_CHARACTERS) {
    throw new Error(`JD 当前共 ${characters} 字符，超过 ${RECRUITING_JD_MAX_CHARACTERS} 字符上限，尚未写入文件。请精简重复表述，将标题、各节标题与正文合计压缩到 900–1100 字符，保留公司背景、岗位信息、职责、要求与待确认事项，然后重新调用保存工具；不要截断正文。`);
  }
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.title)} · 星流科技</title>
<style>
:root{color-scheme:light;--ink:#18312c;--muted:#687871;--line:#dce5de;--accent:#357052}*{box-sizing:border-box}body{margin:0;background:#f3f5f0;color:var(--ink);font:16px/1.8 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}main{max-width:850px;margin:32px auto;padding:44px 52px;background:#fff;border:1px solid var(--line);border-radius:12px}header{padding-bottom:28px;border-bottom:2px solid var(--accent)}header p{font-size:12px;letter-spacing:.16em;color:var(--accent);margin:0 0 12px}h1{font-size:32px;line-height:1.35;margin:0;overflow-wrap:anywhere}section{margin-top:28px}h2{font-size:18px;line-height:1.5;margin:0 0 10px;color:var(--accent)}.body{white-space:pre-wrap;overflow-wrap:anywhere}footer{border-top:1px solid var(--line);margin-top:36px;padding-top:16px;color:var(--muted);font-size:12px}@media(max-width:600px){main{margin:0;border:0;border-radius:0;padding:28px 22px}h1{font-size:27px}}@media print{body{background:#fff}main{margin:0;max-width:none;border:0;padding:12px}h2{break-after:avoid}section{orphans:3;widows:3}}
</style></head><body><main><header><p>星流科技 · 人才招聘</p><h1>${escapeHtml(input.title)}</h1></header>
${input.sections.map(section => `<section><h2>${escapeHtml(section.heading)}</h2><div class="body">${escapeHtml(section.content)}</div></section>`).join("\n")}
<footer>星流科技</footer></main></body></html>`;
}
