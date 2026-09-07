# Syntropic 双击启动版

## 使用

在 macOS Apple Silicon 上双击 `Syntropic.app`。App 会准备内置运行文件，同时启动工作台（127.0.0.1:30141）和招聘系统（127.0.0.1:30143），两者通过健康检查后进入工作台。不需要 Node、npm、终端或预装 Chrome。

首次准备运行文件会比后续启动慢。执行 Agent 任务仍需要联网和 Pi 中已有的有效模型授权；应用不附带账号凭据，不改变主模型，浏览器模型仍固定为 `openai-codex / gpt-5.6-luna`。同机已有 Pi 配置继续使用，首次在另一台机器使用需从设置完成授权。

开始新对话，等待输入框就绪后发送：

> 帮我看看 AI Agent 工程师岗位，面试结束了多少人，还有几人的评价没齐？

网页自动打开并操作，任务完成后自动展开原发起对话，显示主 Agent 的汇总。若你已经切走或手动操作浏览器，则保留当前界面，可从“对话记录”查看结果。初始数据结果是面试结束 12 人、评价未齐 3 人。浏览器执行期间只显示简短状态和停止按钮；完成后隐藏状态栏，结果统一在原发起对话中呈现，不在网页上方重复显示模型、步数、耗时或内部核查报告。

`⌘Q` 退出并清理 App 启动的服务与浏览器后代进程。macOS 红色关闭按钮只关闭窗口，后台继续运行；从 Dock 可恢复窗口。故障页提供重试，重试会停止本 App 管理的服务后重新检查两个服务。已经发送的网页保存请求不会因为退出而撤销。

固定端口上已有其他程序、开发版或其他版本时，App 明确报错，不抢占端口、杀掉原服务或改动原数据。先正常退出原 App；若是手动启动的开发服务，在其终端停止后重试。可复用同一路径且通过身份与健康检查的服务，复用者不拥有其退出权限。

## 数据与安装包边界

- 招聘数据：`~/Library/Application Support/Syntropic/recruiting/state.json`。首次生成初始数据，重启保留；系统设置中的“恢复初始数据”只重置此招聘数据。
- 内置工作台运行副本与可写缓存：`~/Library/Application Support/Syntropic/runtimes/<buildId>`。每次构建有独立版本目录；升级不会替换招聘数据。旧运行目录暂不自动清理。
- Electron 页面偏好：`~/Library/Application Support/Syntropic`。
- Pi 配置与会话仍采用原有 `~/.pi/agent`（或显式配置的 Pi 目录）；不复制、打包或迁移凭据。
- 开发网站仍独立保存于 `apps/recruiting/.data`，与安装包中的招聘数据分开。安装包只携带初始数据生成代码，不携带开发操作记录。

当前交付是本机 ad-hoc 签名的 macOS arm64 `.app`，不是 Apple Developer ID 签名／公证发行版。适合本机双击演示；通过网络分发给其他 Mac 时可能触发 Gatekeeper，公开分发需另做签名与公证。尚未提供 Windows、Intel Mac、自动更新或对外托管。

已完成的验证与限制见 [安装包验收记录](./electron-packaging-validation.md)，最新查询耗时见 [浏览器延迟优化验证](./browser-latency-validation.md)。当前产物约 2 GB，优先携带完整依赖；首次展开运行副本还会占用额外磁盘空间。

## 重建安装包

必须在原 worktree 中执行：

```bash
cd /Users/xiewannan/code/sp-demo-worktrees/electron-phase-one
npm run package:desktop
```

输出：`build/desktop/release/Syntropic.app`，旁边有使用说明。每次重建替换此生成产物；不要在 App 运行中覆盖其包文件，应先退出。不需要新建或切换 worktree。

构建脚本下载并校验固定 SHA-256 的官方 Node 24.20.0 arm64，使用锁定的 Playwright 版本下载对应 Chrome for Testing，使用已安装的 Electron 44.2.0。第一次构建需要网络，下载缓存位于 `build/desktop/cache`。开发 Node/npm 仅构建时使用，最终 App 附带独立运行时。

脚本白名单复制源码到 `build/desktop/source`，在暂存目录执行 Next 生产构建，再将生产产物、依赖、招聘应用、Node 和浏览器组装成 App。不会在正在开发的根目录执行 `next build`，不会修改根目录 `.next`、打包 `.env`、招聘保存文件或用户凭据。`build` 已忽略并从 TypeScript 开发检查排除。首次版本优先保证完整运行依赖，未做激进的依赖裁剪。

## 实现

- `electron/main.mjs`：识别开发／打包模式，准备用户目录内的运行副本，使用随包 Node 启动 supervisor。
- `electron/supervisor.mjs` + `service-group.mjs`：管理两个服务，全部就绪才发出 ready；失败或退出时清理已拥有的服务。
- `electron/service.mjs`：开发时 Next dev，打包时 Next start；招聘独立 Node 服务；身份检查、页面检查、数据检查与原有进程归属清理。
- `apps/recruiting/local.mjs`：仅本地启动器提供 `/api/desktop/health`，检查存储可读并返回应用身份，不暴露业务记录；独立 Vercel handler 不受影响。
- `scripts/package-desktop.mjs`：独立暂存构建、可复现运行时下载、资源打包、签名与签名验证。

参考：[Electron 手工打包](https://www.electronjs.org/docs/latest/tutorial/application-distribution)、[Node 官方校验清单](https://nodejs.org/dist/v24.20.0/SHASUMS256.txt)。

浏览器完成后自动返回的行为与验证见 [返回发起对话验收](./browser-return-validation.md)。
