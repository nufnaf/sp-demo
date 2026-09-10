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
  await writeFile(join(root, 'workspace', 'AGENTS.md'), '# 星流科技招聘工作台\n固定岗位：高级 AI Agent 研发工程师；Agent Platform；北京 / 上海；招聘 6 人。JD 使用本地固定内容，不调用模型或实时读取飞书。发布和招聘查询由程序直接交给 Pi 浏览器 Agent，使用已登记招聘网页。其他输入不启动模型任务。会议同步专用飞书演示日历，不发送邀请；每次完整重启恢复当天两个预设会议。\n', { mode: 0o600 });
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
      await writeFile(join(cwd, 'AGENTS.md'), '# 星流科技 · ' + preset.name + '\n仅展示预置资料和成果，不启动模型任务，不发送消息或邀请。Syntropic 是使用中的办公工作台，不是星流科技的业务产品。\n', { mode: 0o600 });
    }
  }
  await mkdir(join(root, 'application'), { recursive: true });
  await writeFile(join(root, 'application', 'workspaces.json'), JSON.stringify({ version: 1, workspaces: presets.map(({ directory, name }) => ({ cwd: join(root, directory), name, managed: true, createdAt: new Date().toISOString() })) }), { mode: 0o600 });
  await writeFile(join(root, 'application', 'app-installations.json'), JSON.stringify({ version: 1, installed: { 'boss-zhipin': { installedAt: new Date().toISOString() } } }), { mode: 0o600 });
  return { id, root, runs };
}
export async function cleanPresentationRun(run) {
  // Called only after all owned services and their descendants have stopped.
  await rm(run.root, { recursive: true, force: true });
}
