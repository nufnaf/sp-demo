# 第一阶段桌面验证记录

日期：2026-09-07。实现分支：`codex/electron-phase-one`；基点：`7992aeb`。

实现 worktree：`/Users/xiewannan/code/sp-demo-worktrees/electron-phase-one`。
主 checkout `/Users/xiewannan/code/sp-demo` 的未提交 `docs/specs/` 保留原样，未将其中旧的后续阶段计划复制为本阶段实施范围。没有提交、推送、发布或生产构建。

## 已验证

| 验收项 | 实测结果 |
| --- | --- |
| 单命令启动 | `npm run desktop` 从空闲 30141 端口启动本机 Next / Pi，再打开 Electron 中原有 Syntropic 桌面。 |
| 服务等待 | 首次 Next 编译期间显示本地“正在启动本机后台”状态页；只有 checkout 标识、首页和 Pi running API 全部可用后进入工作台。 |
| 服务冲突 | 使用另一 checkout 标识的本机服务占用 30141，App 显示“30141 已被其他项目或 worktree 占用”，没有终止该服务。 |
| 错误页恢复 | 停止测试冲突服务后，点击“重试连接”成功启动本 worktree 后台并返回工作台。 |
| 重复启动 | 第二次 `npm run desktop` 立即正常退出并前置原窗口；Electron、supervisor、Next CLI 和监听进程 PID 不变。 |
| macOS 关闭 / 激活 | 关闭主窗口后再次激活恢复窗口，原后台保持运行；已打开的工具进程由后台继续持有。 |
| 正常退出 | `⌘Q` 后已记录的 Electron、supervisor、Next CLI、Next server、独立 Chrome 主进程及其 helpers 全部退出，30141 无监听。 |
| 异常退出 | 对本次 Electron 主进程执行 SIGKILL；supervisor 及其 10 个已记录后代全部退出，30141 释放。 |
| 复用外部服务 | 先运行原始 `npm run dev`，再打开 Electron，启动器报告“复用外部服务”。退出 Electron 后，该 Next server 保持同一 PID，首页 HTTP 200。最后仅清理本次人为启动的测试服务。 |
| 模型设置与登录 | 在 Electron 中打开 Models、新增 ChatGPT Plus/Pro、选择 Browser login；系统浏览器接管网页登录，Pi Provider 显示 Connected。切换 Chrome profile 后重新触发也成功，无需 ChatGPT/Codex 扩展。 |
| 授权持久化 | 退出并重启后台后，Pi 仍报告 ChatGPT 已连接。未导入 Codex CLI 凭据。 |
| 真实 Pi 对话 | `openai-codex / gpt-5.4-mini` 返回 `DESKTOP_PI_OK`，assistant stopReason 为 `stop`。 |
| 真实浏览器工具 | 模型发出真实 `browser_open` 调用，结果 `isError: false`，URL 为 `https://example.com/`，title 为 `Example Domain`；桌面浏览器窗口随事件前置。 |
| Electron 界面端到端 | 重启后从桌面打开验证会话，在消息框直接发送工具请求；Pi 再次成功调用 browser_open，App 内浏览器前置并展示真实网页，最终回复 `ELECTRON_UI_OK`。 |
| 浏览器点击 / 输入 / 滚动 | 从地址栏导航到临时本机 HTML 页面，通过 App 内截图点击输入框、输入 `DESKTOP_BROWSER_OK`、点击按钮和滚动。独立网页服务确认 `text=DESKTOP_BROWSER_OK`、`clicks=1`、`scrollY=1206`；App 截图显示 `SCROLL_OK`。测试服务已停止。 |
| 独立浏览器资料 | 实际 Chrome 进程使用 Pi 的 `browser/profiles/` 目录；未使用用户日常 Chrome profile。 |
| 原生终端 | App 内终端成功执行 `printf 'DESKTOP_PTY_OK\n'`；另有系统 Node 原生 PTY 测试通过。 |
| 数据兼容 | 初始 Pi auth/models/settings 文件不存在，但已有 3 个历史会话；未修改旧会话。登录写入的是 Pi 原有 auth 存储。新增的验证工作台和测试会话予以保留。 |

## 自动检查

- `npm run test:desktop`：9 项通过，包括真实进程与 PTY；覆盖未知/错误端口、Pi API 不可用、启动退出码、开发锁、启动取消和独立后代清理。
- `node_modules/.bin/tsc --noEmit`：通过。
- `node_modules/.bin/eslint electron app/api/desktop/health/route.ts`：通过。
- 浏览器、模型设置、Provider 凭据、请求安全与终端的相关既有测试：47 项通过。
- `git diff --check`：通过。
- `npm run lint`：未全绿；原有 `.agents/skills/lark-apps/creative-design/starter-components/` 有 4 个错误、32 个警告（含组件在 render 内定义和未定义 React）。未修改第三方技能模板以消除此基线问题。
- 锁文件核对：现有依赖版本变化为 0；仅增加 Electron 及所需依赖条目。

## 运行环境与保留数据

- macOS arm64，系统 Node 26.4.0、npm 11.17.0；Electron 44.2.0 使用自己的 Node 24.20.0 / Chromium 152，但 Next / Pi / node-pty 实际运行在系统 Node。
- Next.js 16.3.1；Pi 0.84.3；本机已安装 Google Chrome。
- 验证工作台：`新工作台 1`，cwd 为 `/Users/xiewannan/pi-cwd-20260907-105439`。
- 真实测试会话：`01a07b82-82f1-7d87-9b65-eedc6090da50`。可在桌面任务列表打开，核对 `DESKTOP_PI_OK` 与 Browser tool 结果。
- 交付时保留一个正常运行的桌面实例及其拥有的后台，便于继续验证；临时冲突服务、网页开发复用测试服务、交互网页测试服务均已清理。

## 范围与尚未覆盖

第一阶段的本机开发桌面验收已完成。没有正式 `.app`/DMG 安装包，没有验证干净机器分发、Windows、Linux、签名、公证或自动更新。浏览器缺失时沿用现有后端明确错误；本机已有 Chrome，因此没有卸载浏览器来模拟缺失。

本阶段没有新增 agent-browser、专用浏览器 Agent、独立模型配置或任务级 profile 隔离，没有修改招聘业务或部署线上站点。后续接入位置和启动细节见 [桌面开发说明](electron-development.md)。
