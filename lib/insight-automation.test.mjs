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

test("existing completed tasks become the baseline and five new completions queue an analysis", () => {
  let state = subject.createInsightAutomationState();
  assert.deepEqual([...state.results], []);
  state = subject.observeCompletedTasks(state, ["old-1", "old-2"]);
  assert.deepEqual([...state.queuedCompletedIds], []);
  state = subject.observeCompletedTasks(state, ["old-1", "old-2", "new-1", "new-2", "new-3", "new-4", "new-5"]);
  assert.deepEqual([...state.queuedCompletedIds], ["new-1", "new-2", "new-3", "new-4", "new-5"]);
  assert.equal(state.queuedCompletedIds.length >= subject.INSIGHT_BATCH_SIZE, true);
});

test("insight prompt only permits HTML generation when useful insight exists", () => {
  const prompt = subject.buildInsightAnalysisPrompt({
    taskTitles: ["完成登录流程", "修复结算错误"],
    reminders: [{ id: "1", title: "复盘支付失败", completed: true, createdAt: "2026-09-01" }],
    timestamp: "20260902-120000",
  });
  assert.match(prompt, /<pi-web-insight-analysis>/);
  assert.match(prompt, /只有在存在具体、可执行、非显而易见的洞察时/);
  assert.match(prompt, /18–28 个汉字/);
  assert.match(prompt, /如果没有足够有价值的洞察，不要创建/);
  assert.match(prompt, /\.pi-insights\/insight-20260902-120000\.html/);
  assert.match(prompt, /完成登录流程/);
  assert.match(prompt, /复盘支付失败/);
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
