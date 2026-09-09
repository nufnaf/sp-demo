# Syntropic Demo

Syntropic 是面向日常办公的通用 AI 工作台。用户在桌面中查看资料、使用应用、委派任务和接收成果；系统结合工作上下文提出下一步建议，由用户决定是否继续执行。

本仓库以招聘展示这种交互：从业务资料生成 JD，建议发布岗位，通过网页完成内部发布，再查看招聘进展、面试评价和后续协作建议。招聘是产品的演示场景，不是产品的全部定位。

## 两条实现线

| 版本 | 用途 | 能力与数据 |
| --- | --- | --- |
| `main` | 纯静态交互原型 | 预设场景、资料和模拟执行，不包含 Pi 的真实 Agent 能力 |
| `dev` | 接入 Pi 的工作台 | 真实任务、文件成果、应用连接与本机持久化；不自带静态原型的完整演示开场状态 |
| `codex/electron-phase-one` | 当前 Electron 与浏览器执行扩展 | 在 dev 基础上增加桌面启动、独立招聘网站、真实 browser use 和 JD 发布串联 |

当前扩展基于 `7992aeb`，工作目录为 `/Users/xiewannan/code/sp-demo-worktrees/electron-phase-one`。比较改动前后行为，应以这个提交为基准；静态原型用于对齐产品体验，不能当作 dev 原先具备的功能。

主仓与 App 曾共用本机 Pi 历史，因此运行旧代码也能看到新测试产生的任务和 JD。旧代码不等于旧数据快照。底部 Dock 的固定应用属于浏览器配置，普通浏览器与 Electron 不会自动共享这些配置。

## 演示中哪些是真实的

- **真实执行**：Pi 主 Agent 接收任务、生成文件成果；专用浏览器 Agent 打开 App 内网页，读取、筛选、填写表单、提交并核对结果。
- **虚构业务数据、有效操作**：独立招聘网站使用虚构职位、候选人和评价，统计从同一份业务数据计算；页面保存与刷新有效。
- **场景展示**：识别 JD 后的发布建议可以按预设条件触发，无需实现通用行为预测。BOSS 直聘仅保留展示标签，不执行外部发布。
- **模型边界**：浏览器执行固定 `openai-codex / gpt-5.6-luna`，App 内主 Agent 与生成任务默认使用 `openai-codex/gpt-5.6-luna`、low 推理；普通 Web 和原 Pi 默认设置保持不变。不得用业务 API、数据文件写入或预设动画代替约定的浏览器操作。

## 可重复的招聘演示

Electron 开场直接进入招聘工作台，可从顶部切换到产品发布工作台、调研洞察、个人工作台。三个方向分别准备发布计划、访谈记录、本周重点；任务、成果和组件位置按工作台隔离。Dock 固定飞书、人才招聘、产物库、浏览器、团队日程与应用市场。公司统一为星流科技：AI Agent 工程师，Agent 研发，6 人，杭州 / 上海。

桌面恢复业务目标、日程、当前任务、最近成果与 AI 洞察五个组件。任务发起后立即出现，完成、失败或停止后仍保留记录；真正生成的 JD 可从最近成果打开。岗位发布后目标组件同步招聘进展，洞察与对齐会议分别进入洞察和日程组件。业务资料仅介绍星流科技，Syntropic 保留为办公工作台品牌。

输入快捷提示按当前进度出现：生成 JD、查看成果后的右上角发布建议、发布后招聘窗口中的查询提示。发送后聊天与输入区收起，后台任务继续推进；点击 Syntropic 入口可继续输入。交互细节见 [快捷提示与收起行为](docs/composer-quick-prompts.md)，模型与网页各阶段计时见 [耗时复测](docs/agent-latency-investigation.md)。

浏览器准备阶段记录 Chromium 启动、页面初始化、视口握手和执行器连接。桌面可见后提前准备一个独立空白 Chromium，首个招聘网页任务独占领用，刷新不重复创建。JD 仍由真实 Luna 根据飞书资料撰写正文，由固定模板渲染并核验 HTML；没有使用预设 JD。实现与实测见 [JD 正文生成与预启动](docs/jd-template-browser-prewarm.md)。

飞书列表与正文由专用只读应用直连官方 API；管理员预先配置凭据与资料阅读权限。演示者无需飞书 CLI 或扫码，配置见 [飞书准备说明](docs/feishu-demo-setup.md)。本轮 JD 仍由真实 Agent 根据实际读取的资料生成。

查看 JD 后，统一右上角通知优先展示“发布岗位”，其他洞察排队。点击后真实浏览器填写、提交与核对；同一真实岗位随后关联 30 位预设候选人。网页和原招聘窗口共享候选人、评价与统计，查询使用真实 browser use。标准偏差洞察与对齐会议是模拟场景，不发送邀请。

一次运行内刷新保留进度；macOS 关闭窗口仍属于同一次运行。完全退出后，下次启动创建全新的专用演示目录，不恢复上轮任务、JD、洞察、发布或候选人修改。退出先停止本 App 的后台进程再删除本轮目录；极端异常遗留目录不加载，也不冒险删除未知仍在写入的数据。原 Pi 历史、模型设置、授权和用户文件不在清理范围。普通 Web 与独立招聘网站继续原有持久化。

当前安装版为 `5748d921-5c5c-4286-9a0c-ac486e6d9739`（2026-09-09），已包含真实 JD 正文生成、固定 HTML 模板、1200 字符上限、专用任务指令和 Chromium 预启动。最终两轮 JD 保存为 23.9 / 27.1 秒，发布全程为 28.1 / 30.0 秒；查询、洞察会议、刷新和退出恢复通过。此为组合优化后的两轮实测，不保证严格时限。详细用量与验证边界见 [提示词精简记录](docs/prompt-length-audit.md)。

上一安装版 `abeb00a2-0e7a-4a2c-a6d7-5ff59ca5053b`（2026-09-09）。主 Agent、后台任务和浏览器继续使用 Luna low。JD 发布改为文件引用交接：主 Agent 只传短目标与文件路径，工具读取全文供浏览器实际填写、提交和核对。两轮主 Agent 准备为 6.7 / 6.8 秒，浏览器执行为 39.5 / 35.1 秒，点击到浏览器完成为 46.2 / 41.9 秒；没有宣称整段达到 33 秒。两轮新 HTML JD 全文、原窗口返回、刷新和退出恢复通过，第二轮另验证真实查询、洞察及本地会议；原 Pi 54 个受检路径未变。额外页面关闭回归仍有错误类型不匹配，详见 [实测与验证边界](docs/agent-latency-investigation.md)。

工作台补齐版本 `1db95321-e222-44be-a886-8ae068db4024` 已补齐四个工作台、五个桌面组件、完成任务与真实成果展示，并修正飞书业务资料中的公司产品描述。新包两轮真实 JD、网页发布与查询、洞察会议和退出审计通过；另验证刷新、关闭窗口恢复、组件拖动保存与停止后接管。第二轮曾因 Mac 锁屏暂停，解锁后保留原 JD 继续完成。详细记录见 [工作台补齐验收](docs/workspace-presentation-completion.md)。飞书界面与输入快捷提示保留；[上一界面验收](docs/feishu-workspace-polish.md) 和 [历史五轮记录](docs/presentation-notification-retest-2026-09-08.md) 不与本构建次数混用。完整操作见 [招聘演示步骤](docs/presentation-demo.md)。

## 本地运行

开发需要 Node.js 22.19+ 和 npm。在目标 checkout 内安装锁定依赖：

```bash
npm ci --legacy-peer-deps
```

普通 Web 工作台：

```bash
npm run dev
```

访问 `http://127.0.0.1:30141`。单独运行招聘网站时，在另一个终端执行：

```bash
npm run demo:recruiting
```

招聘网站位于 `http://127.0.0.1:30143`。也可使用 Electron 同时管理两个本机服务：

```bash
npm run desktop
```

启动前检查端口。Electron 演示不复用已有服务，以免混入普通 Web 数据；已有开发服务或安装版占用端口时，先正常退出原服务。不要让两个开发进程争用同一 `.next`，也不要在运行开发服务的根目录执行 `next build`。具体规则见 [AGENTS.md](AGENTS.md)。

## 双击 App 与部署边界

`npm run package:desktop` 在独立构建暂存目录生成 `build/desktop/release/Syntropic.app`。已有安装版随包携带 Node、Electron、Chromium 和工作台运行依赖，基础启动与招聘 browser use 不要求目标电脑预装 Node 或 Chrome。模型执行仍需联网及有效授权。受控包包含专用飞书只读应用配置，不包含 Pi 模型凭据，也不依赖飞书 CLI。

当前包覆盖 macOS Apple Silicon，采用本机 ad-hoc 签名，未完成公开分发公证或其他平台验收。不能据此宣称整场演示已经在所有无开发环境电脑上可用。

招聘应用源码独立维护在 [apps/recruiting](apps/recruiting/README.md)，具备单独部署条件。云端持久化需配置相应数据库；本机文件保存不等于 Vercel 上自动持久化。本阶段不发布外网、不修改线上官网、不创建付费资源。

## 验证与资料

```bash
node_modules/.bin/tsc --noEmit
npm run test:desktop
npm run test:browser
npm run test:recruiting
```

- [Electron 开发与服务管理](docs/electron-development.md)
- [安装包构建与既有验收边界](docs/electron-packaging.md)
- [浏览器执行流程](docs/browser-phase-two.md)
- [独立招聘网站](docs/browser-phase-three.md)
- [JD 发布串联与实测记录](docs/jd-publication-demo.md)
- [下一阶段交接](docs/handoff-presentation-demo.md)

历史验收记录对应当时的构建；旧文档中的跨重启保存与计时仅供历史对照，本轮生命周期与验收以完整招聘演示文档为准。

底层工作台基于 [Pi Web](https://github.com/agegr/pi-web) 和 [Pi](https://github.com/earendil-works/pi)。原 Pi Web 的配置和工具说明保留在 [中文技术参考](README.zh-CN.md) 中；其中上游 npm 包的启动方式不是本 Syntropic 分支的交付方式。

JD 正文长度预算已在源码中加入：目标 900–1100 字符，上限 1200 字符（标题与各节纯文本合计，不含 HTML/CSS）；超限要求模型精简重写，保留关键招聘信息，不直接截断。该调整已随当前安装版验证，详见 [JD 模板与浏览器预热记录](docs/jd-template-browser-prewarm.md)。
