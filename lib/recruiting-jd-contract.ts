import { resolve } from "node:path";
import { presentationCwd } from "./presentation-runtime";

export const RECRUITING_JD_CONTRACT = "生成招聘 JD 时，必须根据本次实际读取的《星流科技业务介绍》撰写完整内容，用 write 保存到当前工作目录 ai-agent-engineer-jd.html。交付独立完整的 HTML 文档（含 doctype、html、head、body、UTF-8、标题和简洁内联样式），不是 Markdown、代码围栏或仅把 Markdown 改成 .html 后缀。公司主体是星流科技，不将办公工作台 Syntropic 写成其产品或岗位职责。完成前读回 HTML 核对内容与格式，确认后再报告完成。";

export function recruitingJdContract(cwd: string): string {
  const recruiting = presentationCwd();
  return recruiting && resolve(cwd) === resolve(recruiting) ? RECRUITING_JD_CONTRACT : "";
}

/** Carry the workspace's output requirement across the delegation boundary. */
export function recruitingTaskPrompt(cwd: string, prompt: string): string {
  const contract = recruitingJdContract(cwd);
  return contract && /(?:\bJD\b|岗位描述|职位描述|招聘说明)/i.test(prompt) && /生成|撰写|起草|制作|编写|write|creat|draft/i.test(prompt)
    ? `${prompt}\n\n工作台交付要求：${contract}` : prompt;
}
