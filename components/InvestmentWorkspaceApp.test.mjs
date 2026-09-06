import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("./InvestmentWorkspaceApp.tsx", import.meta.url), "utf8");
const cssSource = await readFile(new URL("./InvestmentWorkspaceApp.css", import.meta.url), "utf8");
const desktopSource = await readFile(new URL("./AgentDesktop.tsx", import.meta.url), "utf8");
const desktopCssSource = await readFile(new URL("./AgentDesktop.css", import.meta.url), "utf8");
const recruitingCssSource = await readFile(new URL("./HRRecruitingApp.css", import.meta.url), "utf8");
const workspaceAppsCssSource = await readFile(new URL("./WorkspaceApps.css", import.meta.url), "utf8");

test("investment management is available as a built-in desktop app", () => {
  assert.match(desktopSource, /id: "system:investment", name: "投资管理"/);
  assert.match(desktopSource, /<InvestmentWorkspaceApp key=\{activeCwd.*cwd=\{activeCwd\} onStartTask=\{startTask\} onNotice=\{setNotice\} onOpenSource=/);
  assert.match(desktopSource, /setInvestmentWorkspaceOpen\(true\)/);
});

test("the investment window opens inside the desktop work area", () => {
  assert.match(desktopCssSource, /\.agent-os-window-investment\s*\{[^}]*width:min\(1180px,calc\(100vw - 112px\)\);height:min\(720px,calc\(100vh - 174px\)\)/);
});

test("the investment app manages a staged portfolio and per-company research", () => {
  assert.match(appSource, /<h1>投资组合<\/h1>/);
  assert.match(appSource, /初步接触.*商业尽调.*投决中.*已交割.*退出中/s);
  assert.match(appSource, /投资公司列表/);
  assert.match(appSource, /星云科技/);
  assert.match(appSource, /环流机器人/);
  assert.match(appSource, /光屿芯片/);
  assert.match(appSource, /澄川生物/);
  assert.match(appSource, /北辰能源/);
  assert.match(appSource, /RESEARCH TIMELINE/);
});

test("company and deal records are separated with professional pipeline fields", () => {
  assert.match(appSource, /interface DealRecord/);
  assert.match(appSource, /companyStatus/);
  assert.match(appSource, /当前交易/);
  assert.match(appSource, /项目来源 \/ 最近接触/);
  assert.match(appSource, /下一步动作/);
  assert.match(appSource, /标记完成/);
  assert.match(appSource, /恢复待办/);
  assert.match(appSource, /经纬王总引荐/);
});

test("company detail includes relationships and investment position", () => {
  assert.match(appSource, /关键联系人与关系/);
  assert.match(appSource, /内部关系人/);
  assert.match(appSource, /关系强度/);
  assert.match(appSource, /投资与持仓/);
  assert.match(appSource, /投资工具/);
  assert.match(appSource, /投前估值/);
  assert.match(appSource, /当前持股/);
  assert.match(appSource, /MOIC/);
  assert.match(appSource, /董事席位/);
});

test("company detail connects Feishu, Gmail, and Qichacha as traceable sources", () => {
  assert.match(appSource, /name: "飞书"/);
  assert.match(appSource, /name: "Google 邮箱"/);
  assert.match(appSource, /name: "企查查"/);
  assert.match(appSource, /\/api\/apps\/feishu/);
  assert.match(appSource, /\/api\/apps\/google\/connection/);
  assert.match(appSource, /\/api\/apps\/qichacha\/connection/);
  assert.match(appSource, /只记录来源能够核验的事实/);
  assert.match(appSource, /更新公司资料/);
});

test("investment data sources have workspace-level management", () => {
  assert.match(appSource, /数据源管理/);
  assert.match(appSource, /<h1>投资数据源<\/h1>/);
  assert.match(appSource, /统一投资数据/);
  assert.match(appSource, /连接到投资管理/);
  assert.match(appSource, /账号授权仍保留/);
  assert.match(appSource, /agent-os-investment-linked-sources:/);
  assert.match(appSource, /只有接入后的来源才会参与公司资料更新/);
  assert.match(appSource, /activeSources\.map/);
  assert.match(cssSource, /\.investment-source-manager-grid/);
});

test("investment uses the same visual language as recruiting and sales CRM", () => {
  for (const token of ["#f5f7f8", "#258f69", "#e3f2eb", "rgba(235, 240, 242, 0.88)"]) {
    assert.match(cssSource, new RegExp(token.replace(/[().]/g, "\\$&")));
  }
  assert.match(recruitingCssSource, /#f5f7f8/);
  assert.match(recruitingCssSource, /#258f69/);
  assert.match(workspaceAppsCssSource, /\.os-workspace\.investment-workspace\s*\{\s*--wa-accent: #258566;\s*--wa-selection: #e2eee9;/);
  assert.match(desktopCssSource, /\.dock-investment\{color:white;background:linear-gradient\(145deg,#42ad83,#208866\)/);
  assert.match(cssSource, /\.investment-portfolio-overview \{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
});

test("the investment app stays focused on company management and company detail", () => {
  assert.match(appSource, /公司管理/);
  assert.match(appSource, /更新于/);
  assert.match(appSource, /资料状态/);
  assert.match(appSource, /公司调研/);
  assert.match(appSource, /调研数据来源/);
  assert.doesNotMatch(appSource, /主动洞察/);
  assert.doesNotMatch(appSource, /Agent 推断/);
  assert.doesNotMatch(appSource, /Agent 情景分析/);
  assert.doesNotMatch(appSource, /联网研究/);
  assert.doesNotMatch(appSource, /投决室/);
  assert.doesNotMatch(appSource, /生成投委会报告/);
  assert.match(appSource, /任何外部发送或系统写入先生成草稿等待确认/);
});

test("investment interactions are accessible and motion-aware", () => {
  assert.match(appSource, /aria-label="投资工作台导航"/);
  assert.match(appSource, /aria-label="投资公司列表"/);
  assert.match(appSource, /aria-label="公司详情导航"/);
  assert.match(cssSource, /@media \(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(cssSource, /transition:\s*all/);
  assert.match(cssSource, /@media \(hover:hover\) and \(pointer:fine\)/);
});
