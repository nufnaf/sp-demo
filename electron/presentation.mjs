import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

// A new run never opens a previous run's files. The supervisor owns cleanup.
export async function createPresentationRun(userData) {
  const runs = join(userData, 'presentation-runs');
  await mkdir(runs, { recursive: true });
  const id = randomUUID();
  const root = join(runs, id);
  await mkdir(join(root, 'workspace'), { recursive: true });
  await writeFile(join(root, 'owner.json'), JSON.stringify({ id, pid: process.pid }), { mode: 0o600 });
  await writeFile(join(root, 'workspace', 'AGENTS.md'), `# 星流科技招聘演示\n本工作台只使用专用演示资料。公司为星流科技，Syntropic 是办公 AI 工作台产品。\n目标岗位：AI Agent 工程师；Agent 研发；招聘 6 人；杭州 / 上海。\n读取飞书业务资料请使用 feishu_demo_documents 与 feishu_demo_read，不使用 CLI 或个人资料。资料读取失败时如实报告，不编造正文或用预设 JD 替代。\n根据本轮实际读取资料生成 JD，保存为当前工作目录的 ai-agent-engineer-jd.html，标题为 AI Agent 工程师，注明实际飞书来源。\n发布和招聘查询只通过 browser_task 操作已登记招聘网页，禁止使用业务 API、脚本或修改招聘数据文件替代。\n会议只在演示日程中模拟，不发送邀请、消息、邮件，不调用 macOS 日历。\n`, { mode: 0o600 });
  return { id, root, runs };
}
export async function cleanPresentationRun(run) {
  // Called only after all owned services and their descendants have stopped.
  await rm(run.root, { recursive: true, force: true });
}
