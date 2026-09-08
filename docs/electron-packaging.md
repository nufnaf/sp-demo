# Syntropic 双击启动版

## 使用

在 macOS Apple Silicon 上双击 `Syntropic.app`。App 会准备内置运行文件，同时启动工作台（127.0.0.1:30141）和招聘系统（127.0.0.1:30143），两者通过健康检查后进入工作台。不需要 Node、npm、终端或预装 Chrome。

首次准备运行文件会比后续启动慢。执行 Agent 任务仍需要联网和 Pi 中已有的有效模型授权；应用不附带模型账号凭据（专用飞书只读应用配置由管理员注入），不改变主模型，浏览器模型仍固定为 `openai-codex / gpt-5.6-luna`。同机已有 Pi 配置继续使用，首次在另一台机器使用需从设置完成授权。

按 [完整招聘演示](presentation-demo.md) 先生成并发布本轮 JD，再开始招聘查询：

> 帮我看看 AI Agent 工程师岗位，面试结束了多少人，还有几人的评价没齐？

网页自动打开并操作，任务完成后自动展开原发起对话，显示主 Agent 的汇总。若你已经切走或手动操作浏览器，则保留当前界面，可从“对话记录”查看结果。初始数据结果是面试结束 12 人、评价未齐 3 人。浏览器执行期间只显示简短状态和停止按钮；完成后隐藏状态栏，结果统一在原发起对话中呈现，不在网页上方重复显示模型、步数、耗时或内部核查报告。

`⌘Q` 退出并清理 App 启动的服务与浏览器后代进程。macOS 红色关闭按钮只关闭窗口，后台继续运行；从 Dock 可恢复窗口。故障页提供重试，重试会停止本 App 管理的服务后重新检查两个服务。本轮网页保存有效；完全退出清理本轮演示目录，下次启动重新准备预设。

演示通知只显示在 App 右上角；不会申请 macOS 通知权限，也不会发送系统任务完成通知。普通 Web 的通知设置不变。

固定端口上已有其他程序、开发版或其他版本时，App 明确报错，不抢占端口、杀掉原服务或改动原数据。先正常退出原 App；若是手动启动的开发服务，在其终端停止后重试。Electron 演示不复用已有服务，防止混入普通 Web 的持久化数据。

## 数据与安装包边界

- 专用演示数据：`~/Library/Application Support/Syntropic/presentation-runs/<uuid>`；包含工作目录、会话、应用状态、浏览器资料与招聘记录。每次启动新目录，完全退出先停服务后清理。开发版使用 `Syntropic Dev`。
- 内置运行副本与缓存：`~/Library/Application Support/Syntropic/runtimes/<buildId>`。不保存本轮业务记录；旧运行副本暂不自动删除。
- Electron 页面状态使用每轮独立内存分区，刷新/关窗口保留，退出丢弃。
- 原 Pi 配置、模型授权和历史仍在 `~/.pi/agent`，不打包、不迁移、不清理。仅本轮新建演示会话进入专用目录。
- 专用飞书凭据来自本机忽略文件，构建注入 `Resources/feishu-demo.json`，不属于退出清理范围。详见 [管理员配置](feishu-demo-setup.md)。
- 普通 Web / 独立招聘网站维持原持久化行为；`apps/recruiting/.data` 不随包分发。异常退出恢复策略见 [完整招聘演示](presentation-demo.md)。

当前已安装产物：`~/Applications/Syntropic.app`；构建 ID `1e30a611-bf3d-4b3d-b2a3-bf38c6df2427`，构建于 `2026-09-08T11:32:55.215Z`。该通知修复版本已完成五轮完整演示，包含真实 JD、网页发布/查询、通知竞争、刷新与正常退出恢复；第一及第五轮额外验证停止、接管和页面隔离。最终空白开场检查通过，安装包签名复核通过；完整证据和首次模型连接失败的独立记录见 [当前五轮验收报告](presentation-notification-retest-2026-09-08.md)。验收后的文档同步没有重建或更换受检 App。

当前交付是本机 ad-hoc 签名的 macOS arm64 `.app`，不是 Apple Developer ID 签名／公证发行版。适合本机双击演示；通过网络分发给其他 Mac 时可能触发 Gatekeeper，公开分发需另做签名与公证。尚未提供 Windows、Intel Mac、自动更新或对外托管。

当前完整流程的验证、实际耗时与限制见 [完整招聘演示](./presentation-demo.md)。[早期安装包验收记录](./electron-packaging-validation.md) 和 [早期浏览器延迟记录](./browser-latency-validation.md) 保留为历史资料，不代表当前完整流程验收。当前产物约 2 GB，优先携带完整依赖；首次展开运行副本还会占用额外磁盘空间。

## 重建安装包

必须在原 worktree 中执行：

```bash
cd /Users/xiewannan/code/sp-demo-worktrees/electron-phase-one
npm run package:desktop
```

输出：`build/desktop/release/Syntropic.app`，旁边有使用说明。每次重建替换此生成产物；不要在 App 运行中覆盖其包文件，应先退出。不需要新建或切换 worktree。

构建脚本下载并校验固定 SHA-256 的官方 Node 24.20.0 arm64，使用锁定的 Playwright 版本下载对应 Chrome for Testing，使用已安装的 Electron 44.2.0。第一次构建需要网络，下载缓存位于 `build/desktop/cache`。开发 Node/npm 仅构建时使用，最终 App 附带独立运行时。

脚本白名单复制源码到 `build/desktop/source`，在暂存目录执行 Next 生产构建，再将生产产物、依赖、招聘应用、Node 和浏览器组装成 App。不会在正在开发的根目录执行 `next build`，不会修改根目录 `.next`，不打包其他 `.env`、招聘保存文件或 Pi 用户凭据；仅显式注入专用飞书演示配置。`build` 已忽略并从 TypeScript 开发检查排除。首次版本优先保证完整运行依赖，未做激进的依赖裁剪。

## 实现

- `electron/main.mjs`：识别开发／打包模式，准备用户目录内的运行副本，使用随包 Node 启动 supervisor。
- `electron/supervisor.mjs` + `service-group.mjs`：管理两个服务，全部就绪才发出 ready；失败或退出时清理已拥有的服务。
- `electron/service.mjs`：开发时 Next dev，打包时 Next start；招聘独立 Node 服务；身份检查、页面检查、数据检查与原有进程归属清理。
- `apps/recruiting/local.mjs`：仅本地启动器提供 `/api/desktop/health`，检查存储可读并返回应用身份，不暴露业务记录；独立 Vercel handler 不受影响。
- `scripts/package-desktop.mjs`：独立暂存构建、可复现运行时下载、资源打包、签名与签名验证。

参考：[Electron 手工打包](https://www.electronjs.org/docs/latest/tutorial/application-distribution)、[Node 官方校验清单](https://nodejs.org/dist/v24.20.0/SHASUMS256.txt)。

浏览器完成后自动返回的行为与验证见 [返回发起对话验收](./browser-return-validation.md)。
