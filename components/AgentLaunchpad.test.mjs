import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const desktopSource = await readFile(new URL("./AgentDesktop.tsx", import.meta.url), "utf8");
const cssSource = await readFile(new URL("./AgentDesktop.css", import.meta.url), "utf8");
const pluginRouteSource = await readFile(new URL("../app/api/plugins/route.ts", import.meta.url), "utf8");

test("the Dock opens a searchable launchpad backed by built-in apps and the Pi plugins API", () => {
  assert.match(desktopSource, /function Launchpad/);
  assert.match(desktopSource, /fetch\(url, \{ cache: "no-store"/);
  assert.match(desktopSource, /getLaunchpadApps\(data\.packages, \[\.\.\.\(connectorData\.builtins/);
  assert.match(desktopSource, /\/api\/app-store\/installations/);
  assert.match(desktopSource, /placeholder="搜索应用"/);
  assert.match(desktopSource, /className=\{`dock-launchpad\$\{launchpadOpen/);
  assert.match(desktopSource, /aria-pressed=\{launchpadOpen\}/);
  assert.match(desktopSource, /setLaunchpadOpen\(\(value\) => !value\)/);
});

test("Feishu opens as a built-in CLI app instead of a Pi plugin", () => {
  assert.match(desktopSource, /function FeishuAppView/);
  assert.match(desktopSource, /fetch\("\/api\/apps\/feishu"/);
  assert.match(desktopSource, /app\.kind === "builtin" \? \(\s*<FeishuAppView/);
  assert.match(desktopSource, /className="agent-os-native-onboarding"/);
  assert.match(desktopSource, /href="\/icons\/feishu-logo\.svg"/);
  assert.match(desktopSource, /使用飞书官方授权，凭据保存在本机/);
  assert.match(desktopSource, /let cachedFeishuStatus: FeishuCliStatus \| null = null/);
  assert.match(desktopSource, /useState<FeishuCliStatus \| null>\(\(\) => cachedFeishuStatus\)/);
  assert.match(desktopSource, /if \(!status\) return <div className="agent-os-feishu-opening"/);
  assert.match(desktopSource, /正在打开飞书云文档…/);
  assert.match(cssSource, /\.agent-os-feishu-opening\{[^}]*height:100%/);
  assert.match(desktopSource, /qrCodeDataUrl/);
  assert.match(desktopSource, /className="agent-os-feishu-sidebar-search"/);
  assert.match(desktopSource, /placeholder="搜索文档"/);
  assert.match(desktopSource, /\/api\/apps\/feishu\/documents/);
  assert.match(desktopSource, /全部文档/);
  assert.doesNotMatch(desktopSource, /agent-os-feishu-library-toolbar/);
  assert.match(desktopSource, /if \(!documentWorkspace\) return/);
  assert.match(desktopSource, /onOpenDocument\(document\)/);
  assert.match(desktopSource, /function FeishuDocumentEditor/);
  assert.match(desktopSource, /<iframe src=\{document\.url\}/);
  assert.doesNotMatch(desktopSource, /飞书原生编辑器<\/strong>/);
  assert.match(desktopSource, /kind="document"/);
  assert.match(cssSource, /\.agent-os-feishu-library-body\{[^}]*grid-template-columns:164px minmax\(0,1fr\)/);
  assert.doesNotMatch(desktopSource, /aria-label="刷新文档"/);
});

test("opened apps join the Dock temporarily and can be kept from their context menu", () => {
  assert.match(desktopSource, /const \[dockApps, setDockApps\] = useState<DockItem\[\]>/);
  assert.match(desktopSource, /PINNED_DOCK_APPS_KEY/);
  assert.match(desktopSource, /const rememberDockItem = useCallback/);
  assert.match(desktopSource, /if \(!pinnedDockAppIds\.has\(app\.id\)\) setDockApps/);
  assert.match(desktopSource, /pinnedDockItems\.map\(renderDockItem\)/);
  assert.match(desktopSource, /temporaryDockItems\.map\(renderDockItem\)/);
  assert.match(desktopSource, /onContextMenu=\{\(event\) =>/);
  assert.match(desktopSource, /role="menuitemcheckbox"/);
  assert.match(desktopSource, /在程序坞中保留/);
  assert.match(desktopSource, /从程序坞中移除/);
  assert.match(cssSource, /\.agent-os-dock-context-menu\{[^}]*transform-origin:center bottom/);
  assert.match(desktopSource, /const SYSTEM_DOCK_APPS: SystemDockApp\[\]/);
  assert.match(desktopSource, /const allApps: DockItem\[\] = \[\.\.\.SYSTEM_DOCK_APPS, \.\.\.apps\]/);
  assert.doesNotMatch(desktopSource, /id: "system:new-task"/);
  assert.doesNotMatch(desktopSource, /id: "system:history"/);
  assert.match(desktopSource, /id: "system:tasks"[^\n]*icon: "tasks"/);
  assert.match(desktopSource, /id: "system:library"[^\n]*icon: "files"/);
  assert.match(desktopSource, /files: <>[\s\S]*?M6 7H5[\s\S]*?M16 3v5h4M10 12h6M10 16h6/);
  assert.match(desktopSource, /tasks: <>[\s\S]*?m6\.5 8 1\.2 1\.2L10 7/);
  assert.match(desktopSource, /<Icon name=\{item\.icon\} size=\{launchpad \? 46 : 22\}\/>/);
  assert.doesNotMatch(cssSource, /\.agent-os-launchpad-icon\.is-system\.is-(?:tasks|library)\{/);
  assert.doesNotMatch(cssSource, /\.agent-os-dock > \.dock-(?:tasks|library)\{/);
  assert.match(desktopSource, /SYSTEM_DOCK_APPS\.find\(\(systemApp\) => systemApp\.id === storedId\)/);
  assert.match(desktopSource, /=== "system:code" \? "system:files"/);
  assert.match(desktopSource, /return currentSystemApp \? \[currentSystemApp\] : \[\]/);
  assert.match(cssSource, /\.agent-os-dock > \.dock-app\.is-feishu \.agent-os-app-logo\{[^}]*width:100%;height:100%/);
  assert.match(desktopSource, /dock-app is-\$\{item\.appearance\}\$\{item\.kind === "connector" \? " is-official-icon"/);
});

test("global apps can load before a workspace exists without weakening cwd checks", () => {
  assert.match(pluginRouteSource, /const requestedCwd = searchParams\.get\("cwd"\)/);
  assert.match(pluginRouteSource, /const cwd = requestedCwd \?\? getAgentDir\(\)/);
  assert.match(pluginRouteSource, /if \(requestedCwd\) \{[\s\S]*?isExistingFilePathAllowed/);
});

test("the launchpad keeps the menu bar and Dock visible and honors accessibility settings", () => {
  assert.match(cssSource, /\.agent-os-launchpad \{[^}]*z-index:155[^}]*inset:44px 0 0/);
  assert.match(cssSource, /\.agent-os-dock \{[^}]*z-index: 160/);
  assert.match(desktopSource, /role="dialog" aria-label="启动台"/);
  assert.match(desktopSource, /<div role="listitem" key=\{app\.id\}>[\s\S]*?<button className="agent-os-launchpad-app"/);
  assert.doesNotMatch(desktopSource, /agent-os-launchpad-app[\s\S]{0,500}<small>/);
  assert.match(cssSource, /\.agent-os-launchpad-grid \{[^}]*display:flex[^}]*justify-content:flex-start/);
  assert.match(cssSource, /\.agent-os-launchpad-grid > \[role="listitem"\]\{width:112px/);
  assert.match(desktopSource, /event\.key === "Escape"/);
  assert.match(cssSource, /prefers-reduced-motion: reduce/);
  assert.match(cssSource, /prefers-reduced-transparency: reduce[\s\S]*?agent-os-launchpad/);
});
