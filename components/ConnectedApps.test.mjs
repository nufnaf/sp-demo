import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const desktopSource = await readFile(new URL("./AgentDesktop.tsx", import.meta.url), "utf8");
const cssSource = await readFile(new URL("./AgentDesktop.css", import.meta.url), "utf8");

test("launchpad apps use recognizable brand marks instead of letter placeholders", () => {
  assert.match(desktopSource, /function BrandAppIcon/);
  for (const appearance of ["figma", "google", "github", "slack", "notion", "linear"]) {
    assert.match(desktopSource, new RegExp(`app\\.appearance === "${appearance}"|${appearance}: <path`));
  }
  for (const color of ["#f24e1e", "#ff7262", "#a259ff", "#1abcfe", "#0acf83", "#4285f4", "#34a853", "#fbbc05", "#ea4335"]) {
    assert.match(desktopSource, new RegExp(color));
  }
  assert.match(desktopSource, /<BrandAppIcon app=\{app\}\/></);
  assert.match(cssSource, /\.agent-os-launchpad-icon svg\{width:43px/);
});

test("each bundled data app has its own GUI navigation model", () => {
  assert.match(desktopSource, /function ConnectedAppView/);
  assert.match(desktopSource, /github: \{ sections: \["概览", "仓库", "Pull Requests", "Issues"\]/);
  assert.match(desktopSource, /figma: \{ sections: \["最近文件", "项目", "组件", "评论"\]/);
  assert.match(desktopSource, /slack: \{ sections: \["收件箱", "频道", "私信", "搜索"\]/);
  assert.match(desktopSource, /notion: \{ sections: \["最近页面", "团队空间", "数据库", "搜索"\]/);
  assert.match(desktopSource, /linear: \{ sections: \["我的事项", "Issues", "项目", "周期"\]/);
  assert.match(desktopSource, /google: \{ sections: \["云端硬盘", "文档", "表格", "幻灯片"\]/);
});

test("opening an app creates a real desktop window backed by plugin metadata", () => {
  assert.match(desktopSource, /const \[openApps, setOpenApps\] = useState<LaunchpadApp\[\]>\(\[\]\)/);
  assert.match(desktopSource, /setFrontWindow\(`app:\$\{app\.id\}`\)/);
  assert.match(desktopSource, /openApps\.map\(\(app, index\) =>/);
  assert.match(desktopSource, /kind="app" cascadeIndex=\{index\}/);
  assert.match(desktopSource, /kind="app"/);
  assert.match(desktopSource, /<ConnectedAppView app=\{app\}/);
  assert.match(desktopSource, /app\.plugin\.resources\.filter/);
  assert.match(desktopSource, /Object\.values\(app\.plugin\.counts\)/);
  assert.doesNotMatch(desktopSource, /mockData|fakeData|sampleData/);
});

test("connected app windows provide authorization, live data states, responsive layout, and reduced transparency", () => {
  assert.match(desktopSource, /连接状态/);
  assert.match(desktopSource, /等待授权/);
  assert.match(desktopSource, /管理数据连接/);
  assert.match(desktopSource, /function ConnectionPanel/);
  assert.match(desktopSource, /\/api\/apps\/\$\{appId\}\/connection/);
  assert.match(desktopSource, /\/api\/apps\/\$\{appId\}\/data/);
  assert.match(desktopSource, /真实数据/);
  assert.match(cssSource, /\.agent-os-connected-app\{[^}]*grid-template-columns:210px/);
  assert.match(cssSource, /\.agent-os-connected-data\{[^}]*grid-template-columns:minmax\(0,1fr\) 230px/);
  assert.match(cssSource, /@media \(max-width: 760px\)[\s\S]*?\.agent-os-connected-app\{grid-template-columns:68px/);
});
