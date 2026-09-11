# 专用飞书演示资料配置

App 直连飞书官方 API，使用企业自建专用演示应用。演示者不需要飞书 CLI、用户登录或在线中转服务。资料准备时可以由管理员使用自己的飞书客户端或已授权 CLI；这与安装包的应用身份读取是两套独立身份。

招聘 JD 的后台任务通过一个“查找并读取”工具按完整标题获取唯一的授权文档，内部仍真实请求文件夹列表与文档正文。资料窗口保留原有列表和按 ID 读取接口。合并不会扩大权限或改用个人身份，详见 [实现与验证](../feishu-combined-read.md)。

## 管理员第一次准备

1. 进入飞书开放平台“开发者后台”，创建企业自建应用，例如“星流科技”。仅用于虚构演示，不能复用正式业务应用或授权真实业务资料。
2. 左侧“权限管理”：运行时需要文件夹清单读取（`space:document:retrieve` 或 `drive:drive:readonly`）及 `docx:document:readonly`。日程另外需要读取、创建权限和专用共享日历，详见 [日程接入配置](../feishu-calendar-sync.md)。准备资料阶段的创建权限见下文；应用运行时不写文档。
3. 左侧“添加应用能力”：添加“机器人”。这用于把应用作为资料的阅读协作者，不需要给它消息发送权限。到“版本管理与发布”创建版本，由管理员发布生效。后台未发布的改动不会自动生效。
4. 左侧“凭证与基础信息”：找到 App ID 和 App Secret，点击复制。只把它们填进本机 `.env.feishu-demo.json` 对应字段的双引号内并保存，不要发到聊天、命令行或日志。App Secret 不等于临时 token，不需要手工复制 tenant_access_token。
5. 建立专用文件夹，放入《星流科技业务介绍》。为应用授予这个文件夹和目标文档的“可阅读”权限，保留非公开分享。可以用所有者身份给应用的 bot open_id 添加只读协作者；机器人信息由官方 `/bot/v3/info/` 取得。不要把用于准备资料的 CLI 应用密钥写进安装包配置。
6. 将文件夹 URL 中 `/drive/folder/` 后的标识写入 `folderToken`；文档 URL 中 `/docx/` 后的标识写入 `documentIds` 数组。由维护者准备资料时，会代填这两项。

本机配置结构（占位符，不能直接用于构建）：

```json
{
  "appId": "填写专用应用 App ID",
  "appSecret": "仅在本机填写专用应用 App Secret",
  "folderToken": "专用文件夹标识",
  "documentIds": ["授权的新版文档标识"],
  "resourceIds": ["列表展示的文档、多维表格、电子表格标识"],
  "wikiNodeIds": ["列表展示的知识库节点标识"],
  "calendarId": "专用共享日历的完整 ID"
}
```

文件已被 Git 忽略；构建会检查非空配置。App 实际请求文件夹列表再按白名单过滤，正文也校验白名单与文件夹归属。列表 403、正文成功时，通常是文件夹尚未给应用授权；接口权限与资料协作者权限是两层检查。遇到拒绝由管理员修复，不切换到个人身份或模拟正文。

## 招聘资料清单与读取范围

本轮确认仅《星流科技业务介绍》填写正文，其他资料保持空白；妙记暂不创建。

| 名称 | 真实类型 | 应用中的行为 |
| --- | --- | --- |
| 星流科技业务介绍 | docx | 读取正文，在应用内打开，供 JD 生成使用 |
| 本周招聘进展 | docx | 在飞书中打开 |
| 候选人招聘进度 | bitable | 显示真实名称、类型及链接，在飞书中打开 |
| Q3 招聘计划与编制 | sheet | 显示真实名称、类型及链接，在飞书中打开 |
| 招聘与面试 FAQ | wiki 节点 | 每次向飞书解析节点名称，在飞书中打开 |

`documentIds` 只填写业务介绍 ID；`resourceIds` 是文件夹清单中的展示白名单，不授予正文读取能力。知识库不属于 Drive 文件夹，使用单独的 `wikiNodeIds` 白名单；未配置时不会请求 Wiki。知识库访问失败会在资料列表明确报错，但不影响直接查找并读取业务介绍。

创建阶段需要 `space:folder:create`、`docx:document`，多维表格需要 `base:app:create`，电子表格需要 `sheets:spreadsheet:create`，知识库创建节点与读取可使用 `wiki:wiki`（也可分别配置 `wiki:node:create` 和 `wiki:node:read`）。开通后发布版本使权限生效。新增知识空间只支持用户身份，因此由演示账号准备空间并把新应用加入为可编辑成员；随后应用可创建空白 FAQ 节点。

应用创建的资源归属应用，电脑上登录的个人账号不会因此自动成为协作者。需给确认的演示账号添加文件夹阅读权限，知识库另按空间成员权限访问；不要把资料改为公开链接来绕过共享授权。创建凭据及资源记录保存在本地忽略文件，Secret 不进入 Git 或日志。

业务介绍依据本分支的 `lib/recruiting-jd-fixture.ts` 编写：星流科技、Agent Platform、高级 AI Agent 研发工程师、6 人、北京／上海；不包含虚构营收、客户名单或融资数据。

### 本轮已准备并验证（2026-09-10）

- 演示账号：电脑飞书中的「用户517466」，所属「用户517466的组织」，域名 `ccn9ljqs4mfq.feishu.cn`。不要与历史「张」账号的 `vqhgd6lm2by.feishu.cn` 混用。
- [资料文件夹](https://ccn9ljqs4mfq.feishu.cn/drive/folder/A89Pfp3CklhHIIdPDHFcFTbnnUf)：包含业务介绍、本周招聘进展、多维表格候选人招聘进度、电子表格 Q3 招聘计划与编制。已给演示账号阅读权限，并通过该账号的浏览器验证可访问。
- [招聘与面试 FAQ](https://ccn9ljqs4mfq.feishu.cn/wiki/TLkiwG9NXiXq9fkSOCxc5My2nMb)：空白知识库节点，位于演示账号创建的「Syntropic 演示资料」知识库中。应用被添加为首页的可编辑文档应用，通过继承授权创建子页面；未授予整个组织的访问权限。
- 用新应用读取知识库首页的所有者 open ID 识别演示账号，再授予资料及日历阅读权限，无需手机号或邮箱，也没有将个人登录令牌放入应用配置。
- 共享日历「Syntropic 演示日历」已出现在电脑飞书的「我订阅的」，并已勾选显示。当前为空；没有创建测试会议或发送参会邀请。
- 用本分支的真实 FeishuDemoClient 核验：返回 5 项资料，类型 docx × 2、bitable、sheet、wiki；仅业务介绍允许读取正文，731 字符与飞书一致。日历接口成功返回空列表。
- 配置已写入本 worktree 的忽略文件；这些配置和代码尚未打入当前安装的 Syntropic。资料共享与日历可见已验证，「新版应用创建会议 → 电脑飞书出现会议」仍需真实联调。

日程配置和电脑飞书订阅步骤见 [飞书日程接入](../feishu-calendar-sync.md)。换应用时须重新授权文档与日历；App ID 不代表电脑上登录的用户。

## 历史已准备资料（更换应用后须重新核对）

资料所有者为用户确认登录的“张”。专用应用“星流科技”已发布机器人能力，并作为文件夹的可阅读协作者；未发送通知。

- [Syntropic 专用演示资料](https://vqhgd6lm2by.feishu.cn/drive/folder/XYZZf9lnxlGwhgddy5Pcwyucnpg)
- [星流科技业务介绍](https://vqhgd6lm2by.feishu.cn/docx/UGRTdU7YGoDyPzxWUuac3cYpnwb)

正文为虚构公司业务材料，不是预生成 JD；招聘目标为 AI Agent 工程师、Agent 研发、6 人、杭州／上海。已通过专用应用实际读取列表及正文验证。

## 安装包和有效期

构建从本机忽略文件读取凭据，注入受控包 `Resources/feishu-demo.json`，不通过前端环境变量或模型上下文传递 Secret。用户已接受该专用应用凭据随受控包分发及可提取风险；不包含 Pi 模型凭据。

token 仅缓存在后台内存，使用接口返回的有效期并提前重新获取；多请求共享获取过程。遇到 token 失效重新获取且最多重试一次，权限缺失与错误密钥不无限重试。退出恢复不删除本机配置或包内凭据；换机器和重开 App 自动重新获取 token，不要求演示者登录。

官方参考：[获取应用 token](https://open.feishu.cn/document/server-docs/authentication-management/access-token/tenant_access_token_internal)、[读取文件夹](https://open.feishu.cn/document/server-docs/docs/drive-v1/folder/list)、[读取正文](https://open.feishu.cn/document/server-docs/docs/docx-v1/document/raw_content)、[协作者与机器人能力说明](https://www.feishu.cn/content/383321056779)。


### 日程真实联调更新（2026-09-10）

已完成开发版创建请求、修正空地点参数、界面重试读取同一真实日程及电脑飞书详情核对。日程为 9 月 11 日 14:00–14:30 的「星流科技 · 高级 AI Agent 研发工程师面试标准对齐」，仍保留在「Syntropic 演示日历」。此前「尚未真实创建」记录仅代表当时状态；具体测试过程与边界见 [真实端到端联调](./feishu-calendar-sync.md#真实端到端联调2026-09-10)。已安装的 Syntropic 尚未更新。
