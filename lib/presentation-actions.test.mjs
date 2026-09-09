import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url);
const { presentationAction } = await jiti.import('./presentation-actions.ts');

test('publication and completed/negated generation never become JD generation', () => {
  for (const message of ['请发布已生成的 JD，不要重新生成 JD。', '发布这份 JD，url=http://127.0.0.1:30143/jobs/new?draft=abc']) assert.equal(presentationAction(message), 'publish-jd');
  for (const message of ['不要重新生成 JD', 'JD 已经生成了吗', '生成 JD 了吗', '如何生成 JD', 'AI Agent JD', '解释 draft 参数', 'http://localhost/?draft=JD']) assert.equal(presentationAction(message), 'help', message);
  assert.equal(presentationAction('请生成 JD，不要发布'), 'generate-jd');
  assert.equal(presentationAction('请根据飞书中的《星流科技业务介绍》，生成 AI Agent 工程师的岗位 JD'), 'generate-jd');
  assert.equal(presentationAction('帮我看看高级 AI Agent 研发工程师岗位，面试结束了多少人，还有几人的评价没齐？'), 'query-recruiting');
  assert.equal(presentationAction('取消当前任务'), 'cancel');
});
