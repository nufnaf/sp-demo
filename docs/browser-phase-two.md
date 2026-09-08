# 第二阶段：可观看的 browser use 演示

> 2026-09-08 完整演示更新：Electron 现采用独立运行数据、退出后新开场；必须先真实生成并发布本轮岗位，再查询其预设进展。飞书改为专用应用直连。本文原有计时和跨重启行为属于历史验证；当前步骤与结果见 [完整招聘演示](presentation-demo.md)。

实现继续位于 `/Users/xiewannan/code/sp-demo-worktrees/electron-phase-one`，分支仍为 `codex/electron-phase-one`。第一阶段尚未提交的完整成果直接保留在这里；没有基于空缺的 HEAD 另建副本。主 checkout 的 `docs/specs/` 未修改。没有提交、推送、部署或制作安装包。

## 启动和演示

本机使用 Node 26.4.0；agent-browser 0.36.0 的 npm 安装要求 Node 24 或更新版本。首次安装运行 `npm ci --legacy-peer-deps`。如果 npm 禁止安装脚本，执行 `node node_modules/agent-browser/scripts/postinstall.js` 准备其官方原生二进制；Electron 安装说明见[桌面开发说明](electron-development.md)。

两个终端分别运行：

```bash
cd /Users/xiewannan/code/sp-demo-worktrees/electron-phase-one
npm run desktop
```

```bash
cd /Users/xiewannan/code/sp-demo-worktrees/electron-phase-one
npm run demo:browser
```

测试网页监听 `http://127.0.0.1:30142`，不对外部署。三个测试记录只存在于测试服务内存中，重启测试服务会恢复初始数据。`Ctrl+C` 停止测试服务；它是单独启动的演示资源，不由 Electron 接管。

人工演示：点击 Dock 的“浏览器”，输入测试网址，筛选或打开记录，填写备注并点击保存。支持普通键盘、粘贴、滚动。截图和输入转发来自同一个真实 Chrome 页面。

AI 演示：在桌面底部“Syntropic”输入框，或普通 Pi 任务聊天中发送：

> 打开 http://127.0.0.1:30142 ，筛选编号 R-102 且状态为待处理的记录，进入详情，填写备注“演示备注已核对”并保存，然后告诉我实际保存结果。

主 Agent 调用一次 `browser_task`。专用页面自动打开、前置，桌面对话面板收起以便观看。浏览器顶部显示实际进度、步骤、耗时与结果；主 Agent 收到结构化结果后汇总。完成后点击“对话记录”查看主 Agent 的回复。测试服务的 `/audit` 是只读验收记录，不是 Agent 的操作入口。

AI 操作期间，专用页面禁止人工输入和导航，可以停止任务或关闭该标签页。人工浏览请打开另一个标签页。没有接管、继续或交替控制流程。点击窗口左上角关闭只是收起浏览器应用；关闭标签页才关闭执行目标。停止不能撤回已发出的保存请求，界面会明确提示核对结果。

## 执行和隔离

- 复用第一阶段 `BrowserApp`、浏览器管理器和 SSE 窗口事件；不新增 Electron webview 或另一套浏览器显示机制。画面来自真实网页的持续截图，单个画面请求完成后才请求下一帧，避免截图积压。
- 每个 AI 网页任务分配一个独立 Chrome 实例、独立 profile 与固定页面。人工浏览仍使用已有 workspace profile。任务 profile 位于 Pi 的 `browser/profiles/`，不使用日常 Chrome 资料，关闭 App 后仍保留目录，后续新任务使用新的目录。
- 主 Agent 和桌面全局 Agent 均可整体委派。浏览器 Pi AgentSession 使用内存会话，不加载项目/全局扩展、技能、上下文文件或 shell 工具，也不改 Pi 默认模型设置。只开放 `browser_step`、`browser_read`、`browser_finish`。
- 所有 AI 网页导航、点击、填写、选择、按键、滚动和快照由锁定版本的 **vercel-labs/agent-browser 0.36.0 原生 daemon** 执行。适配器使用其 JSON/Unix socket 协议；这不是模拟动作或业务 API 调用。
- 宿主自己启动并持有 daemon 子进程，选择 CDP target 并启用 `pinTab`。模型拿不到调试地址、浏览器选择、标签切换、任意选择器、JavaScript、文件或任意协议命令。关闭 target 后，agent-browser 报错，任务终止，禁止相邻标签回退。
- 新窗口/弹窗会关闭，不自动纳入任务。任务页面及页面脚本禁止向 Syntropic 的 30141 端口发请求，覆盖导航、重定向和 WebSocket；浏览器进程与 Electron 主界面独立。
- AI 操作按顺序执行。已观察到的多个字段可一次填写，再点击一次；可能换页的动作只能放在批次末尾，随后自动返回新快照。没有固定的操作间等待。模型自然结束却遗漏结构化结果时，只允许补报结果，禁止重新操作网页。
- 默认 `low` 思考强度，最多 3 个并发任务、每个主会话 1 个活跃网页任务；单任务最多 3 分钟、60 步、40 个模型轮次。停止和父任务取消会撤销后续操作、终止 daemon 并取消 Pi 请求。已提交的网络请求不能回滚。

## 模型与授权

按用户最终决定固定为 `openai-codex / gpt-5.6-luna`，不提供独立模型设置界面，也不会静默降级。已通过现有 Pi ChatGPT 登录发起真实请求并收到 `LUNA_BROWSER_OK`；完整浏览器任务也使用此模型。主 Agent 保留其既有模型配置。

缺少授权时，任务显示具体错误及“打开设置与登录”入口。沿用“设置 → Models → ChatGPT Plus/Pro → Login”；凭据仅由原有 Pi AuthStorage / ModelRuntime 处理。不要复制 Codex 凭据、令牌或 OAuth 返回地址到聊天/源码/日志。

[OpenAI 官方模型可用性说明](https://learn.chatgpt.com/docs/enterprise/workspace-model-availability)强调账号/产品边界；本机实际请求成功才是本 Demo 的依据。Gemini 模型选择已按用户变更移出范围。

## 后续网页系统接入

| 位置 | 职责 |
| --- | --- |
| `lib/browser/extension.ts` | 主 Agent 的 `browser_task({url, task})` 委派入口；任务说明放入业务目标、筛选条件、待填写内容。 |
| `lib/browser/tasks.ts` | 专用 Pi 会话、固定 Luna 配置、受限工具、进度、结构化结果、取消和预算。 |
| `lib/browser/agent-browser.ts` | 版本锁定的 agent-browser 协议适配、允许操作列表、进程生命周期。 |
| `lib/browser/manager.ts` | 人工/AI 页面管理、专用实例和目标身份、同页截图、输入门禁。 |
| `components/BrowserApp.tsx` | App 内画面、人工输入、状态和停止入口。 |
| `scripts/browser-demo.mjs` | 可删除/替换的本地验收网站，不包含招聘业务。 |

接入未来招聘系统时，将任务 URL 换为实际系统地址，并传入完整业务目标；保留网页实际交互和结果核查。此阶段不实现招聘系统。跨任务登录复用、多窗口 OAuth、验证码、下载上传、生产安全隔离及流媒体体验均未扩展；需要这些能力时单独设计，不能偷偷转到日常 Chrome。

## 验证

```bash
npm run test:browser
npm run test:desktop
node_modules/.bin/tsc --noEmit
```

具体本机验收结果见[第二阶段验证记录](browser-phase-two-validation.md)。全仓库 lint 的既有第三方模板错误见该记录。
