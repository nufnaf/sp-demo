# 通知修复版：安装 App 五轮端到端验收报告

2026-09-08，Asia/Singapore。**恢复测试后从干净启动执行的五轮（1-retry1、2、3、4、5）全部完成，自动断言、人工截图复核和数据审计均通过，结果为 5/5。** 先前同版首次尝试 `1` 的主模型连接失败永久保留，不计为通过；主任务的定向诊断重试也不计数。旧构建 `0882ec60...` 的通知布局失败结论保持不变。

## 实际版本与环境

- 安装位置：`/Users/xiewannan/Applications/Syntropic.app`。
- 构建 ID：`1e30a611-bf3d-4b3d-b2a3-bf38c6df2427`；builtAt：`2026-09-08T11:32:55.215Z`；版本 `0.8.11`；包内 Node `24.20.0`，Chromium `1234`，macOS Apple Silicon。
- 固定工作位置：`/Users/xiewannan/code/sp-demo-worktrees/electron-phase-one`，分支 `codex/electron-phase-one`，HEAD `159e1b6` 加冻结的现有改动。HEAD 不足以单独标识完整产品，被测身份以安装包构建 ID 为准。
- 每次启动前校验构建 ID、worktree、分支、30141/30143 端口；不抢占端口、不复用其他服务、不改产品或安装包。
- App 启动环境 PATH 仅含系统目录，移除 `SYNTROPIC_NODE`、`ELECTRON_RUN_AS_NODE`；App 使用随包运行时。主模型保持实际 `openai-codex/gpt-5.4-mini`，浏览器发布与查询任务固定实际 `openai-codex/gpt-5.6-luna`，均有每轮证据。

## 逐轮结果与时间

单位：秒。JD 为发送指定原指令至实际文件生成且后台任务结束的观察耗时；浏览器执行为运行时 elapsedMs；点击/发送总时间包含主 Agent 准备委派、页面操作和测试观察开销。额外通知竞争 JD 单列，不计入主 JD、发布或查询耗时。

| 逻辑轮次（证据标签） | 全项结果 | 主 JD 生成 | 发布浏览器执行 | 点击发布至完成 | 查询浏览器执行 | 发送查询至完成 | 额外竞争 JD | 证据 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1（1-retry1） | 通过 | 42.309 | 19.365 | 32.772 | 12.424 | 16.267 | 50.528 | [记录](../build/verification/notification-retest-20260908/runs/1e30a611-bf3d-4b3d-b2a3-bf38c6df2427/1-retry1/packaged-round1-retry1.json) · [视觉复核](../build/verification/notification-retest-20260908/runs/1e30a611-bf3d-4b3d-b2a3-bf38c6df2427/1-retry1/visual-review.json) |
| 2（2） | 通过 | 56.441 | 24.878 | 40.829 | 23.277 | 28.447 | — | [记录](../build/verification/notification-retest-20260908/runs/1e30a611-bf3d-4b3d-b2a3-bf38c6df2427/2/packaged-round2.json) · [视觉复核](../build/verification/notification-retest-20260908/runs/1e30a611-bf3d-4b3d-b2a3-bf38c6df2427/2/visual-review.json) |
| 3（3） | 通过 | 45.334 | 26.335 | 42.714 | 15.592 | 20.363 | — | [记录](../build/verification/notification-retest-20260908/runs/1e30a611-bf3d-4b3d-b2a3-bf38c6df2427/3/packaged-round3.json) · [视觉复核](../build/verification/notification-retest-20260908/runs/1e30a611-bf3d-4b3d-b2a3-bf38c6df2427/3/visual-review.json) |
| 4（4） | 通过 | 48.412 | 22.636 | 38.783 | 15.167 | 19.299 | — | [记录](../build/verification/notification-retest-20260908/runs/1e30a611-bf3d-4b3d-b2a3-bf38c6df2427/4/packaged-round4.json) · [视觉复核](../build/verification/notification-retest-20260908/runs/1e30a611-bf3d-4b3d-b2a3-bf38c6df2427/4/visual-review.json) |
| 5（5） | 通过 | 47.364 | 24.044 | 38.691 | 11.964 | 16.266 | 46.499 | [记录](../build/verification/notification-retest-20260908/runs/1e30a611-bf3d-4b3d-b2a3-bf38c6df2427/5/packaged-round5.json) · [视觉复核](../build/verification/notification-retest-20260908/runs/1e30a611-bf3d-4b3d-b2a3-bf38c6df2427/5/visual-review.json) |

发布浏览器执行为 19.365–26.335 秒，均值 23.452 秒；点击发布至完成为 32.772–42.714 秒，均值 38.758 秒。约 30 秒是发布执行目标，不是点击总时间上限。没有省略填写、提交或核对，也未将首次连接失败和诊断的时间藏入成功轮次。

## 每轮完整验收链

五轮均按实际 App 界面执行：干净招聘工作台 → 飞书列表和《星流科技业务介绍》正文 → 原定 JD 指令 → 真实读取、生成本轮 `ai-agent-engineer-jd.html` → 产物库打开 → 右上角发布建议及实际点击 → Luna 真正填表、提交和核对 → 返回原人才招聘窗口 → 30 位同岗位候选人 → 累计筛选 24/18/12、结束且缺评价 3 → 林然搜索及档案 → 原定查询指令，真实网页读取并汇总 12/3 → 完整洞察报告内点击安排对齐会议 → 演示日程 → 刷新保留 → macOS 关闭窗口及恢复保留 → 完全退出并清理本轮目录。

每轮均保存成功的 `feishu_demo_documents`、`feishu_demo_read`、`write`、`browser_task` 调用/结果匹配 ID 与模型记录；生成文件保留 SHA-256、大小和来源标记。发布后的完整 JD 与生成文件转成表单文本后的内容一致（忽略纯空白差异）。测试脚本未用业务 API、脚本写入或预置文件代替 JD 生成和网页发布。

一致性：星流科技 / AI Agent 工程师 / Agent 研发 / 6 人 / 杭州与上海 / 陈晓；30 位候选人均关联本轮真实保存的岗位 ID。评价已齐 9 人、推进判断分歧 3 人，日程包含 Mark、TIM、陈晓，议程讨论同岗位陈知远、周嘉言、沈亦辰。候选人、评价和会议属于明确的演示预设，会议 `simulated=true`，没有发送真实邀请、消息或邮件。

## 通知修复的实际验证

1. 所有业务阶段通过 DOM 变化观察、50ms 实际布局采样和阶段同步断言检查：最多一个 `data-testid=desktop-notification` 浮层，完全没有 `.agent-os-toast`。可见矩形确实位于视口右上角并完整在屏内；容差覆盖入场动画和按压缩放，不以 CSS 类名作为位置证明。
2. 五轮主 JD 完成时，都验证同一张发布建议卡片同时包含真实“任务…已完成”信息，发布按钮启用、实际中心点命中且真实点击。没有旧版顶部中央的第二条提示。
3. 第一、第五轮额外让真实 Agent 再读取飞书，生成不同文件名 `ai-agent-engineer-jd-notification-check.html`。原 JD 内容指纹保持不变，未二次发布。保留实际待读洞察的状态，打开额外 JD 后确认发布建议优先；通过界面关闭建议后，原洞察重新出现且按钮可命中，未被悄悄标为已读。竞争检查只读取通知存储，未注入状态或修改业务数据。
4. 第一、第五轮均保留后台“文件”应用的主 JD 预览，再完成洞察内的会议按钮操作；活动监听中后台 JD watch 已关闭，按钮未受长连接阻塞。
5. 第一、第五轮额外发起招聘网页查询并点击“停止任务”，状态 stopped、controller shared；可通过地址栏手动导航，另外两个旧页面未改变，切到演示日程后观察 8 秒不抢焦点。
6. 五轮系统通知权限探测均 denied、对话框 0；业务自身系统通知申请 0。每轮关键通知截图和会议截图已人工检查，第一、第五轮另检查两张竞争截图。各 `visual-review.json` 明确列出被检查文件及其指纹，不声称人工看过每一帧。

## 失败尝试与诊断边界

同一新构建的首次尝试 `1` 在主模型开始输出前先遇 WebSocket 连接失败，再出现 SSE `fetch failed`，没有生成 JD。该失败记录不覆盖、不转为成功；原始失败及无凭据连接检查见[下方历史诊断](#首次失败与恢复诊断历史记录)。

主任务随后对相同包内模型做有界真实最小请求以及保留 App 的 UI JD 重试，两者恢复成功；未改变模型、登录、代理或产品代码。历史 SSE 错误未保留底层 cause，因此不能确证具体断连来源，也不宣称授权或代理一定有问题。诊断任务结束后正常退出，确认目录清理和端口释放，才开始本报告的 `1-retry1`。

测试驱动仅修正了重试标签到逻辑轮次的映射，确保 `1-retry1` 不会漏掉第一轮竞争/停止检查，并增加再次 `fetch failed` 时保留现场的检测。恢复后的五轮没有再次出现该错误，没有 Target crashed、ERR_ABORTED 等工具启动异常，也没有产品修改后的混合重跑。不能据五个成功样本保证长期可用率或断连已被永久解决。

## 数据审计与最终状态

每轮相对自身启动前基线复查原 Pi 54 个受检路径的内容哈希/存在状态，以及当时已有的 57 个改动文件，均无变化；未恢复覆盖任何授权或配置。受检集合包括原历史、设置与授权，并非整台机器的逐字节审计。

第五轮退出后另开一次空白工作台，检查没有旧任务、JD、洞察、发布岗位和会议，打开空日程后正常退出。该仅开场检查不计作第六轮业务流程。[最终空白开场](../build/verification/notification-retest-20260908/runs/1e30a611-bf3d-4b3d-b2a3-bf38c6df2427/empty/packaged-roundempty.json) · [截图](../build/verification/notification-retest-20260908/runs/1e30a611-bf3d-4b3d-b2a3-bf38c6df2427/empty/final-empty-schedule.png)。

本次没有提交、推送、部署、替换安装包或改产品。测试证据独立新增，本报告补充最终结果并保留首次失败与恢复诊断；旧构建报告不变。

最终核对五轮及空白开场的运行目录均不存在，30141/30143 端口空闲，安装 App 进程为零；已知凭据值的证据字节扫描无匹配。详见[退出与证据审计](../build/verification/notification-retest-20260908/runs/1e30a611-bf3d-4b3d-b2a3-bf38c6df2427/final-audit.json)。该扫描不代表对截图做过 OCR 或能识别所有未知敏感数据。

## 证据索引与未验证项

根目录：`build/verification/notification-retest-20260908/runs/1e30a611-bf3d-4b3d-b2a3-bf38c6df2427/`。

- `1/`：最初模型连接失败，排除于成功五轮。
- `1-retry1/`、`2/`、`3/`、`4/`、`5/`：各轮阶段记录、脱敏 Agent 证据、通知观察、截图、人工复核与数据审计。
- `validation-summary.json`：分别保留失败尝试和完成轮次，`automaticPassed`、`manualReviewPassed`、`acceptancePassed` 独立判定；不存在沿用旧 finding 强制设置失败或仅凭代码类名设置成功的后处理。
- `empty/`：最终空白开场及退出清理记录。

没有待用户介入的当前阻塞。未重新验证另一台实体 Mac、全新未授权用户、公开分发/公证、真实 token 自然到期、强制崩溃与断电恢复、普通 Web 和独立招聘站持久化。上述范围及长期网络稳定性不能从本次正常五轮测试推导为通过。


## 首次失败与恢复诊断（历史记录）

以下保留最初暂停时和恢复诊断时的原始报告。其中“当前”“未完成”“0 轮”等均指当时状态；最终验收结论以上方五轮结果为准。

## 新通知版本独立五轮验收：首次失败与恢复诊断

**状态：未完成五轮，新增通过轮次 0。** 第一轮在主模型首次请求阶段出现连续 `fetch failed`；尚未生成 JD 或进入发布。按主任务指示保留 App 和本轮目录，暂停后续步骤与轮次，没有自动重发模型请求。旧版报告仍保持失败结论，不纳入本次计数。

### 被测版本与已完成步骤

- 已安装 `/Users/xiewannan/Applications/Syntropic.app`，构建 ID `1e30a611-bf3d-4b3d-b2a3-bf38c6df2427`，builtAt `2026-09-08T11:32:55.215Z`。
- 固定既有 worktree `/Users/xiewannan/code/sp-demo-worktrees/electron-phase-one`、分支 `codex/electron-phase-one`。没有修改产品、安装包、模型、凭据、代理或网络配置。
- App 首次展开新构建运行副本后正常进入干净工作台；初始任务、JD、岗位、洞察与会议为空。
- App 内飞书实际读取《星流科技业务介绍》列表和正文成功。
- 系统通知权限探测 denied、零对话框；截至失败阶段未见 `.agent-os-toast`、双通知浮层或右上角几何越界。
- 已通过界面发送原定 JD 指令；会话没有进入 `start_task`，没有真实 JD 文件产生。任务完成与发布建议竞争、待读洞察竞争、浏览器发布查询、会议与生命周期整轮验收均尚未执行，不能认定通过。

### 模型错误与只读诊断

四条已保存的主模型错误（UTC）：11:35:46.243、11:35:53.273、11:36:02.305、11:36:15.430，均只有 `errorMessage: "fetch failed"`。当前无运行中的 Agent。测试驱动只读等待到 11:39:36 UTC 后记录 `JD generation timeout` 并进入保留现场状态；这不是一次新的模型请求，不能解读为 JD 正常生成但单纯较慢。未发现明确的 HTTP 401/403、授权过期、DNS 错误码、证书错误或更底层 cause，因此不能据此认定模型授权失效或特定网络组件故障。

SDK 默认模型服务为 `chatgpt.com/backend-api/codex/responses`，没有自定义 models.json 覆盖；设置仍为 `openai-codex/gpt-5.4-mini`。采用包内 Node 24.20.0 对该域名做有界、无认证、无模型请求体的连接检查：

| 检查 | 结果 | 耗时 |
| --- | --- | ---: |
| DNS lookup | 成功，解析为 198.18.0.22 | 8ms |
| TLS 连接 | 成功，证书校验通过，TLSv1.3 | 545ms |
| 实际 endpoint 的无凭据 GET | HTTP 405 | 946ms |

HTTP 405 是不支持此 GET 方法的响应，证明检查时网络路径能返回 HTTP；不证明有凭据的模型 POST 或流式响应正常，也不是一次模型请求重试。检查进程未设置 HTTP_PROXY / HTTPS_PROXY / ALL_PROXY 等环境变量；macOS 系统代理为本地 127.0.0.1:1082。DNS/代理状态只作为现场事实记录，没有证据将它们与先前失败建立因果关系。

**诊断结论：失败位于主模型请求阶段，暂未定位根因。** 当前 DNS、TLS 和无凭据 HTTP 可达，与先前错误并存；可能存在时点差异或仅真实请求触发的问题，但未验证。不能把它直接判定为通知修复的产品代码回归，也不能宣称已排除产品侧问题。

首次暂停时没有已确认、必须由用户执行的具体修复动作，不应仅凭上述证据改代理、换模型或重新登录。原失败尝试永久保留，之后的重试使用不同证据标签，不覆盖、不计作既有通过轮次。

### 12:02–12:04 UTC：实际请求恢复诊断

用户追问原因后，主任务补查原始会话：首次请求先记录 WebSocket 连接错误，随后切到 SSE 并报 `fetch failed`；错误发生在模型开始输出之前。原始 SSE 错误未保存底层 cause，历史证据不足以归因到某个代理组件、DNS、证书或远端服务。

没有更改产品、模型、代理、网络或登录状态，进行了两个有界的真实请求对照：

- 使用安装包 Node 24.20.0 和包内 ModelRuntime，对原主模型 `openai-codex/gpt-5.4-mini` 请求仅返回 OK；3.414 秒正常结束。
- 在保留的原 App 进程中临时订阅仅记录模型域名请求状态和错误代码的诊断事件，经原聊天界面重试 JD。模型 POST 返回 HTTP 200，`start_task`、真实飞书列表与正文读取、`write` 和回读均成功；生成 6,844 字节 JD，任务正常结束。该诊断不发布岗位，不算五轮验收中的通过轮次。

HTTP 200 之后观察到的两个 AbortError 与对应消息的正常 `toolUse` / `stop` 终止时间一致，是本次流关闭事件，不能当作原 `fetch failed` 的根因。临时监听与本地调试端口已关闭，未修改运行包；原 Pi 基线 54 个文件哈希全部一致，包括授权与模型配置。

**当前判断：原模型连接故障已无法复现，真实 JD 链路已恢复；短暂传输故障更符合现有证据，但具体断连来源尚未确证。** 通知修复的完整五轮验收仍须从干净启动重新完成，不能用此次诊断成功替代。重新失败时需要在同一失败进程及时抓取连接 cause，不能仅重复无凭据 GET 检查。

补充证据位于 `build/verification/notification-retest-20260908/`：`actual-model-diagnostic.json`、`app-network-events.json`、`app-model-retry-evidence.json`、`app-model-retry.png`。所有文件只保存诊断结果、工具名称和成果哈希，不保存请求头、凭据或原始模型请求体。

### 证据与脚本

目录：`build/verification/notification-retest-20260908/runs/1e30a611-bf3d-4b3d-b2a3-bf38c6df2427/1/`。

- [阶段日志](../build/verification/notification-retest-20260908/runs/1e30a611-bf3d-4b3d-b2a3-bf38c6df2427/1/packaged-round1.json)
- [模型错误](../build/verification/notification-retest-20260908/runs/1e30a611-bf3d-4b3d-b2a3-bf38c6df2427/1/model-errors.json)
- [有界网络诊断](../build/verification/notification-retest-20260908/runs/1e30a611-bf3d-4b3d-b2a3-bf38c6df2427/1/network-diagnostic.json)
- [保留的界面](../build/verification/notification-retest-20260908/runs/1e30a611-bf3d-4b3d-b2a3-bf38c6df2427/1/model-fetch-failure.png)
- [通知实际布局观测](../build/verification/notification-retest-20260908/runs/1e30a611-bf3d-4b3d-b2a3-bf38c6df2427/1/notification-observations.json)
- [暂停时数据审计](../build/verification/notification-retest-20260908/runs/1e30a611-bf3d-4b3d-b2a3-bf38c6df2427/1/paused-audit.json)

新驱动位于 `build/verification/notification-retest-20260908/round.mjs`，配套 `notification-monitor.mjs`、`preflight.mjs`、`validate.mjs` 与空白开场脚本。已完成静态语法检查；实际未执行的断言保持未验证。没有沿用旧版强制设置验收失败的后处理；新判定要求完整流程、几何与竞争断言以及独立截图复核共同通过。
