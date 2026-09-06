import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./company-careers-insight-html.ts", import.meta.url), "utf8");

test("the recruiting insight is an answer-first evidence report", () => {
  assert.match(source, /Executive Summary · 管理结论/);
  assert.match(source, /当前候选人阶段分布/);
  assert.match(source, /面试官评价权重对比/);
  assert.match(source, /主要决策依据构成/);
  assert.match(source, /候选人级审计/);
  assert.match(source, /范围与限制/);
  assert.match(source, /证据与数据来源/);
});

test("the report calculates findings from synchronized source data", () => {
  assert.match(source, /targetApplications\.filter/);
  assert.match(source, /pairedCandidateIds/);
  assert.match(source, /decisionReasonCode/);
  assert.match(source, /averageScore/);
  assert.match(source, /incorrectlyRejected \/ insight\.impact\.highMatchCandidates/);
});

test("the report preserves the HR action and honest chart qualifications", () => {
  assert.match(source, /采用新标准并安排会议/);
  assert.match(source, /schedule_alignment_meeting/);
  assert.match(source, /正在写入本地日历/);
  assert.match(source, /result\.localCalendar/);
  assert.match(source, /recruiting-calendar/);
  assert.match(source, /已添加并打开日历/);
  assert.match(source, /不代表历史阶段转化率/);
  assert.match(source, /不证明面试官偏好是唯一原因/);
  assert.match(source, /确定性 mock 数据/);
});
