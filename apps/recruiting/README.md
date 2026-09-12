# NovaFlow 内部招聘 Demo

星流科技 HR 与面试官使用的独立招聘网页。使用星流科技独立的蓝白品牌与浅灰内容布局，支持浅色、深色和跟随系统。星流科技是使用 Syntropic 的客户企业。本应用自行实现内部工作台，不连接或修改外部招聘官网。

初始 5 个职位、62 位候选人和全部评价均为虚构。查询、筛选、详情、评价草稿与提交、通过／失败、发布职位、职位设置和重置通过真实 HTML 链接与表单执行。无需登录；页面身份为陈晓（招聘负责人）。无邮件、通知或真实招聘连接器。仅向 Syntropic 原生窗口提供只读发布结果投影，Agent 的业务操作仍走网页。

## 本地运行

需要 Node.js 22 或以上。本地文件模式不依赖安装额外包：

```bash
cd /Users/xiewannan/code/sp-demo-worktrees/electron-phase-one
npm run demo:recruiting
```

独立运行等价于：

```bash
cd /Users/xiewannan/code/sp-demo-worktrees/electron-phase-one/apps/recruiting
npm start
```

访问 **http://127.0.0.1:30143**。30142 保留给第二阶段测试站。端口占用时先核对已启动的服务，不抢占其他进程。`Ctrl+C` 停止招聘服务。

本地持久化文件为应用内 `.data/state.json`（已忽略，不提交）。所有人工浏览器和独立 Agent 页面通过同一服务读写，因此跨页面、跨任务、刷新以及服务重启均保留修改。保存采用串行更新、版本冲突检查和原子文件替换。**文件模式只支持一个服务进程持有一份数据文件**，不可启动多个进程共享它。

侧边栏“系统设置”提供明确的范围确认。重置恢复本应用的 seed 数据，旧表单的版本同时失效，避免重置后被旧页面覆盖。不会读取、清空或改写 Pi 的会话、模型配置和其他 App 数据。

## 业务口径

“发布职位”入口位于职位列表右上角，也可访问 `/jobs/new`。填写岗位名称、部门、地点、招聘目标、负责人和完整 JD 后提交，真实保存并跳转到职位详情。新岗位的六项招聘统计均为 0，后续查询沿用同一数据模型。重置会同时移除新增岗位。

Syntropic 中“查看 JD → 通知里点击发布岗位 → 浏览器发布 → 原人才招聘窗口展示”的操作、mock 边界和验收见 [JD 发布演示](../../docs/jd-publication-demo.md)。BOSS 标签只属于桌面演示展示，不代表对外发布。

数据模型以候选人的投递记录、简历通过时间、面试轮次、评价提交状态和最终结论为事实来源。统计、筛选、列表和详情均由 `src/domain.mjs` 计算。

| 展示指标 | 计算口径 |
| --- | --- |
| 已投递简历 | 该职位累计投递人数 |
| 通过简历筛选 | 曾通过简历筛选的人数，不因后续失败扣减 |
| 进入面试流程 | 至少安排过一轮面试的人数 |
| 面试结束 | 至少有一轮面试，且所有已安排面试都已结束 |
| 面试通过 / 失败 | 当前最终结论；修改结论后两项相应更新 |
| 缺少评价 | 已结束的轮次中存在未提交评价，草稿也算缺少 |

“面试结束但缺少评价”同时满足上述面试结束和缺少评价条件。某一轮结束但下一轮仍待面试的候选人不会混入。名单按人列出，每人可缺多轮评价。

前四项是有重叠的累计统计，不能相加。职位详情另有互斥的**当前状态分布**，合计等于该职位候选人总数。面试通过数不是入职数，界面明确区分；本期不实现 Offer／入职管理。

评价可存草稿或正式提交；正式提交要求 1–5 分、意见和明确结论。全部面试结束且评价齐全后可记录最终通过／失败与说明。面试官单轮建议和 HR 最终结论分别保存。修改任何内容后，保存跳转重新读取持久化结果；陈旧表单返回冲突，不覆盖新内容。

## 桌面演示的本轮结果

演示模式下，首页和人才招聘窗口读取当前 `SYNTROPIC_PRESENTATION_ROOT/progress.json` 的已核验结果。只有显式发布或查询任务才访问招聘网页；浏览器任务成功后，再读取一次只读投影，核对本轮 draft 与岗位 ID 后保存。首页、招聘窗口、洞察和日程通过现有本地事件流更新，不定时向招聘网站查询。

会议和洞察使用本轮已保存的招聘结果，日常预设日程也来自本地。网页上的额外修改在下一次显式查询后更新到桌面。同一轮刷新保留结果，新建演示运行目录从空记录开始；云端通过 `/demo/<本轮标识>/` 使用独立数据行；每轮首次访问准备自己的预设，之后的链接、表单和结果读取始终留在这一轮。旧轮次及不带演示标识的记录不会被重置。岗位核验并保存后会自动生成有分歧的面试标准洞察，不依赖招聘窗口是否打开。发布建议完成后留在 AI 洞察卡片中并标记已发布，不再弹出待发布通知。

## 独立 Vercel 部署

### 当前进度（2026-09-10）

已完成 Vercel Production 部署与真实 Neon 读写验收，状态 **READY**：

- [正式域名](https://syntropic-recruiting.vercel.app)
- [部署详情](https://vercel.com/zhangqinufnaf-6847/syntropic-recruiting/3Hi96x8wDm9H4J9vRNtZqeKtfHtD)
- Deployment ID：`dpl_3Hi96x8wDm9H4J9vRNtZqeKtfHtD`。
- 项目 ID：`prj_uXQRMjD4frGa66c2QPmHCBLuhpk1`；团队 ID：`team_tybp1ywAt1FABPgFUlg32VGn`。
- 数据库：`syntropic-recruiting-demo`，Neon Free，区域 `iad1`，仅连接 Production；连接串由 Vercel Integration 保存为 Secret，没有进入源码或本地文件。
- Production 配置：`PUBLIC_ORIGIN=https://syntropic-recruiting.vercel.app`、`RECRUITING_PRESENTATION=1`，以及 Integration 注入的 `DATABASE_URL`。
- 已通过真实网页验证：发布职位、自动关联 30 位演示候选人、筛选出 3 位面试结束但缺评价的候选人、保存草稿、刷新持久化、正式提交评价，以及只读桌面结果接口。首页、CSS、桌面结果接口均返回 200。
- 验收记录已清理，恢复为 4 个初始职位、32 位候选人，目标岗位等待演示中发布；云端数据跨设备共享并持续保留，不随桌面退出自动重置。
- 现有已安装 Syntropic 未重新打包，仍使用原本的本地招聘地址。源码已支持通过环境变量接入云端；启动源码版：`SYNTROPIC_RECRUITING_URL=https://syntropic-recruiting.vercel.app npm run desktop`。Web 版可用相同环境变量启动 `npm run dev`。

### 配置与发布要求

源码不依赖 Pi、Electron 或父项目包。从仓库导入时，Vercel 新建独立 Project，Root Directory 选 `apps/recruiting`；若直接上传本目录文件，则使用项目根目录。Framework Preset 选 **Other**，Install Command 为 `npm ci`，不运行 Next 构建。`vercel.json` 的 Build Command 执行 `npm run db:init`，只建表和插入缺失的初始数据，不覆盖已有记录；请求交给 Node Function `api/index.mjs`，页面与本地复用同一 handler，CSS 随函数打包。

需要：

1. 有创建／部署 Vercel Project 权限的账号，及目标 Git 仓库的读取／集成权限；如果配置域名，还需对应域名管理权限。
2. **单独的 Neon Postgres 演示数据库**及连接权限；数据库账户首次初始化需要创建 `recruiting_demo_state` 表，运行期只需该表的读写权限。当前已创建独立 Neon Free 数据库，未选择付费计划。
3. 在 Vercel 环境设置 `DATABASE_URL`（Neon 服务端连接串）和 `PUBLIC_ORIGIN`（实际 HTTPS 站点 origin，不带尾部 `/`）。连接串只存在环境配置，不写源码或日志。Preview 与 Production 应使用不同数据库分支／库和对应 origin，避免互相重置。
4. 配好数据库后重新部署，构建阶段自动运行 `npm run db:init`。也可在本地安装此独立应用的依赖，通过环境安全注入 `DATABASE_URL` 后手动运行。命令只创建本应用表、插入不存在的 seed，不覆盖已有数据。

产品界面使用正常内部招聘系统文案；虚构数据性质、技术配置和演示操作说明仅维护在开发文档中。

云端不会自动使用本地 `.data`；也不能依赖 Vercel 临时文件保存数据。检测到 `VERCEL` 但无 `DATABASE_URL` 时，本应用返回数据不可用状态，不会假装保存成功。云端适配器通过数据库版本条件更新避免并发覆盖。适配器接口和冲突分支已做本地测试，真实 Neon/Vercel 的网页读写验收见上方当前进度。

这是共享虚构数据的 Demo，不含生产身份认证。若对外提供链接，所有能打开页面的人都能编辑及重置同一套数据；可另行规划访问范围及真实鉴权。不要放入真实简历。Vercel/数据库的套餐、区域、配额和费用需由账号持有人部署时核对，本次没有代选付费计划。

Electron 接入云端地址时，在启动工作台前设置非敏感的 `SYNTROPIC_RECRUITING_URL` 为该网页地址；重新加载／新建主 Agent 会话以加载入口上下文。桌面版会保留传入的地址，并在使用外部招聘服务时跳过本地招聘服务启动。已安装的旧版应用需要重新打包后才包含此行为。浏览器模型仍固定，不使用数据库连接串。

部署范围仅为本目录。可从本目录使用 Vercel CLI 关联独立 Project 并发布，不必上传整个 Syntropic 仓库；`.vercelignore` 排除本地数据、环境文件和测试。线上使用独立初始化的虚构数据，不会迁移或清空本地演示数据。若要保留桌面演示的“发布目标岗位后出现候选进展”流程，在初始化数据库和 Vercel 运行环境中均设置 `RECRUITING_PRESENTATION=1`。

参考：[Vercel Node Runtime](https://vercel.com/docs/functions/runtimes/node-js)、[Build 与 Root Directory](https://vercel.com/docs/builds/configure-a-build)、[Neon serverless driver](https://github.com/neondatabase/serverless)。

## 文件与验证

| 位置 | 职责 |
| --- | --- |
| `src/seed.mjs` | 确定性虚构数据 |
| `src/domain.mjs` | 统计、过滤、评价和结论规则 |
| `src/store.mjs` | 本地文件与可选 Neon 持久化适配器 |
| `src/views.mjs`、`public/style.css` | 服务端 HTML 页面和独立视觉样式 |
| `src/handler.mjs` | 网页路由、表单提交、保存后跳转 |
| `local.mjs`、`api/index.mjs` | 本地进程／Vercel Function 入口（分开命名以避免自动检测多个服务入口） |

在此目录运行 `npm test`，验证数据一致性、草稿、筛选边界、评价及结论更新、重启持久化、并发冲突、重置范围和表单保存。测试使用临时文件，绝不重置正在演示的数据。

Electron 演示与验收见仓库 `docs/browser-phase-three.md` 和 `docs/browser-phase-three-validation.md`。

## 品牌与界面

`public/brand.css` 和 `public/company-logo.svg` 是公司品牌源文件。修改后在仓库根目录运行 `node scripts/sync-company-brand.mjs`，同步到桌面 public 目录；JD 导出内嵌这些资源，离线也能完整显示。业务网站可独立部署，不依赖父项目文件。

`public/ui.js` 仅负责外观偏好和原生表单的提交中反馈。业务提交依旧使用 HTML form；禁用 JavaScript 仍可完成全部业务操作，并跟随系统主题。外观偏好仅存在当前浏览器；不与 Syntropic 工作台主题混用。
