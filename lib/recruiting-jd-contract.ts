import { resolve } from "node:path";
import { presentationCwd } from "./presentation-runtime";

export const RECRUITING_JD_CONTRACT = "生成招聘 JD 时，必须根据本次实际读取的《星流科技业务介绍》撰写完整岗位正文，调用 save_recruiting_jd，path 为 ai-agent-engineer-jd.html，只提供 title 和 sections 的纯文本内容，title 固定为“AI Agent 工程师”，不附加公司名。正文面向候选人，覆盖公司背景、岗位信息（部门、地点、人数）、岗位职责和任职要求，保留关键招聘信息，删除重复表述。不生成“待确认事项”章节，不写招聘负责人的内部审阅待办、面试官姓名、内部评价安排或评价标准对齐事项。资料未明确的职级、薪酬福利、汇报关系、办公安排和面试流程直接省略，不编造，也不用“待确认”占位；如确实需要澄清，在交付后的对话中简短提出，不写入 JD。title、各节 heading 和 content 合计目标 900–1100 字符，最多 1200 字符（中文、英文、标点、空格、换行均按 Unicode 字符计数，不含模板 HTML/CSS）。超限时精简重写，不直接截断。公司主体是星流科技，不将办公工作台 Syntropic 写成其产品或岗位职责。此任务由工具使用固定模板渲染独立 HTML，优先于通用 HTML 设计要求：你不输出 HTML/CSS，不使用 write 编写页面，不交付 Markdown。工具会写入并读回核对，verified=true 后即可简短报告完成，无需再次 read 文件或复述全文。";

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
