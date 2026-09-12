# Electron 安装包验收 — 2026-09-07

范围：同一个 `electron-phase-one` worktree 内构建，macOS Apple Silicon 本机安装版。未切换 worktree，未发布，未修改主模型或浏览器模型。

## 可独立运行的资源

- 安装位置：`~/Applications/Syntropic.app`；产物：`build/desktop/release/Syntropic.app`。
- buildId：`588a8844-4982-47ce-a47c-08547481aaef`。
- 随包 Node 24.20.0、Electron 44.2.0、Chrome for Testing 151.0.7922.34、agent-browser 原生执行器，以及工作台生产依赖和独立招聘服务。
- `codesign --verify --deep --strict` 通过。包内 79 个符号链接全部可解析，均未指向包外。
- 运行时检查确认两个服务的可执行文件均为 App 内的 `node/bin/node`；真实任务的 Chrome 位于 App 的 `Resources/browsers`。
- 运行 PATH 只含包内 Node 和 macOS 系统目录，不包含 Homebrew 或开发工具目录；Node 与 agent-browser 原生依赖检查未发现 Homebrew 动态库。
- 开发服务器停止后启动安装版，30141 和 30143 均由 App 启动并通过身份、页面及数据健康检查。

## 无个人开发配置的检查

使用临时空 HOME、空 Pi 目录、白名单环境变量和包内 Node，在额外本地端口启动安装后的生产运行文件。按首次使用流程创建工作目录，然后检查页面、运行会话、模型列表和授权提供方接口，均为 200。没有复制当前账号或密钥。

最初直接请求模型列表返回 403，因为默认运行目录不在该空用户的文件授权根中；经正常创建工作目录并传入其 cwd 后通过。此检查沿用应用的目录授权边界，没有扩大白名单。

这属于本机隔离环境检查，**不等同于在另一台无开发环境的 Mac 上实机验收**。当前包只覆盖 macOS arm64；尚未测试 Intel Mac、Windows、其他系统版本。模型调用仍需网络及用户授权。当前 ad-hoc 签名不等于 Apple Developer ID 签名／公证，外部分发前还需要完成签名公证和目标机器验收。

## 真实招聘查询

安装版新对话中通过 UI 输入：

> 帮我看看 AI Agent 工程师岗位，面试结束了多少人，还有几人的评价没齐？

成功任务：`bbe1406d-50c2-48af-ab4c-70afc4ea63ac`，主会话：`01a07c3b-7c11-7084-8a94-32340d11ad85`。

- UI 发送：2026-09-07 14:17:52.144 UTC。
- 主 Agent 最终回复：14:18:19.988 UTC，端到端 **27.844 秒**。
- 浏览器执行：19.539 秒，1 次网页操作、3 轮；从入口页进入岗位详情，读取岗位统计及缺评价快捷入口人数。
- 主 Agent 汇总：面试结束 **12 人**，评价未齐 **3 人**。
- 主模型 `openai-codex / gpt-5.4-mini`；浏览器模型固定 `openai-codex / gpt-5.6-luna`。
- 最终系统提示词中的业务网站描述仍只有一份；已删除的招聘细则没有重新加入。
- 没有调用招聘业务 API、读取业务数据文件或播放预设动作代替 Agent 网页操作。

排障记录：首个安装包中 Webpack 对动态 `createRequire` 的转换导致执行器加载失败；改为在实际 Node 运行时取得 `module.createRequire` 后，重新生产构建并完成上述成功查询。修复后首次查询曾在主模型阶段出现 `fetch failed`，没有产生浏览器任务；新的对话重试成功。网络失败不计作成功，也不把一次成功当作稳定耗时保证。

## 保存、升级与退出

1. 通过招聘网页表单将 AI Agent 工程师岗位招聘目标从 6 改为 9，页面显示保存成功。
2. 退出旧安装版，替换为新构建 App，再启动；页面重新读取后目标仍为 9。
3. 通过网页表单恢复为 6，保留原始查询口径。
4. 完成真实查询后按 `⌘Q`，确认主 App、supervisor、两个服务、Chrome 及其已观察到的辅助进程全部退出；30141／30143 不再监听。
5. 再次打开安装版，两个服务正常启动。

招聘数据位于 `~/Library/Application Support/Syntropic/recruiting/state.json`，与运行版本目录、开发网站 `.data` 和 Pi 配置分离。未重置 Pi 配置、会话或模型授权。

## 自动检查

- Electron 生命周期与进程归属测试：12/12。
- 浏览器操作白名单及业务上下文注入测试：4/4。
- 招聘数据与交互测试：7/7（本阶段已有验证）。
- TypeScript 无输出检查、修改文件 ESLint、`git diff --check` 通过。
- 暂存目录 Next 生产构建成功；保留已有会话 HTML 导出路由的动态依赖警告，浏览器执行器的 `createRequire` 警告已消失。
