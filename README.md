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
- **模型边界**：浏览器执行固定 `openai-codex / gpt-5.6-luna`，主 Agent 保留原配置。不得用业务 API、数据文件写入或预设动画代替约定的浏览器操作。

## 可重复的招聘演示

Electron 开场直接进入招聘工作台，固定飞书、人才招聘、成果、浏览器与演示日程入口。公司统一为星流科技：AI Agent 工程师，Agent 研发，6 人，杭州 / 上海。

飞书列表与正文由专用只读应用直连官方 API；管理员预先配置凭据与资料阅读权限。演示者无需飞书 CLI 或扫码，配置见 [飞书准备说明](docs/feishu-demo-setup.md)。本轮 JD 仍由真实 Agent 根据实际读取的资料生成。

查看 JD 后，统一右上角通知优先展示“发布岗位”，其他洞察排队。点击后真实浏览器填写、提交与核对；同一真实岗位随后关联 30 位预设候选人。网页和原招聘窗口共享候选人、评价与统计，查询使用真实 browser use。标准偏差洞察与对齐会议是模拟场景，不发送邀请。

一次运行内刷新保留进度；macOS 关闭窗口仍属于同一次运行。完全退出后，下次启动创建全新的专用演示目录，不恢复上轮任务、JD、洞察、发布或候选人修改。退出先停止本 App 的后台进程再删除本轮目录；极端异常遗留目录不加载，也不冒险删除未知仍在写入的数据。原 Pi 历史、模型设置、授权和用户文件不在清理范围。普通 Web 与独立招聘网站继续原有持久化。

通知修复后的安装包 `1e30a611-bf3d-4b3d-b2a3-bf38c6df2427` 已完成从干净启动执行的五轮完整验收，均通过，另已核对最后一次启动没有上轮残留。发布浏览器实际执行 19.365–26.335 秒，点击至完成 32.772–42.714 秒；不承诺严格时间上限。详见 [当前五轮验收报告](docs/presentation-notification-retest-2026-09-08.md)。原版通知布局失败及新包首次模型连接失败均保留，不计入本次通过轮次；历史断连的具体来源未确证。完整步骤与版本边界见 [完整招聘演示](docs/presentation-demo.md)。

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
