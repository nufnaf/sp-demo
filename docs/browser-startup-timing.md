> 历史记录：文中模型 JD 生成/profile 流程已被固定演示流程替代，当前边界见 [JD 固定演示结果](jd-mock-demo.md)。

# 浏览器准备阶段计时与后续优化（2026-09-09）

> 后续更新：细分计时已随 `85107e9a-c33f-427c-a5c7-cefa4d01e36d` 安装。用户已选择固定 HTML 模板保留真实正文生成，并要求桌面可见后预启动 Chromium；后续正文限长与提示词精简已随 `5748d921-5c5c-4286-9a0c-ac486e6d9739` 安装，最新结果见 [记录](prompt-length-audit.md)。以下单独测试是预启动实现前的历史基线。

## 首次细分时的状态与口径

本次仅增加源码观测和验证，不改变真实网页执行、隔离、停止、接管、导航顺序或现有 1.5 秒视口兜底。没有更换 JD 生成方式、主模型或安装包，未提交。当前安装版仍为 `abeb00a2-0e7a-4a2c-a6d7-5ff59ca5053b`；新细分计时须在后续暂存构建安装后才能用于完整 App 复测。

原 `BrowserTaskState.timings` 保持不变；新增 `startupTimings`，是 `browser-start` 内部的子阶段，不能与父阶段重复相加。每项包含相对准备开始的 `offsetMs`、`durationMs`、完成/失败状态。视口另记 `ready` / `timeout`。中途异常保留已完成子阶段和失败阶段的记录，失败原因仍由原任务状态处理。只记录固定阶段名、时间和状态，不记录凭据、网页地址、正文或错误内容，不额外逐项发送 SSE/刷新页面。

| 阶段 | 实际操作 |
| --- | --- |
| `profile-prepare` | 定位 Chromium，准备本任务独立配置目录 |
| `chromium-launch` | 启动 Chromium 并等待 Playwright context 可用 |
| `context-connect` | 读取调试连接信息，配置工作台访问隔离 |
| `page-register` | 获取/创建页面，注册页面与弹窗隔离 |
| `target-identify` | 获取目标页 ID，建立并释放临时调试连接 |
| `initial-page-state` | 读取初始页面状态，准备 App 的页面打开事件 |
| `viewport-wait` | 等待可见窗口尺寸握手，或原有 1.5 秒超时 |
| `viewport-seal` | 等待尺寸队列完成，锁定执行期间视口 |
| `executor-spawn` | 定位并创建 agent-browser 子进程，安装生命周期监听 |
| `executor-ready` | 等待子进程通信 socket 可用 |
| `executor-connect` | agent-browser 连接指定 Chromium |
| `target-pin` | 选择并锁定本任务页面 |

打开招聘网页仍计入独立 `navigate`；读取网页计入 `snapshot`；真实模型响应计入 `model`。`chromium-launch` 包括浏览器自动化连接就绪，并非操作系统单纯 fork/exec 耗时。

## 本次测量

使用安装包自带 Node 24.20.0、Chromium 1234，加载当前 worktree 源码与 agent-browser 0.36.0。每轮新建配置目录并真正启动/关闭 Chromium 和执行器，读取空白页确认连接可用。没有调用模型、发布岗位或修改运行中 App。测试文件：`lib/browser/startup-timing.test.mjs`。

前两轮由测试监听器直接调用与 UI 相同的 resize 入口，第三轮故意不发送尺寸。**这不是 Electron 窗口端到端测试**：前两轮未包括实际窗口挂载/渲染延迟；第三轮超时是人为验证兜底，不是 App 故障。

| 毫秒 | 正常握手 1 | 正常握手 2 | 无尺寸兜底 |
| --- | ---: | ---: | ---: |
| profile-prepare | 3 | 1 | 1 |
| chromium-launch | 3290 | 1933 | 2121 |
| context-connect | 35 | 27 | 19 |
| page-register | 6 | 1 | 1 |
| target-identify | 12 | 6 | 7 |
| initial-page-state | 15 | 7 | 7 |
| viewport-wait | 25 | 22 | 1501 |
| viewport-seal | 19 | 24 | 0 |
| executor-spawn | 6 | 3 | 3 |
| executor-ready | 65 | 43 | 42 |
| executor-connect | 28 | 10 | 10 |
| target-pin | 52 | 59 | 89 |
| 准备总时间 | 3560 | 2136 | 3801 |

每项独立四舍五入，和总时间可能有数毫秒差异。原始证据在忽略目录 `build/verification/browser-startup-details/startup.tap`。

这些样本中最主要的本地成本是 Chromium 启动；不能反推上轮 9.48/6.78 秒或历史约 33 秒的准备阶段具体慢在何处，旧记录没有子阶段数据，也没有对应 CPU/磁盘负载记录。

验证结果：新增 2 项检查（含两次真实正常启动、一次无尺寸兜底），以及原视口稳定/手动接管、页面返回、任务结束/取消和命令边界等 16 项检查均通过；TypeScript、修改范围 ESLint 和 diff 空白检查通过。原回归输出为 `build/verification/browser-startup-details/regressions.tap`。没有重跑此前已记录错误类型不匹配的关闭目标页完整集成用例，不宣称全部浏览器回归通过。

## 首次细分后的优化建议（历史）

1. 新计时进入下一安装包后，先采集完整 App 的正常和慢样本，区分 Chromium 启动、窗口握手和初始页面状态读取；保留相同发布步骤与完整 JD，测试期间避免同时构建。
2. 若启动持续占主要成本，可在用户查看 JD 时提前准备一个全新的、尚未执行的独立浏览器环境，点击发布再移交控制。收益是把启动等待前移，不是让 Chromium 启动本身消失。需要处理未发布即关闭成果、停止、退出清理和单次领用，保持原任务页面隔离；没有测量前不引入共享浏览器池。
3. 若真实窗口频繁走满 1.5 秒兜底，先修握手投递/挂载时机，或由已挂载容器提供初始尺寸。不要单纯取消等待，避免首次快照尺寸与可见页面不一致。
4. 执行器启动和连接在这两轮仅 151/115 毫秒，现阶段收益小，不优先复用执行器。复用会增加目标页锁定、停止和退出清理复杂度。

## JD 是否真实生成

是。当前代码链路：

- `lib/jarvis.ts` 的 `start_task` 调用 `runtime.startTask`。
- `lib/rpc-manager.ts` 创建真实 Pi AgentSession，向它发送 `recruitingTaskPrompt`；实际走 SDK 的 `inner.prompt`。
- `lib/presentation-runtime.ts` 为 App 专属工作台选择 `openai-codex/gpt-5.6-luna`、low，原 Pi/Web 默认配置不变。
- `lib/feishu-demo-extension.ts` 提供真实资料列表和正文工具；`lib/feishu-demo-client.ts` 从飞书官方 Drive/Docx API 获取内容。
- `lib/recruiting-jd-contract.ts` 要求模型根据本次读取内容生成完整 HTML，用 `write` 写入当前工作目录，再用 `read` 检查；没有预设 JD 回退。

今早两轮真实会话元数据均包含 Luna assistant 的 `start_task → feishu_demo_documents → feishu_demo_read → write → read` 工具调用及 token usage。两份文件哈希不同，网页保存的正文分别与本轮文件全文一致。证据在 `build/verification/latency-20260909-morning/round{1,2}/published.json`、`consistency.json`，不是仅凭提示词确认。

| JD 阶段（秒） | 今早第 1 次 | 今早第 2 次 |
| --- | ---: | ---: |
| 发出请求至文件写入 | 48.104 | 51.576 |
| 正文读取完成至模型输出 write 指令 | 32.702 | 35.566 |
| 实际写文件 | 0.005 | 0.005 |

上表生成间隔包含模型服务响应、推理与输出完整 HTML/CSS，不是纯推理时间。文件完成后的读回检查和最终汇报另需时间。

用户正在考虑改变真实/mock 边界，尚未决定；现有真实实现保留。可选方向：

- 保留真实 JD，固定 HTML 外壳/样式，仅由模型生成岗位内容，再程序化渲染。保留“本次读取、本次撰写”的能力，减少重复样式输出；实际节省需验证，不能直接按字符比例估算。
- 改为预设 JD：本地建立该轮成果与任务状态，继续支持打开、发布和退出清理。它不再证明模型基于本次材料撰写，不应在技术说明中称为真实生成；仍需用户确认范围变更。
- 仅 browser use 用真实模型：除预设 JD 外，已知招聘意图的调度和最终展示也走程序化逻辑，直接调用现有浏览器任务入口，保留浏览器模型真实读页、填表、提交和核对。否则只换 JD，主 Agent 的发布/查询交接仍会发生真实模型调用。飞书读取可以继续是真实 API，候选人、洞察、日程保留现有预设逻辑。

未切换上述任何方案，也没有为本轮测试更改发布协议或绕过网页写入。
