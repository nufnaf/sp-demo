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

test('publication delegates a compact file reference with explicit internal-only authorization', () => {
  const filePath = '/work/ai-agent-engineer-jd.html';
  const prompt = publicationPrompt('http://127.0.0.1:30143/jobs/new?draft=example-id', 'AI Agent 工程师', filePath);
  assert.ok(prompt.includes(filePath));
  assert.match(prompt, /jd_file/);
  assert.ok(!prompt.includes('<jd-content>'));
  assert.ok(prompt.length < 800);
  assert.match(prompt, /browser_task/);
  assert.match(prompt, /无需再次确认/);
  assert.match(prompt, /不要访问 BOSS/);
  assert.match(prompt, /不要使用业务 API/);
});
