# Syntropic 开发阶段桌面版

现在支持双击运行的 macOS Apple Silicon 安装包，构建与使用见 [双击启动版说明](electron-packaging.md)。下面保留开发方式的运行边界。

开发入口 `npm run desktop` 现在统一启动／检查工作台和独立招聘网站，不再需要额外运行招聘启动命令。也可以独立运行招聘网站做网页开发。招聘查询、评价保存和重置见 [第三阶段说明](browser-phase-three.md)。

开发模式需要本机 Node、源码、依赖及 Chrome / Edge / Chromium；打包模式内置 Node 和浏览器，并使用生产产物。当前安装包仅本机签名，尚无 Apple 公证或自动更新。

## 启动与停止

在实现所在的 worktree 中运行：

```bash
cd /Users/xiewannan/code/sp-demo-worktrees/electron-phase-one
npm ci --legacy-peer-deps
npm run desktop
```

依赖已安装时只需 `npm run desktop`。锁定 Electron 44.2.0、Next.js 16.3.1、Pi 0.84.3。`--legacy-peer-deps` 用于兼容现有语音 SDK 的 React 17 peer 声明与项目的 React 19；没有改动这些业务依赖版本。

Electron 首次运行需要下载官方运行时，终端会显示下载状态；可提前执行 `node node_modules/electron/install.js`。下载失败时检查网络并重试，不要禁用证书验证。

- `⌘Q` 或启动终端中的 `Ctrl+C`：退出 App，等待本次启动的后台和后代进程完成清理。
- macOS 点红色关闭按钮：只关闭窗口，App 和后台继续运行。再次激活 Dock 中的 App 或重新执行 `npm run desktop` 会恢复窗口。
- 重复启动会前置已有窗口，不会创建第二个后台。当前开发 App 全局只运行一个实例；切换 worktree 前先退出旧实例。
- 原网页方式仍为 `npm run dev`，访问 `http://127.0.0.1:30141`。
- 不要运行 `next build`，不要用不同端口启动同一 checkout 的第二个 Next dev，也不要改用 webpack。

## 关键文件

| 文件 | 职责 |
| --- | --- |
| `electron/launch.mjs` | 本机 Node 入口和 Electron 启动。 |
| `electron/main.mjs` | 单实例、窗口、导航、系统浏览器与退出。 |
| `electron/preload.cjs`、`status.*` | 隔离的恢复页和有限重试能力。 |
| `electron/supervisor.mjs`、`service.mjs` | 后台健康检查、复用/启动、IPC 断开清理。 |
| `electron/process-tree.mjs`、`native-host.mjs` | 后代进程归属、PTY 本机运行环境。 |
| `app/api/desktop/health/route.ts` | 无凭据的当前 checkout 身份检查。 |
| `package.json`、`package-lock.json` | 桌面启动/测试脚本和锁定的 Electron 依赖。 |

## 进程与服务归属

```text
npm run desktop（本机 Node 启动器）
  └─ Electron 主进程 + 隔离的工作台页面
       └─ 本机 Node supervisor（IPC 管理通道）
            ├─ 招聘 Node 服务（仅端口空闲时启动）
            └─ Next dev（仅端口空闲时启动）
                 ├─ Next API / Pi AgentSession
                 ├─ 独立资料目录的 Chrome / Edge / Chromium
                 └─ Pi 工具和 PTY 子进程
```

启动器把自身 Node 的绝对路径交给 Electron，supervisor 使用该 Node 启动 Next；不使用 Electron 内置 Node 加载 Pi 或 `node-pty`。后台 cwd 固定为启动脚本所在 checkout，资源路径也从脚本路径解析，不依赖调用终端的 cwd。

启动先显示本地状态页，再检查端口及 `/api/desktop/health` 的 checkout 标识，并验证首页和 `/api/agent/running`。首次编译最多等待两分钟。失败页面说明端口占用、不同 worktree、开发锁、启动失败或超时，并提供重试。启用了 `PI_WEB_PASSWORD` 的服务会明确报错，本阶段不绕过或复制其密码。

已有且属于当前 checkout 的健康服务可以复用，永远不对其发送退出信号。端口上是其他 checkout 或其他程序时停止连接并提示用户，不抢占端口。`.next/dev/lock` 存在且端口空闲时不创建第二个 Next 实例，也不自动删除锁。

App 新建的后台由 supervisor 记录进程后代关系及启动时间，包含独立进程组的浏览器和 PTY。退出先发送 SIGTERM，给出 1.5 秒退出时间，再清理尚未退出的已知后代；不会按进程名或端口批量杀进程。Electron 意外退出时，supervisor 通过 IPC 断开执行同一清理流程。不要同时强杀 Electron 和 supervisor，或把整棵进程树冻结；操作系统强制关闭和断电无法保证优雅退出。

首个平台为 macOS arm64；POSIX 进程管理可用于 Linux，但本次未实测 Linux。Windows 桌面入口会明确提示暂不支持，网页入口不变。

## 数据与凭据

- 沿用 Pi 的 `getAgentDir()` 和原有配置机制；默认 `~/.pi/agent/`，现有 `PI_CODING_AGENT_DIR` 覆盖仍有效。
- 不迁移、不覆盖已有 `settings.json`、`models.json`、`auth.json` 和会话，不读取 Codex CLI 登录态。
- Electron `userData` 仅存网页缓存、窗口/网页偏好，macOS 为 `~/Library/Application Support/Syntropic Dev`；不作为另一套 Pi 配置目录。
- 系统 Node 后台继承启动环境及原有 Next 环境加载机制。OAuth 凭据由 Pi 服务端保存；preload 不提供凭据、环境变量、文件或任意 IPC 访问。
- 桌面启动器不输出后台原始 stdout/stderr，避免扩展、工具或 SDK 将凭据和授权网址转发到桌面日志。排查编译错误时先退出 App，再从本 checkout 运行 `npm run dev`；不要共享包含账号信息的完整日志。
- `node-pty` 1.1.0 的 macOS npm 预编译 `spawn-helper` 实测缺少执行位；桌面启动只修复实际选中的该依赖文件的 owner-executable 位，不为 Electron 重编译原生依赖。
- 历史会话若来自另一台机器，其旧 cwd 可能不存在。用顶部工作台菜单新建本机工作台；不要改写历史会话路径来伪造迁移。

## ChatGPT 登录与模型验证

打开 **设置 → Models → Add provider → ChatGPT Plus/Pro OAuth → Login → Browser login (default)**。

Electron 拦截现有界面的 `window.open`，在系统默认浏览器中打开 OAuth 网页。系统浏览器选择的 profile 由浏览器自己决定；不需要 ChatGPT/Codex 浏览器扩展。用户在浏览器完成登录后，Pi 接收 `http://localhost:1455/auth/callback`。如果自动回调没有完成，可把返回网址直接粘贴到 App 的授权框；不要复制到聊天、代码或日志。

授权成功以 Pi Provider 的已连接状态和实际模型请求为准。Codex CLI 已登录、OAuth 页面可打开或者模型列表可见，均不代表 Pi 的对话请求成功。本阶段不做 Codex 凭据导入、Codex App Server 或 Pi 替换。

## 浏览器与后续扩展位置

继续使用 `components/BrowserApp.tsx` 的截图和输入转发界面，后端为 `lib/browser/manager.ts`，路由在 `app/api/browser/`。浏览器 profile 仍为 Pi 数据目录下的 `browser/profiles/<cwd 哈希>`，不会打开用户的日常 Chrome profile。

`lib/browser/extension.ts` 注册 `browser_open` 等 Pi 工具。`browser.opened` 事件经过现有事件流交给 `components/AgentDesktop.tsx`，打开并前置工作台内的浏览器窗口；Electron 无需再维护一套事件或浏览器状态。

第二阶段已沿此边界接入：`lib/browser/agent-browser.ts` 管理真实 agent-browser 执行器，`lib/browser/tasks.ts` 管理固定 Luna 模型的 Pi AgentSession、任务状态和停止。任务拥有独立 Chrome 实例、资料目录与固定 CDP target；主 Agent 通过 `browser_task` 整体委派。没有模型选择界面或接管恢复流程。第三阶段的 `apps/recruiting` 提供独立招聘网站，`lib/browser/business-sites.ts` 将其入口与业务语义提供给主 Agent，实际操作仍经过上述执行器。

## 隔离边界

隔离选项参照 [Electron 官方安全建议](https://www.electronjs.org/docs/latest/tutorial/security)。主窗口显式关闭 Node 集成，启用 contextIsolation、sandbox 和 webSecurity；禁用 webview。preload 只提供恢复页的 `retry()`，主进程校验调用方必须为当前窗口主 frame 及本地恢复页。

主窗口只允许当前固定 loopback origin 的工作台导航。外部链接和新窗口交给系统浏览器，限制为 HTTP、HTTPS、mailto；其他协议拒绝。外部重定向不会静默拉起系统应用。麦克风/通知等仅接受工作台来源且交给用户确认。不忽略证书错误，也不禁用 webSecurity。

## 验证命令

```bash
npm run test:desktop
node_modules/.bin/tsc --noEmit
npm run lint
node_modules/.bin/eslint electron app/api/desktop/health/route.ts
```

桌面测试覆盖等待就绪、服务归属、不同 checkout、未知服务、Pi API 失败、后台失败、开发锁、启动中取消以及独立进程组的后代清理。全仓库 lint 当前包含 `.agents/skills/lark-apps/creative-design/starter-components/` 内已有的 4 个错误、32 个警告；本次不修改这些第三方模板。

实际桌面、登录、浏览器与进程验证结果见[本阶段验证记录](electron-validation.md)。
