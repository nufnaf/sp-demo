import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url);
const { recruitingJdContract, recruitingTaskPrompt } = await jiti.import('./recruiting-jd-contract.ts');
const { buildJarvisSystemPrompt } = await jiti.import('./jarvis.ts');
test('HTML requirement reaches the recruiting dispatcher and the child even with an incomplete brief', () => {
  const previous=process.env.SYNTROPIC_PRESENTATION_ROOT;
  process.env.SYNTROPIC_PRESENTATION_ROOT='/tmp/jd-contract-test';
  try {
    const cwd='/tmp/jd-contract-test/workspace';
    assert.match(buildJarvisSystemPrompt(cwd), /JD 交给后台/);
    const brief='根据飞书业务介绍生成 AI Agent 工程师 JD，保存为文件。';
    assert.match(recruitingTaskPrompt(cwd,brief), /不交付 Markdown/);
    assert.match(recruitingTaskPrompt(cwd,brief), /读回核对/);
    assert.match(recruitingTaskPrompt(cwd,brief), /900–1100.*1200/);
    assert.match(recruitingTaskPrompt(cwd,brief), /不生成“待确认事项”章节/);
    assert.match(recruitingTaskPrompt(cwd,brief), /面试流程直接省略，不编造/);
    assert.match(recruitingTaskPrompt(cwd,brief), /面试官姓名、内部评价安排/);
    assert.doesNotMatch(buildJarvisSystemPrompt(cwd), /900–1100|1200/);
    assert.equal(recruitingTaskPrompt('/tmp/ordinary',brief),brief);
    assert.equal(recruitingJdContract('/tmp/jd-contract-test/workspaces/product'),'');
    assert.equal(recruitingTaskPrompt(cwd,'查询 AI Agent 工程师面试进度'),'查询 AI Agent 工程师面试进度');
  } finally { if(previous===undefined) delete process.env.SYNTROPIC_PRESENTATION_ROOT; else process.env.SYNTROPIC_PRESENTATION_ROOT=previous; }
});
