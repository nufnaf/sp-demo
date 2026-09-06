import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("./HRRecruitingApp.tsx", import.meta.url), "utf8");
const desktopSource = await readFile(new URL("./AgentDesktop.tsx", import.meta.url), "utf8");

test("talent recruiting is available as a built-in desktop app", () => {
  assert.match(desktopSource, /id: "system:hr", name: "人才招聘"/);
  assert.match(desktopSource, /<HRRecruitingApp/);
  assert.match(desktopSource, /setHrRecruitingOpen\(true\)/);
});

test("the recruiting app covers the funnel, candidates, jobs, and sources", () => {
  assert.match(appSource, /招聘进展/);
  assert.match(appSource, /候选人/);
  assert.match(appSource, /岗位管理/);
  assert.match(appSource, /飞书招聘/);
  assert.match(appSource, /BOSS 直聘/);
  assert.match(appSource, /星流科技招聘官网/);
  assert.match(appSource, /北森 iTalent/);
  assert.match(appSource, /交给 Agent 跟进/);
  assert.match(appSource, /任何对候选人或面试官的外部消息都先生成草稿/);
});

test("recruiting sources use Agent OS installation and authorization status", () => {
  assert.match(appSource, /\/api\/app-store\/installations/);
  assert.match(appSource, /\/api\/apps\/feishu/);
  assert.match(appSource, /\/api\/apps\/boss-zhipin\/cli/);
  assert.match(appSource, /\/api\/apps\/beisen\/cli/);
  assert.match(appSource, /authState === "authenticated"/);
  assert.doesNotMatch(appSource, /SOURCE_STORAGE_KEY/);
});
