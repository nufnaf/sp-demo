# NovaFlow 内部招聘 Demo

星流科技 HR 与面试官使用的独立招聘网页。延续[招聘官网](https://github.com/Luffy6677/hr)的品牌、深绿、荧光黄绿与纸白配色；本应用自行实现内部工作台，不连接或修改该官网。

5 个职位、62 位候选人和全部评价均为虚构。查询、筛选、详情、评价草稿与提交、通过／失败、职位设置和重置通过真实 HTML 链接与表单执行。无需登录；页面身份为陈晓（招聘负责人）。无邮件、通知、真实招聘连接器或业务数据 API。

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

## 独立 Vercel 部署条件（本次未部署）

源码不依赖 Pi、Electron 或父项目包。Vercel 新建独立 Project，Root Directory 选 `apps/recruiting`，Framework Preset 选 **Other**，Install Command 为 `npm ci`，不运行 Next 构建。`vercel.json` 将请求交给 Node Function `api/index.mjs`；页面与本地复用同一 handler，CSS 随函数打包。

需要：

1. 有创建／部署 Vercel Project 权限的账号，及目标 Git 仓库的读取／集成权限；如果配置域名，还需对应域名管理权限。
2. **单独的 Neon Postgres 演示数据库**及连接权限；数据库账户首次初始化需要创建 `recruiting_demo_state` 表，运行期只需该表的读写权限。本阶段未创建数据库或付费资源。
3. 在 Vercel 环境设置 `DATABASE_URL`（Neon 服务端连接串）和 `PUBLIC_ORIGIN`（实际 HTTPS 站点 origin，不带尾部 `/`）。连接串只存在环境配置，不写源码或日志。Preview 与 Production 应使用不同数据库分支／库和对应 origin，避免互相重置。
4. 部署前，在本地安装此独立应用的依赖，并通过环境安全注入 `DATABASE_URL` 后运行 `npm run db:init`。命令只创建本应用表、插入不存在的 seed，不覆盖已有数据。

产品界面使用正常内部招聘系统文案；虚构数据性质、技术配置和演示操作说明仅维护在开发文档中。

云端不会自动使用本地 `.data`；也不能依赖 Vercel 临时文件保存数据。检测到 `VERCEL` 但无 `DATABASE_URL` 时，本应用返回数据不可用状态，不会假装保存成功。云端适配器通过数据库版本条件更新避免并发覆盖。适配器接口和冲突分支已做本地测试，**尚未连真实 Neon 或在 Vercel 实测**。

这是共享虚构数据的 Demo，不含生产身份认证。若对外提供链接，所有能打开页面的人都能编辑及重置同一套数据；可另行规划访问范围及真实鉴权。不要放入真实简历。Vercel/数据库的套餐、区域、配额和费用需由账号持有人部署时核对，本次没有代选付费计划。

Electron 接入云端地址时，在启动工作台前设置非敏感的 `SYNTROPIC_RECRUITING_URL` 为该网页地址；重新加载／新建主 Agent 会话以加载入口上下文。浏览器模型仍固定，不使用数据库连接串。

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
