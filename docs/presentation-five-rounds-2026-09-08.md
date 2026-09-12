# 已安装 Syntropic 五轮端到端验收报告

测试日期：2026-09-08（Asia/Singapore）。本次独立任务按顺序执行五个全新演示运行目录，全部使用同一个已安装 App。**五轮业务流程均完整执行，但整体未达到全项 5/5 验收通过：五轮都出现顶部中央任务完成提示，不满足“通知仅在 App 右上角统一展示”。第二轮另有一次测试断言误报，保留现场、确认原因后在同一轮继续完成。** 没有以旧的 packaged-round6/7 替代本次轮次，没有在产品修复或重建后混合统计。

## 被测版本与范围

- 安装位置：`/Users/xiewannan/Applications/Syntropic.app`。
- 版本：`0.8.11`；构建 ID：`0882ec60-daf5-4f9b-b42e-5a888743cb55`；构建时间：`2026-09-08T09:18:48.805Z`。
- macOS Apple Silicon，本机签名校验通过；包内 Node `24.20.0`、Chromium `1234`。执行期间核对到了已安装 Electron、随包 Node 和随包 Chromium 进程，[运行证据](../build/verification/five-rounds-20260908-1800/runtime-process-proof.json)。
- 工作位置：`/Users/xiewannan/code/sp-demo-worktrees/electron-phase-one`，分支 `codex/electron-phase-one`，HEAD `159e1b6`。产品实现包含测试前已有的未提交改动，因此 HEAD 单独不能标识被测完整实现，以上安装包构建 ID 才是本报告的版本标识。
- 已读取该 worktree 的 AGENTS、README、完整演示说明、打包说明，记录全部 54 个已有改动文件的内容指纹。测试中未修改这些文件，未动主仓，未提交、推送、部署或重建。
- 主 Agent 和后台 JD 任务均实际使用原配置 `openai-codex/gpt-5.4-mini`；每轮发布与查询任务均实际记录为 `openai-codex/gpt-5.6-luna`。
- 启动 App 的 PATH 仅为系统目录，删除 `SYNTROPIC_NODE` 和 `ELECTRON_RUN_AS_NODE`。App 自身使用随包运行时；外部 Playwright 测试驱动不属于演示者依赖。

## 逐轮结果与耗时

单位：秒。JD 计时为发送指定指令至文件生成且后台任务停止；浏览器执行采用该任务实际 elapsedMs，包含页面操作与核对；点击/发送总时间另外包含主 Agent 准备、委派及约 1 秒轮询观察误差，不包含工具排障暂停时间。

| 轮次 | 完整结果 | JD 生成 | 浏览器发布执行 | 点击发布至完成 | 浏览器查询执行 | 发送查询至浏览器完成 | 证据 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 业务完成；通知位置失败 | 43.089 | 17.751 | 31.220 | 13.776 | 18.149 | [轮次记录](../build/verification/five-rounds-20260908-1800/packaged-round1.json) · [工具证据](../build/verification/five-rounds-20260908-1800/evidence-1-final.json) |
| 2 | 业务完成；通知位置失败；工具续跑 | 45.122 | 27.488 | 42.251 | 12.258 | 16.116 | [轮次记录](../build/verification/five-rounds-20260908-1800/packaged-round2.json) · [工具证据](../build/verification/five-rounds-20260908-1800/evidence-2-final.json) |
| 3 | 业务完成；通知位置失败 | 47.159 | 24.080 | 38.247 | 16.912 | 21.175 | [轮次记录](../build/verification/five-rounds-20260908-1800/packaged-round3.json) · [工具证据](../build/verification/five-rounds-20260908-1800/evidence-3-final.json) |
| 4 | 业务完成；通知位置失败 | 49.163 | 21.994 | 36.520 | 20.218 | 25.225 | [轮次记录](../build/verification/five-rounds-20260908-1800/packaged-round4.json) · [工具证据](../build/verification/five-rounds-20260908-1800/evidence-4-final.json) |
| 5 | 业务完成；通知位置失败 | 43.194 | 25.528 | 40.559 | 13.389 | 18.160 | [轮次记录](../build/verification/five-rounds-20260908-1800/packaged-round5.json) · [工具证据](../build/verification/five-rounds-20260908-1800/evidence-5-final.json) |

浏览器发布执行范围 17.751–27.488 秒，均值 23.368 秒；点击至完成范围 31.220–42.251 秒，均值 37.759 秒。约 30 秒仅为发布执行目标，不是点击总时间上限或未来承诺；未省略填写、提交、核对来缩短计时。

## 五轮均完成的业务链（通知布局单独未通过）

1. 正常启动全新招聘工作台：任务、JD、洞察、当前发布岗位和模拟会议均无上一轮进度。每轮对应不同运行目录、岗位 ID 和生成文件内容指纹。
2. 从 App 内飞书打开《星流科技业务介绍》列表和正文。使用包内专用应用配置读取真实飞书资料，没有调用本机飞书 CLI、个人连接器或要求重新登录。
3. 通过界面输入原定 JD 指令；真实主 Agent 委派后台任务完成 `feishu_demo_documents`、`feishu_demo_read`、`write`。各工具成功结果与工具调用 ID 相匹配，实际生成本轮 `ai-agent-engineer-jd.html`，包含星流科技、目标岗位和飞书来源。
4. 从产物库打开本轮 JD；右上角发布建议按钮经实际坐标命中测试确认无遮挡，并真实点击。主 Agent 调用 `browser_task`，Luna 在真实招聘网页填写、提交并核对，完成后返回原人才招聘窗口。测试脚本没有通过业务 API 或文件写入代替生成、发布。
5. 当前保存岗位为星流科技 / AI Agent 工程师 / Agent 研发 / 6 人 / 杭州与上海 / 负责人陈晓；30 位预设候选人均关联本轮实际岗位 ID。累计简历通过 24、进入面试 18、面试全部结束 12；面试结束且缺评价为 3。逐项点击筛选并核对行数；搜索林然得到 1 人，候选人档案可打开、关闭。
6. 通过界面输入原定统计查询，主 Agent 再次委派真实网页读取。每轮浏览器结果及主 Agent 可见汇总均为面试结束 12 人、评价未齐 3 人，草稿未被算作已提交评价。
7. 打开同岗位“面试官评价标准不一致”的完整洞察：评价已齐 9 人、存在推进判断分歧 3 人。必须在洞察报告 iframe 内点击“安排对齐会议”，按钮变为“会议已安排”，演示日程显示 Mark、TIM、陈晓，议程关联陈知远、周嘉言、沈亦辰三位同岗位候选人。
8. 刷新后岗位与会议仍在；macOS 关闭窗口、恢复窗口后本轮仍可继续；完全退出后确认该轮专属目录不存在。下一轮使用全新目录。

候选人、评价分歧和会议为明确的演示预设；会议 `simulated=true`，仅写入演示日程，没有发送真实邀请、消息或邮件。正文完整性额外比对在第二轮排障和第三至第五轮执行：忽略 HTML 转为表单文本的空白差异后全文一致；第一轮保留成功文件写入、浏览器提交核对及保存岗位正文证据，没有补称其执行过新增全文字符串断言。

## 额外回归

- 第一轮及第五轮保留后台“文件”应用的 JD 预览，同时完成洞察内安排会议。活动监听证据中后台 JD watch 已关闭，会议按钮没有被长连接队列阻塞。
- 第一轮及第五轮完成主流程后额外发起网页招聘查询，点击“停止任务”，任务进入 stopped，页面 controller 变为 shared，地址栏可以手动导航。原有另外两个页面 URL 保持不变，切到日程后不抢焦点；第五轮额外观察 8 秒。
- 五轮系统通知权限探测均返回 denied，授权对话框计数 0；五轮完整业务流程的系统通知申请计数均为 0。业务建议与洞察使用 App 内右上角通知。
- 第五轮正常退出后，额外执行第六次“仅空白开场”检查：无旧任务、JD、岗位、洞察、会议，打开空日程并正常退出，专属目录已清理。此检查不作为第六轮完整业务统计。[空白开场记录](../build/verification/five-rounds-20260908-1800/packaged-roundempty.json) · [空日程截图](../build/verification/five-rounds-20260908-1800/final-empty-schedule.png)。

## 未通过：通知没有全部统一到右上角（P2）

在五轮生成 JD 后的截图中，顶部中央均可见“任务「…」已完成”提示，同时右上角显示“AI 主动洞察：已识别新创建的 JD”及发布按钮。右上角发布按钮确实无遮挡、可点击，且无系统通知权限弹窗；但 App 内存在两个通知出口，不符合本次明确要求的统一位置。

证据：[第一轮](../build/verification/five-rounds-20260908-1800/packaged-jd1.png)、[第二轮](../build/verification/five-rounds-20260908-1800/packaged-jd2.png)、[第三轮](../build/verification/five-rounds-20260908-1800/packaged-jd3.png)、[第四轮](../build/verification/five-rounds-20260908-1800/packaged-jd4.png)、[第五轮](../build/verification/five-rounds-20260908-1800/packaged-jd5.png)；[结构化视觉复核](../build/verification/five-rounds-20260908-1800/visual-review.json)。

对应代码：`components/AgentDesktop.tsx:2108` 在任务结束时调用 `setNotice`；`:2674` 把该提示独立渲染为 `.agent-os-toast`；`components/AgentDesktop.css:419` 使用 `left:50%;top:58px;transform:translateX(-50%)`，明确定位到顶部中央。当前右上角组件只合并了发布建议与洞察，未覆盖这条任务状态提示路径。产品代码未修复，本版本未重新构建，五轮时序与截图保留为同版证据。

此问题在全部轮次结束后的逐图复核中确认，因此阶段自动化检查曾显示通过，最终验收已据此更正。`validation-summary.json` 区分 `flowComplete` 与最终 `acceptancePassed`，以免脚本阶段通过被误读为全部需求通过。

## 工具异常与排障记录

第二轮在网页发布完成后，测试新增的 `description === expected` 严格比较失败，原始日志保留 FAILED 事件和失败截图。只读比较发现预期文本 949 字符、保存文本 979 字符，去除空白后内容完全一致，差异是网页输入过程保留的空格/换行，无业务正文遗漏。因此分类为测试断言误报，不是产品缺陷。

保留当前 App、同一运行目录和已发布岗位，修正测试侧的比较口径为忽略空白；通过现有调试连接继续候选人、查询、洞察会议及生命周期步骤，没有再生成 JD 或重新发布。初始驱动随后随 App 退出结束（未完成 Promise 的退出码 13）；续跑驱动正常退出。记录：[原始中断](../build/verification/five-rounds-20260908-1800/round2-initial-attempt.json)、[只读正文比较](../build/verification/five-rounds-20260908-1800/round2-body-comparison.json)、[续跑日志](../build/verification/five-rounds-20260908-1800/round2-resume.log)。

建立续跑调试连接时，两次只读探测分别因 dynamic import 回调缺失、require 不可见失败；读取 Playwright 现有实现后启用其采用的 command-line API，成功接回同一 App。这些仅为测试工具连接探测，不是 App 重启、模型重试或业务失败。

本次五轮及最终空白开场无 Target crashed、ERR_ABORTED 等启动异常，启动重试 0 次；没有需要管理员、模型授权或其他用户介入的阻塞。产品代码改动及重建次数均为 0。

## 数据与证据

原 Pi 的 54 个受检路径（包括原本不存在的配置路径）在测试前后内容哈希/存在状态一致，覆盖受检原历史、设置与授权；没有观察到这些凭据发生刷新变化，没有恢复覆盖任何配置。[最终审计](../build/verification/five-rounds-20260908-1800/audit-current.json)。这一结论仅限受检集合，不等同于对整台机器所有文件的逐字节审计。

证据目录：`build/verification/five-rounds-20260908-1800/`（本机忽略目录，不随 App 分发）。

- `round.mjs`：从原 packaged-round.mjs 审阅后复制、增强的测试驱动；原脚本与旧 round6/7 记录未覆盖。
- `packaged-round1.json` 至 `packaged-round5.json`：阶段时间、实际浏览器任务、岗位/统计/会议、清理结果。
- `evidence-N-jd.json`、`evidence-N-query.json`、`evidence-N-final.json`：退出清理之前提取的脱敏 Agent 调用证据；保留调用名称、调用/结果匹配 ID、时间、参数指纹、成功标记、模型以及生成文件 SHA-256。未复制原会话全文、工具参数正文、App Secret 或模型凭据。
- `packaged-openingN.png`、`packaged-feishuN.png`、`packaged-jdN.png`、`packaged-insightN.png`、`packaged-meetingN.png`：各关键界面证据；第四、第五轮另有网页执行中及窗口恢复截图。
- `validation-summary.json` 与 `visual-review.json`：跨轮次自动检查和最终视觉验收；原始日志、第二轮故障现场与续跑脚本一并保留。

## 未通过或未验证项

未通过项为上述 UI-NOTIFICATION-01，五轮均复现；其余已列业务链完成。另有已解释并保留的测试工具中断。需要修复通知出口后，用新构建另行复验，不能把那次结果并入本版本五轮统计。五个样本无法证明长期成功率或网络抖动下的耗时上限。本次未重新测试另一台实体 Mac、无授权新用户、Apple 公证/公开分发、真实 token 自然到期刷新、强制崩溃或断电恢复；也未重跑普通 Web/独立招聘站持久化回归。这些不能从本次五轮正常退出测试推导为通过。
