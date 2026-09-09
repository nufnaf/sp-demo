# 预置 Key 的 OpenRouter 演示包

目标：演示者收到安装包后直接打开使用，无需登录 ChatGPT、安装 Pi 或填写 API Key。主 Agent、后台任务和浏览器统一使用 `openrouter / openai/gpt-5.6-luna`，思考强度 `low`。模型不可用时报告失败，不切换模型或弹出登录。

## 构建

在当前 worktree 的 `.env.openrouter-demo.json` 中填写：

```json
{"apiKey":"<演示专用 OpenRouter Key>"}
```

该文件被 Git 忽略。也可通过 `SYNTROPIC_OPENROUTER_CONFIG` 指定其他私有配置文件的绝对路径。Key 不通过命令行参数传入，不写进源码、构建日志或使用说明。构建时检查文件结构；不把检查成功等同于 Key 已通过在线验证。

同时准备原有 `.env.feishu-demo.json`，用于真实读取专用飞书资料。两种私有配置都只在打包组装阶段注入 App 资源，不能作为普通源码文件提交。

```bash
cd /Users/xiewannan/code/sp-demo-worktrees/openrouter-demo
npm ci --legacy-peer-deps
npm run package:desktop
```

默认构建 OpenRouter 版本；缺 Key 时在构建开始前报错。输出为 `build/desktop/release/Syntropic.app`，旁边有使用说明。源码复制到独立暂存目录后构建，不运行开发根目录的 `next build`。沿用现有 macOS Apple Silicon 打包、签名和分发方式。

如需保留原 ChatGPT OAuth 安装包，可显式运行 `SYNTROPIC_DEMO_AUTH=chatgpt npm run package:desktop`。普通 Web 和开发 Electron 默认仍走原 OAuth 配置。

## 启动和退出

- 安装包资源包含 `openrouter-demo.json`；清单声明 `demoAuth: openrouter`。缺失或损坏时显示“演示模型配置不可用”，不尝试读取个人授权。
- Electron 启动时读取随包 Key，在本轮 `presentation-runs/<id>/model-agent` 创建独立 Pi 凭据与设置，权限分别为目录 0700、文件 0600。模型固定 Luna low，忽略继承的 `OPENROUTER_API_KEY`。
- Next/Pi 的所有会话继承该独立目录；不读取或覆盖目标电脑的个人 `~/.pi/agent`。Key 不进入渲染页面或模型提示词。
- 完全退出时，原有清理流程移除本轮数据和临时凭据。安装包里的 Key 保留，下一次打开自动重新准备，无需配置。
- 预置 Key 可从安装包提取；此交付明确接受该取舍，额度限制和撤销由安装包提供者在 OpenRouter 远端控制。

## 验证边界

本分支已 rebase 到 `origin/dev` 的 `3ca34ec`，保留 standalone 依赖裁剪、Chromium Headless Shell、只读运行文件链接和旧运行目录清理。Rebase 后 TypeScript、修改文件 ESLint，以及 22 项桌面／包体裁剪／模型生命周期测试通过；安装依赖后顺序运行的浏览器启动、视口与集成测试另有 4 项通过。

自动测试覆盖：无个人授权的新目录、Luna 模型及 low 强度、主/后台会话初始化、浏览器任务模型选择、退出清理、重启恢复、无效 Key 配置不泄露内容。测试使用占位 Key，不发送模型请求。

2026-09-09 已使用实际限额 Key 构建并替换 `/Users/xiewannan/Applications/Syntropic.app`。构建 ID 为 `18b0bc92-3fef-4e83-8a4b-ae546eafb22e`，时间 `2026-09-09T13:24:32.500Z`。本机测试使用全新演示目录，凭据只有 OpenRouter；真实读取飞书、生成 JD、网页发布、查询均完成，实际会话与浏览器均为 `openrouter / openai/gpt-5.6-luna`、low。

安装包仍采用现有 macOS Apple Silicon ad-hoc 签名方式，未做 Apple Developer ID 签名或公证；其他 Mac 的 Gatekeeper 行为尚未实测。免模型登录已验证，不代表消除了 macOS 对网络下载 App 的首次打开确认。

## 两轮安装版耗时（2026-09-09 21:33–21:37，UTC+8）

两轮均从完全退出后的干净开场开始，使用相同完整中文请求：

> 读取团队资料，帮我生成 AI Agent 工程师岗位的 JD，保存为成果，先不要发布。

生成后点击成果通知中的“发布岗位”，发布完成后发送：

> 帮我看看 AI Agent 工程师岗位，面试结束了多少人，还有几人的评价没齐？

单位为秒。起点记录原生界面的发送／点击，JD 终点取实际保存工具返回，发布和查询终点取浏览器提交核对结果。排除人工审阅与两次请求间的等待；不含 App 启动。原生操作记录了调用前后时间，发送误差小于 0.03 秒，第二轮发布点击的自动化调用耗时 0.622 秒，表中从调用前计时。

| 阶段 | OpenRouter 第 1 轮 | OpenRouter 第 2 轮 | 历史 OAuth 第 1 轮 | 历史 OAuth 第 2 轮 |
| --- | ---: | ---: | ---: | ---: |
| JD 发送至保存 | 19.001 | 13.047 | 23.903 | 27.071 |
| 其中主 Agent 派发 | 8.077 | 3.926 | 4.599 | 5.190 |
| 飞书正文返回至保存调用 | 6.936 | 6.643 | 12.720 | 15.002 |
| 发布交接至浏览器任务启动 | 2.335 | 3.943 | 5.428 | 5.152 |
| 发布的浏览器执行 | 13.019 | 11.868 | 22.692 | 24.835 |
| 点击发布至核对完成 | 15.354 | 15.811 | 28.120 | 29.987 |
| 查询的浏览器执行 | 8.035 | 8.336 | 26.139 | 15.489 |
| 查询发送至核对完成 | 10.581 | 11.081 | 29.785 | 19.394 |

本次查询的主 Agent 最终文字回复分别在发送后 12.449 / 12.330 秒落盘，比浏览器核对终点晚约 1–2 秒。历史表没有同口径的最终回复时间，因此未把两种终点混在比较表里。浏览器预启动分别为 0.373 / 0.352 秒，发生在发送任务前，不计入任务耗时。

两轮 OpenRouter 的 JD／发布／查询均值为 16.024 / 15.583 / 10.831 秒；历史 OAuth 为 25.487 / 29.054 / 24.590 秒。本次样本没有显示变慢，但这是历史对照，不是同期受控 A/B。OAuth 数据来自 [此前提示词精简后的最终两轮](prompt-length-audit.md)，模型同为 Luna low；请求措辞、生成内容、缓存和网络时段并非完全一致，不能将差异全部归因于 OpenRouter 或承诺稳定速度。旧 JD 提取全文为 840 / 1026 字符，本次为 795 / 778 字符。

两轮均真实读取飞书、生成新 HTML、发布全文并核验一致，岗位为 AI Agent 工程师、招聘目标 6 人；查询正确得到面试结束 12 人、评价未齐 3 人。发布分别为 3 步／3 轮模型响应、3 步／4 轮；查询均为 1 步／2 轮。实际会话没有模型错误或降级。

刷新保留任务、成果与岗位；完全退出分别清理两轮目录及临时凭据。受检个人 `auth.json`、`settings.json`、`models.json`、`agents/settings.json` 哈希及存在状态未变。安装版运行链接指向当前 App，签名复核通过。安装目录 `du -sk` 为 850336 KiB（约 871 MB），原安装版为 850332 KiB，增加 4 KiB。

证据位于 `build/verification/openrouter/round-1` 和 `round-2`，包含原始会话、浏览器阶段与用量、界面操作时间、全文一致性和清理审计。此前构建目录启动的功能预试浏览器发布／查询为 11.126 / 6.669 秒，但输入曾被原生键盘工具截掉中文，因此不计入以上两轮。安装版改用粘贴并核实完整请求。

交付压缩包：`build/desktop/release/Syntropic-OpenRouter-macOS-arm64.zip`，335961116 字节（约 336 MB）；重新解压后的签名验证通过。SHA-256：`02697c9a7129050a20e8f542d26adb7d3ad68a6d4048304d940486f632fadab4`。解压得到 App，演示者需要联网，无需填写模型 Key 或登录 ChatGPT。开发与验收使用 `codex/openrouter-demo` worktree；私有配置、原始验证数据和交付压缩包仅保存在本地，不进入 Git。
