# 点击空白处显示桌面

在 Syntropic 内点击桌面空白处（包含桌面组件之间的空白），隐藏所有打开的应用、任务、文档和成果窗口，并收起对话浮层及临时菜单。顶部栏、桌面组件和 Dock 保留。

- 全部窗口隐藏后，再次点击空白处恢复窗口，保留原来的前后顺序。
- 通过 Dock、桌面组件或文件入口恢复某个窗口时，其他窗口保持隐藏。此时再次点击空白处先隐藏所有窗口，再点一次恢复全部。
- 隐藏保留窗口挂载、位置、大小、最大化状态、滚动位置和未保存内容，不关闭应用、不停止后台任务。
- 操作窗口、输入框和桌面组件，以及右键、拖动或滚动手势，都不会触发显示桌面。
- 切换工作台后清除旧工作台的隐藏状态。隐藏状态不跨页面刷新保存。

## 实现

`AgentDesktop` 统一记录隐藏窗口 ID；现有打开入口恢复目标窗口。`DesktopWindow` 使用可见性样式保留布局和内部组件，隐藏时设为 `inert` 并从无障碍树移除，避免键盘焦点进入不可见内容。恢复不重新创建编辑器或 iframe。

桌面手势仅接受主指针的左键点击；必须在同一块空白区域按下和抬起，移动不能超过 5 像素，滚动位置不能变化。组件滚动容器的空白也属于桌面，但卡片与内部控件不属于。

## 验证

使用独立数据目录与浏览器 API fixtures 验证真实组件，不调用模型或修改用户文件。需要已安装 Google Chrome，并在新的 worktree 安装依赖。

先检查测试端口可用，再在该 worktree 启动独立服务；不要同时运行两个服务争用同一 worktree 的 `.next`：

```sh
lsof -nP -iTCP:30161 -sTCP:LISTEN
check_root=$(mktemp -d /tmp/syntropic-desktop-check.XXXXXX)
mkdir -p "$check_root/pi" "$check_root/workspace"
PI_CODING_AGENT_DIR="$check_root/pi" SYNTROPIC_PRESENTATION_ROOT="$check_root" \
  node_modules/.bin/next dev -H 127.0.0.1 -p 30161
```

在第二个终端执行：

```sh
SYNTROPIC_TEST_URL=http://127.0.0.1:30161 node --test scripts/desktop-show-desktop.test.mjs
```

本轮通过：多窗口隐藏和恢复、Dock 单独恢复、关闭后不带出其他隐藏窗口、组件入口恢复、拖动和右键防误触、窗口位置/尺寸/最大化状态、搜索内容、未发送输入、CodeMirror 未保存内容和滚动位置、隐藏时键盘焦点隔离与组件节点保留。测试记录确认没有文件写入或停止任务请求；未运行真实模型任务。

类型检查、本次修改文件的 ESLint 与 16 项相关现有测试通过。全仓库 `npm run lint` 仍存在技能目录 `.agents/skills/lark-apps/creative-design/starter-components` 内的 4 个既有错误，不在此次改动范围。

## 本机试用安装

2026-09-10 已按用户要求打包并替换 `/Users/xiewannan/Applications/Syntropic.app`，构建 ID `5258c433-bbbe-4007-b9b5-c5acd3a5e40c`。沿用旧版 OpenRouter 与飞书私有配置，配置值未进入源码或日志。

生产构建、16 项桌面启动测试及安装后的签名复核通过。新版工作台与招聘服务健康检查通过，运行目录确认对应新构建。在实际 Electron App 中打开产物库和飞书，点击空白处两窗口同时隐藏，再次点击两窗口恢复，飞书文档列表正常加载。已保持新版 App 打开供用户试用；本次没有执行模型任务。

旧版保留于 `/Users/xiewannan/Applications/.Syntropic-backups/bfe92efe-a7c8-4187-a185-687ad88761a8/Syntropic.app`。源码在 `codex/desktop-show-desktop` worktree 开发；安装验证不代表远端仓库已更新。
