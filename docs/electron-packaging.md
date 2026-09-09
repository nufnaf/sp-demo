# Syntropic 双击启动版

当前安装的是 OpenRouter 预置 Key 版本 `ce612a01-2c6b-47ef-bf52-61a6f7cdcc2b`，已完成真实 JD、网页发布与查询验证，无需 ChatGPT 登录。本轮输入框常驻、隐藏聊天入口与洞察同步的实测见 [桌面交互验收](desktop-interaction-validation.md)；模型配置见 [预置 Key 演示包](openrouter-demo.md)。下文保留 OAuth 版本的使用方式与历史验收，授权说明仅适用于 OAuth 构建。

当前体积优化验收包：`a288d94b-3dc9-4e6d-aa96-7f7dd1bea1d8`（2026-09-09）。安装后目录约 871 MB，用户运行目录仅 4 KiB；代码与资源直接引用 App，内置浏览器使用 Chromium Headless Shell。JD 生成、浏览器发布和查询、刷新及退出重启已实测，详见 [体积与验证记录](desktop-size-validation.md)。

精简前性能基线 `abeb00a2-0e7a-4a2c-a6d7-5ff59ca5053b`（2026-09-09）。主 Agent、后台任务和浏览器继续使用 Luna low。JD 发布改为文件引用交接：主 Agent 只传短目标与文件路径，工具读取全文供浏览器实际填写、提交和核对。两轮主 Agent 准备为 6.7 / 6.8 秒，浏览器执行为 39.5 / 35.1 秒，点击到浏览器完成为 46.2 / 41.9 秒；没有宣称整段达到 33 秒。两轮新 HTML JD 全文、原窗口返回、刷新和退出恢复通过，第二轮另验证真实查询、洞察及本地会议；原 Pi 54 个受检路径未变。额外页面关闭回归仍有错误类型不匹配，详见 [实测与验证边界](agent-latency-investigation.md)。

## 使用

在 macOS Apple Silicon 上双击 `Syntropic.app`。App 会准备内置运行文件，同时启动工作台（127.0.0.1:30141）和招聘系统（127.0.0.1:30143），两者通过健康检查后进入工作台。不需要 Node、npm、终端或预装 Chrome。

首次启动只保存一份约 3.4 KB 的包清单，运行代码、依赖、静态资源及招聘服务全部通过符号链接引用 App 内文件；后续启动刷新链接，支持 App 移动位置。桌面版 ISR 与图片处理使用内存缓存，用户目录保留独立可写缓存目录。执行 Agent 任务仍需要联网和 Pi 中已有的有效模型授权；应用不附带模型账号凭据（专用飞书只读应用配置由管理员注入），App 内主 Agent 与生成任务默认使用 `openai-codex/gpt-5.6-luna`（low），普通 Web 与原 Pi 默认设置不变；浏览器模型仍固定为 `openai-codex / gpt-5.6-luna`。同机已有 Pi 配置继续使用，首次在另一台机器使用需从设置完成授权。

按 [完整招聘演示](presentation-demo.md) 先生成并发布本轮 JD，再开始招聘查询：

> 帮我看看 AI Agent 工程师岗位，面试结束了多少人，还有几人的评价没齐？

网页自动打开并操作，任务状态保留在“当前任务”，通过招聘窗口核对人数；演示不提供聊天面板入口。输入框保持在工作台窗口、启动台、工作台菜单和通知之上；Dock 及其菜单层级更高，放大的应用图标不会被输入框挡住。当前界面行为见 [桌面交互验收](desktop-interaction-validation.md)。初始数据结果是面试结束 12 人、评价未齐 3 人。浏览器执行期间只显示简短状态和停止按钮；完成后隐藏状态栏，保留可核对的业务网页，不在网页上方显示模型、步数、耗时或内部核查报告。

`⌘Q` 退出并清理 App 启动的服务与浏览器后代进程。macOS 红色关闭按钮只关闭窗口，后台继续运行；从 Dock 可恢复窗口。故障页提供重试，重试会停止本 App 管理的服务后重新检查两个服务。本轮网页保存有效；完全退出清理本轮演示目录，下次启动重新准备预设。

演示通知只显示在 App 右上角；不会申请 macOS 通知权限，也不会发送系统任务完成通知。普通 Web 的通知设置不变。

固定端口上已有其他程序、开发版或其他版本时，App 明确报错，不抢占端口、杀掉原服务或改动原数据。先正常退出原 App；若是手动启动的开发服务，在其终端停止后重试。Electron 演示不复用已有服务，防止混入普通 Web 的持久化数据。

## 数据与安装包边界

- 专用演示数据：`~/Library/Application Support/Syntropic/presentation-runs/<uuid>`；包含工作目录、会话、应用状态、浏览器资料与招聘记录。每次启动新目录，完全退出先停服务后清理。开发版使用 `Syntropic Dev`。
- 内置运行副本与缓存：`~/Library/Application Support/Syntropic/runtimes/<buildId>`。仅复制 `package.json`，`server.js`、`.next` 下的构建文件、`node_modules`、`public`、`apps` 都链接到当前 App；`.next/cache` 是用户目录中的独立目录。新版本的两个服务通过健康检查后删除旧运行副本，只保留当前版本；不清理业务记录或 Pi 配置。
- Electron 页面状态使用每轮独立内存分区，刷新/关窗口保留，退出丢弃。
- 原 Pi 配置、模型授权和历史仍在 `~/.pi/agent`，不打包、不迁移、不清理。仅本轮新建演示会话进入专用目录。
- 专用飞书凭据来自本机忽略文件，构建注入 `Resources/feishu-demo.json`，不属于退出清理范围。详见 [管理员配置](feishu-demo-setup.md)。
- 普通 Web / 独立招聘网站维持原持久化行为；`apps/recruiting/.data` 不随包分发。异常退出恢复策略见 [完整招聘演示](presentation-demo.md)。

历史产物：`~/Applications/Syntropic.app`；构建 ID `1db95321-e222-44be-a886-8ae068db4024`，构建于 `2026-09-08T15:17:27.288Z`。补齐四个工作台、五个桌面组件与真实任务／成果记录；修正组件拖动后的刷新保存。本机签名复核通过。两轮完整流程与退出审计通过，刷新、关闭窗口恢复、组件拖动保存与停止后接管已验证。第二轮锁屏暂停后由用户解锁继续完成，没有重生成 JD 或重复发布。完整证据与边界见 [工作台补齐记录](workspace-presentation-completion.md)。

上一产物：`~/Applications/Syntropic.app`；构建 ID `665b535b-224a-4f93-819d-625d105dee07`，构建于 `2026-09-08T13:17:46.288Z`。飞书界面与文案更新后，完成一轮真实 JD、网页发布／查询、通知竞争、洞察会议、停止／接管、刷新与退出恢复验证；另一次空白开场和签名复核通过。详情见 [当前界面验收](feishu-workspace-polish.md)。上一构建 `1e30a611-bf3d-4b3d-b2a3-bf38c6df2427` 的 [五轮验收](presentation-notification-retest-2026-09-08.md) 为独立历史记录。验收后只同步文档，没有重新构建受检 App。

当前交付是本机 ad-hoc 签名的 macOS arm64 `.app`，不是 Apple Developer ID 签名／公证发行版。适合本机双击演示；通过网络分发给其他 Mac 时可能触发 Gatekeeper，公开分发需另做签名与公证。尚未提供 Windows、Intel Mac、自动更新或对外托管。

当前完整流程的验证、实际耗时与限制见 [完整招聘演示](./presentation-demo.md)。[早期安装包验收记录](./electron-packaging-validation.md) 和 [早期浏览器延迟记录](./browser-latency-validation.md) 保留为历史资料，不代表当前完整流程验收。精简前产物约 2.06 GB。桌面打包现使用 Next.js standalone 产物，显式补齐 Pi 动态资源、Playwright 与当前平台执行器，移除调试映射及其他平台的原生文件；Node 保留 npm/npx，去除开发头文件和 Corepack。最新体积与验证见 [安装包体积优化](desktop-size-validation.md)。

## 本轮线上招聘测试包（2026-09-10）

产物：`build/desktop/release/Syntropic.app`，构建 ID `4476594e-9707-42a7-8afb-8b63b797f2e9`，磁盘占用约 882 MiB。生产构建、类型检查、6 项打包相关测试及严格签名检查通过；使用包内 Node 在独立目录启动服务，首页和本轮状态接口均返回 200，招聘地址为 Vercel，本轮岗位及进展为空。未替换或启动已安装的 App。

使用 `SYNTROPIC_RECRUITING_URL=https://syntropic-recruiting.vercel.app npm run package:desktop` 构建时，地址会写入包内 `desktop-runtime.json`，双击启动也会使用该地址；未指定时保留本地站默认值。运行时显式环境变量仍可覆盖包内地址。线上模式只启动本机工作台，不启动 30143 招聘服务。

本轮桌面招聘结果采用本地快照和事件更新。新启动的桌面记录为空；线上招聘数据库仍持久化；修复版通过每轮独立地址隔离数据，新一轮不会再读到上一轮的岗位统计。本次输出用于用户替换安装并自行验证，不代表已完成新版安装后的完整演示验收。

## 上一版洞察与跨轮发布修复包（2026-09-10）

产物：`build/desktop/release-insight-fix/Syntropic.app`，构建 ID `972f1239-255f-4158-8003-b4e2a7222f17`。通过 `SYNTROPIC_DESKTOP_RELEASE_DIR` 指定独立输出目录，保留正在运行的上一测试包。

- 核心目标的发布统计放入原有副标题区域，不再在截止日期后追加一行。
- 发布结果核验并写入本轮快照时生成面试标准洞察，不依赖招聘窗口打开或停留七秒。
- 发布建议完成后保留在 AI 洞察卡片，标记“已完成”；任务核验失败显示实际失败，不再次弹出“新创建 JD”的通知。
- 每轮 App 启动使用独立 `/demo/<scope>/` 招聘地址，存储分别对应独立记录；旧的未分轮数据保留。任务卡以最终任务结果为准，网页操作完成不等于最终核验完成。

验证：41 项相关回归测试、类型检查及改动文件 lint 通过；生产包独立服务启动后首页返回 200，新轮岗位和进展为空，地址包含本轮标识。生产站两个独立轮次均通过真实浏览器表单发布，每轮岗位与统计匹配、互不串入，原测试数据保留。开发页面在招聘窗口未打开时自动显示标准不一致洞察，完成的发布建议刷新后仍保留且不再提醒；1440×960 与 1280×800 下目标统计和截止日期均完整可见。未在新 Electron 包内重跑模型生成 JD 的完整演示流程。

## 当前测试包：恢复招聘页面等待触发（2026-09-10）

产物：`build/desktop/release-recruiting-wait/Syntropic.app`，构建 ID `9ee6d236-88fa-469c-b815-952dfb8dec9e`，生产包独立启动检查通过：首页 200，新轮招聘与进展为空。按用户确认恢复原来的演示时机：进入“人才招聘 → 招聘进展”，有本轮已发布岗位时等待约 7 秒，随后触发面试标准洞察；离开页面取消尚未执行的计时。发布／查询只保存本轮快照，不立即生成洞察。重复进入页面沿用同一份洞察，不重复创建。

保留上一版的目标文字裁切、发布建议完成后保留、每轮云端数据隔离和任务最终状态修复。事件更新继续读取本地快照，不恢复周期性招聘网站请求。相关 13 项回归、类型检查和改动文件 lint 通过；组件执行检查覆盖空岗位、打开后的初始读取、7 秒触发及离开取消。

## 重建安装包

OAuth 历史版本的构建方式（OpenRouter 版本使用上面的新说明）：

```bash
cd /Users/xiewannan/code/sp-demo-worktrees/electron-phase-one
SYNTROPIC_DEMO_AUTH=chatgpt npm run package:desktop
```

输出：`build/desktop/release/Syntropic.app`，旁边有使用说明。每次重建替换此生成产物；不要在 App 运行中覆盖其包文件，应先退出。不需要新建或切换 worktree。

构建脚本下载并校验固定 SHA-256 的官方 Node 24.20.0 arm64，使用锁定的 Playwright 版本下载对应 Chromium Headless Shell（`--only-shell`），使用已安装的 Electron 44.2.0。第一次构建需要网络，下载缓存位于 `build/desktop/cache`。开发 Node/npm 仅构建时使用，最终 App 附带独立运行时。

脚本白名单复制源码到 `build/desktop/source`，在暂存目录执行 Next 生产构建，再将 standalone 生产产物、必要依赖、招聘应用、Node 和浏览器组装成 App。不会在正在开发的根目录执行 `next build`，不会修改根目录 `.next`，不打包其他 `.env`、招聘保存文件或 Pi 用户凭据；仅显式注入专用飞书演示配置。`build` 已忽略并从 TypeScript 开发检查排除。`SYNTROPIC_DESKTOP_BUILD=1` 只在桌面暂存构建时启用 standalone 并关闭 ISR/图片磁盘缓存，不改变普通 Web 开发构建。打包保留许可证和运行资源，npm/npx 继续支持技能与插件安装。

## 实现

- `electron/main.mjs`：识别开发／打包模式，准备用户目录内的运行文件链接与可写缓存目录，使用随包 Node 启动 supervisor；新版本就绪后清理旧副本。
- `electron/supervisor.mjs` + `service-group.mjs`：管理两个服务，全部就绪才发出 ready；失败或退出时清理已拥有的服务。
- `electron/service.mjs`：开发时 Next dev，打包时通过 `--preserve-symlinks-main` 启动 standalone server.js，使运行目录保持在用户数据目录；招聘独立 Node 服务；身份检查、页面检查、数据检查与原有进程归属清理。
- `apps/recruiting/local.mjs`：仅本地启动器提供 `/api/desktop/health`，检查存储可读并返回应用身份，不暴露业务记录；独立 Vercel handler 不受影响。
- `scripts/package-desktop.mjs`：独立暂存构建、可复现运行时下载、仅复制当前浏览器版本、资源打包、签名与签名验证。
- `scripts/desktop-package-files.mjs`：依据包的 `os`/`cpu` 声明递归清理不适用的原生依赖，包含 SDK 的嵌套依赖；不遍历符号链接。

参考：[Electron 手工打包](https://www.electronjs.org/docs/latest/tutorial/application-distribution)、[Node 官方校验清单](https://nodejs.org/dist/v24.20.0/SHASUMS256.txt)。

浏览器完成后自动返回的行为与验证见 [返回发起对话验收](./browser-return-validation.md)。
