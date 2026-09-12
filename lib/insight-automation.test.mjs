import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./insight-automation.ts", import.meta.url), "utf8");
const compiled = ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
const testModule = { exports: {} };
vm.runInNewContext(compiled, { module: testModule, exports: testModule.exports, require: () => ({}) });
const subject = testModule.exports;

test("insight task marker keeps observer runs out of normal task views", () => {
  assert.equal(subject.isInsightTaskSession({ firstMessage: `${subject.INSIGHT_TASK_MARKER}\n后台分析` }), true);
  assert.equal(subject.isInsightTaskSession({ firstMessage: "普通任务" }), false);
});

test("report metadata uses the first concrete insight instead of the file name", () => {
  const metadata = subject.extractInsightMetadata(`
    <html><head><title>通用洞察报告</title></head><body>
      <div class="insight risk">
        <div class="title">重复模拟任务正在污染真实工作统计</div>
        <p>连续五条测试任务被计入历史数据，导致重复率和任务体量出现明显偏差。</p>
      </div>
    </body></html>
  `, "insight-20260902.html");
  assert.equal(metadata.fileName, "insight-20260902.html");
  assert.equal(metadata.title, "重复模拟任务正在污染真实工作统计");
});

test("desktop summary uses report content, decodes markup, and ignores scripts", () => {
  const metadata = subject.extractInsightMetadata('<title>评价标准</title><script>const fake="<p>错误摘要</p>"</script><p>5 位候选人存在 <b>推进分歧</b>，建议对齐 A &amp; B 的评分标准。</p>', "report.html");
  assert.equal(metadata.summary, "5 位候选人存在 推进分歧 ，建议对齐 A & B 的评分标准。");
  assert.equal(subject.extractInsightMetadata("<title>空报告</title>", "empty.html").summary, undefined);
});
