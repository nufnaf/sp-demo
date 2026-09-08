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

已有的发布串联是：查看 JD 成果 → 点击发布建议 → 主 Agent 委派浏览器填写新招聘网站 → 保存核对 → 原“人才招聘”窗口展示已发布岗位卡片。新岗位尚未合入旧窗口的候选人管线；卡片可打开新网站详情。不能把这段串联成功等同于整场招聘演示已经验收。

## 下一阶段：可重复的预设演示

目标是保留静态原型的成熟演示体验，并在指定环节嵌入真实 Agent 与 browser use。无需将所有模拟环节改造成真实业务系统。

1. 启动 App 即有“招聘工作台”、对应 Dock 应用、业务介绍资料和自洽的招聘预设，不要求演示者每次手动配置。
2. 保持完整叙事：业务资料 → 生成 JD → 原有风格的发布建议 → 真实网页发布 → 招聘结果 → 招聘管线与面试标准偏差洞察 → 对齐会议。后半段允许沿用模拟展示，但岗位、人数和资料衔接应清楚。
3. 一次运行内保存有效，刷新不丢失当前进度；**完全退出 App 后，下一次启动恢复预设状态**，不带入上一轮任务、生成成果、洞察和招聘修改。这是新的演示要求，取代安装版原先跨重启保留本轮招聘修改的行为。
4. 重置只影响专属演示数据。模型配置、授权、原有 Pi 会话、用户文件和其他工作台不属于清理范围。普通 Web 与独立招聘网站仍需有明确、可独立使用的持久化边界。

此目标仅作为下一阶段需求，尚未实施。此前提前加入的演示预设、数据隔离与退出恢复代码已撤回；新 session 应先与用户确定方案，再开发。这不影响已有的 JD 发布、真实 browser use 和原招聘窗口结果展示。

需要一起核对的已知问题：安装版的运行路径找不到本机飞书 CLI；浏览器任务委派条件过宽，可能影响“飞书资料生成 JD”；新增发布通知与原通用洞察通知没有统一展示；发布后的完整演示衔接尚待验证。飞书运行依赖如何分发仍需确定，不能只以本机开发环境可用作为验收依据。

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

启动前检查端口，复用健康的同一 checkout 服务；不同 checkout 或安装版占用端口时，先正常退出原服务。不要让两个开发进程争用同一 `.next`，也不要在运行开发服务的根目录执行 `next build`。具体规则见 [AGENTS.md](AGENTS.md)。

## 双击 App 与部署边界

`npm run package:desktop` 在独立构建暂存目录生成 `build/desktop/release/Syntropic.app`。已有安装版随包携带 Node、Electron、Chromium 和工作台运行依赖，基础启动与招聘 browser use 不要求目标电脑预装 Node 或 Chrome。模型执行仍需联网及有效授权，飞书等应用也有自己的运行依赖与授权条件。

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

历史验收记录对应当时的构建，尤其是数据目录、跨重启保存行为和计时；下一阶段的预设重置功能仍待方案对齐、实施与验收。

底层工作台基于 [Pi Web](https://github.com/agegr/pi-web) 和 [Pi](https://github.com/earendil-works/pi)。原 Pi Web 的配置和工具说明保留在 [中文技术参考](README.zh-CN.md) 中；其中上游 npm 包的启动方式不是本 Syntropic 分支的交付方式。
