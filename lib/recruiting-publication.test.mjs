import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
const { isJdDemoArtifact, publicationPrompt } = await createJiti(import.meta.url).import('./recruiting-publication.ts');

test('the demo suggestion is scoped to JD documents rather than all task outputs', () => {
  assert.equal(isJdDemoArtifact({ filePath: '/work/senior-agent-engineer-jd.html', taskTitle: '生成岗位 JD' }), true);
  assert.equal(isJdDemoArtifact({ filePath: '/work/招聘简章.md', taskTitle: '岗位说明' }), true);
  assert.equal(isJdDemoArtifact({ filePath: '/work/report.html', taskTitle: '季度财务报告' }), false);
  assert.equal(isJdDemoArtifact({ filePath: '/work/jd.png', taskTitle: 'JD 截图' }), false);
});

test('publication carries the complete JD and an explicit internal-only authorization to the normal Agent', () => {
  const body = '职责\n构建工具调用和评测系统。\n要求\n具备生产项目经验。';
  const prompt = publicationPrompt('http://127.0.0.1:30143/jobs/new?draft=example-id', 'AI Agent 工程师', body);
  assert.ok(prompt.includes(body));
  assert.match(prompt, /browser_task/);
  assert.match(prompt, /无需再次确认/);
  assert.match(prompt, /不要访问 BOSS/);
  assert.match(prompt, /不要使用业务 API/);
});
