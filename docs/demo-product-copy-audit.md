# Demo App 观众文案排查与调整

日期：2026-09-11。初始排查基于 `942b435`，合入前已同步至 `origin/dev` 的 `2f74652`；工作分支 `codex/demo-product-copy`。

目标：观众已知演示含 mock，产品界面使用业务语言，避免用实现说明打断体验。数据来源和模拟性质仍保留在开发文档及内部记录中。

长期要求已写入根目录 [AGENTS.md](../AGENTS.md) 的“Demo App 的产品表达原则”，适用于后续新增功能、文案与生成内容。

## 修改清单

| 展示位置 | 原文或问题 | 调整 | 来源 |
| --- | --- | --- | --- |
| JD 发布建议、桌面通知、AI 洞察列表 | 同步生成 BOSS 直聘的模拟发布结果 | 可以发布到内部招聘系统和 BOSS 直聘 | `components/RecruitingPublication.tsx` |
| 岗位发布成功提示、洞察完成态 | 内部招聘系统和 BOSS 直聘（模拟） | 内部招聘系统和 BOSS 直聘 | `lib/recruiting-publication.ts`，由桌面和发布组件共用 |
| 任务完成摘要、聊天回复 | 已同步生成 BOSS 直聘的模拟发布结果 | 已同步发布到 BOSS 直聘 | `lib/presentation-tasks.ts` |
| 招聘岗位卡片 | BOSS 直聘 · 已发布（模拟） | BOSS 直聘 · 已发布 | `components/HRRecruitingApp.tsx` |
| 招聘应用连接页 | 演示预设、本轮演示未接入、本轮未接入 | 招聘账号已连接、该应用暂不可用、暂不可用 | `components/HRRecruitingApp.tsx` |
| BOSS 窗口 | 演示预设、模拟发布结果、页尾演示说明 | 删除预设标签和页尾说明；时间标为发布时间 | `components/BossDemoApp.tsx`、对应 CSS |
| 启动时日程加载 | 正在恢复演示日程、两个预设会议 | 正在同步团队日程、正在同步飞书日历 | `electron/prepare-presentation.mjs` |
| 启动和模型配置错误 | 演示模型、演示配置、预置 Key、重新打包说明 | 模型服务配置或授权不可用，提示联系管理员 | `electron/main.mjs`、`electron/demo-model.mjs`、`lib/browser/tasks.ts` |
| 退出异常 | 保留演示目录等进程实现说明 | 后台进程未结束，工作数据已保留 | `electron/process-tree.mjs` |
| 日程同步和授权错误 | 演示日程初始化、专用演示日历、未重置演示日程 | 团队日历配置、日程同步和可重试的错误提示 | `app/api/desktop/prepare/route.ts`、`lib/feishu-demo-client.ts`、`lib/feishu-calendar-reset.ts`、`lib/feishu-calendar.ts` |
| 日程详情 | 会议说明出现 `[Syntropic 演示日程]` | 仅在展示时过滤独占一行的内部标记；正文和原始数据保留 | `components/PresentationSchedule.tsx`、`lib/feishu-demo-calendar-marker.ts` |
| 招聘网页错误、岗位核验错误 | 演示地址无效、未找到本轮演示的岗位 | 招聘工作台地址无效、未找到当前工作台的已发布岗位 | `apps/recruiting/src/handler.mjs`、`lib/recruiting-snapshot.ts` |
| JD 请求错误、其他工作台回复 | 固定业务流程、查看预置资料和成果 | 操作入口提示、查看资料和成果、切换招聘工作台 | `lib/recruiting-jd-demo.ts`、`lib/rpc-manager.ts` |
| 聊天消息署名 | `fixed-jd` | Syntropic；原 provider/model 继续保存在消息中 | `components/MessageView.tsx` |
| 招聘分析报告 | 预设偏好指数 | 评价偏好指数 | `lib/company-careers-insight-html.ts` |
| CRM 连接页面 | 真实 API · 免密连接、通过真实 API 同步 | 免密连接、同步客户订单与跟进 | `components/SalesCRMApp.tsx` |
| CRM 报告跟进说明 | 正常洞察流程、不预设必然回款、不虚构天数 | 结合验收进展、付款安排与实际到账情况更新判断 | `lib/company-crm-demo-report.ts` |

## 排查范围与保留项

- 检索 `components`、`lib`、`app`、`apps/recruiting/src`、`electron`、`public`，核对模拟、演示、预设、预置、固定内容及 mock/demo/simulated 等命中项的使用位置。
- 检查招聘、BOSS、飞书资料、日程、CRM、投资工作台、JD 与报告模板、通知、任务回复、启动与异常提示。投资和飞书资料组件没有发现新增需要修改的同类硬编码文案。
- 正常业务用语继续保留，包括草稿尚未发送、连接失败、暂无数据、下载格式示例、统计口径和分析限制。投资材料中的“客户测试样片”是业务内容。
- `bossPublication.mode`、`simulated`、`syntropic-demo`、内部事件类型、代码/样例文件名、工具详情、开发文档和运行目录的 `AGENTS.md` 保留真实用途。高级技术查看界面仍可检查原始记录。
- 日程清理继续依赖原有 marker，不修改飞书原始描述；外部飞书客户端查看该描述时仍可能看到 marker。App 内的日程详情已过滤。
- 内部招聘仍通过真实浏览器填表、提交和核验；BOSS 仍使用本地模拟回执。没有新增外部发布、消息或邀请，也没有把失败/取消改为成功。
- 已保存的旧任务摘要和旧 HTML 报告不会重写；新运行生成新的文案。岗位完成态和日程展示从当前代码渲染，刷新后使用新表述。

## 验证

- TypeScript 全量类型检查通过。
- 修改的 TypeScript/TSX/MJS 文件和新增日程测试通过 ESLint；`git diff --check` 通过。
- 合入前在最新基线上复跑，80 项相关测试全部通过：JD 生成与停止、发布建议与完成态、失败/取消/最终核验失败、重复发布、刷新恢复、日程读取/创建/重置、消息署名、报告生成和模型配置等。
- 新增日程渲染测试确认内部标记不出现在页面，标记之外的正文与跳转保留，仅有标记时不留下空“会议说明”；原始描述仍可用于清理。
- 浏览器使用当前组件渲染的隔离测试数据检查 BOSS 空状态、BOSS 发布完成态和日程详情，并查看截图。BOSS 显示账号、岗位和发布时间，日程保留完整业务说明。
- React 复核：本次显示处理直接由现有数据派生，没有增加 effect、状态、副作用或网络请求。

本次没有运行模型驱动的真实网页发布，也没有重新打包或替换已安装 App。浏览器检查属于组件渲染验收；发布流程由既有行为测试验证。
