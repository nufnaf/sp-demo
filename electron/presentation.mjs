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
  await writeFile(join(root, 'workspace', 'AGENTS.md'), `# 星流科技招聘工作台\n本工作台只使用已授权的团队资料。招聘主体是星流科技，业务是企业 Agent 系统。Syntropic 仅为正在使用的办公工作台名称，不是星流科技的业务产品，不要把它写进公司介绍或岗位职责。\n目标岗位：AI Agent 工程师；Agent 研发；招聘 6 人；杭州 / 上海。\n读取飞书业务资料请使用 feishu_demo_documents 与 feishu_demo_read，不使用 CLI 或个人资料。资料读取失败时如实报告，不编造正文或用预设 JD 替代。\n根据本轮实际读取资料撰写完整 JD 正文，调用 save_recruiting_jd 保存 ai-agent-engineer-jd.html，标题为 AI Agent 工程师。只提供纯文本 title/sections；标题、各节标题与正文合计目标 900–1100 字符，最多 1200 字符（含标点、空格、换行，不含 HTML/CSS），保留关键招聘信息、删除重复表述，超限时精简重写而非截断。工具负责固定 HTML 模板、写入和读回核对；不要自己输出 HTML/CSS，也无需再调用 write/read 检查模板。可自然引用《星流科技业务介绍》。面向用户的回复、JD 和成果只呈现业务内容，不添加“演示”“模拟”“虚构数据”“真实读取”“本轮测试”等制作说明，也不描述内部实现与鉴权方式。成果完成后用成果名称说明位置，不在默认回复里展开本机绝对路径或内部目录。\n发布和招聘查询只通过 browser_task 操作已登记招聘网页，禁止使用业务 API、脚本或修改招聘数据文件替代。\n会议仅记录在当前工作台的团队日程，不发送邀请、消息、邮件，不调用 macOS 日历，也不声称已向参会人发送邀请。\n`, { mode: 0o600 });
  const presets = [
    { directory: 'workspace', name: '招聘工作台' },
    { directory: 'workspaces/product-release', name: '产品发布工作台', file: '产品发布计划.md', content: '# 星流科技 · 产品发布计划\n\n目标：完成企业 Agent 系统季度版本发布。\n\n## 交付清单\n- 产品 Brief 与核心叙事：已完成初稿，待评审。\n- 发布说明与内部 FAQ：整理功能变化、适用场景与常见问题。\n- 上线检查：确认文档、产品体验和支持安排。\n\n## 协作节奏\n产品、研发与客户成功共同评审，确认后推进发布。' },
    { directory: 'workspaces/research-insights', name: '调研洞察', file: '用户访谈记录.md', content: '# 用户访谈记录\n\n## 核心发现\n用户希望持续看到任务进展，而不只是最终结果。\n\n## 关注问题\n- 资料来源是否清楚，成果能否追溯。\n- 长任务中能否随时查看进展、停止或接管。\n- 多项工作能否分开组织，切换时保留上下文。\n\n## 后续研究\n围绕任务可见性与成果审阅，整理下一轮访谈提纲。' },
    { directory: 'workspaces/personal-focus', name: '个人工作台', file: '本周重点.md', content: '# 本周重点\n\n- 确认产品叙事与发布材料。\n- 完成发布评审。\n- 整理客户反馈。\n\n## 今日安排\n上午审阅资料，下午预留专注时间，收工前整理明日重点。' },
  ];
  for (const preset of presets) {
    const cwd = join(root, preset.directory);
    await mkdir(cwd, { recursive: true });
    if (preset.file) {
      await writeFile(join(cwd, preset.file), preset.content, { mode: 0o600 });
      await writeFile(join(cwd, 'AGENTS.md'), '# 星流科技 · ' + preset.name + '\n只使用当前工作台资料。按实际请求生成成果，不编造外部信息，不发送消息或邀请。Syntropic 是使用中的办公工作台，不是星流科技的业务产品。\n', { mode: 0o600 });
    }
  }
  await mkdir(join(root, 'application'), { recursive: true });
  await writeFile(join(root, 'application', 'workspaces.json'), JSON.stringify({ version: 1, workspaces: presets.map(({ directory, name }) => ({ cwd: join(root, directory), name, managed: true, createdAt: new Date().toISOString() })) }), { mode: 0o600 });
  return { id, root, runs };
}
export async function cleanPresentationRun(run) {
  // Called only after all owned services and their descendants have stopped.
  await rm(run.root, { recursive: true, force: true });
}
