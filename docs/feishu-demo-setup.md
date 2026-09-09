# 专用飞书演示资料配置

App 直连飞书官方 API，使用企业自建专用只读应用。演示者不需要飞书 CLI、用户登录或在线中转服务。资料准备时可以由管理员使用自己的飞书客户端或已授权 CLI；这与安装包的应用身份读取是两套独立身份。

招聘 JD 的后台任务通过一个“查找并读取”工具按完整标题获取唯一的授权文档，内部仍真实请求文件夹列表与文档正文。资料窗口保留原有列表和按 ID 读取接口。合并不会扩大权限或改用个人身份，详见 [实现与验证](feishu-combined-read.md)。

## 管理员第一次准备

1. 进入飞书开放平台“开发者后台”，创建企业自建应用，例如“星流科技”。仅用于虚构演示，不能复用正式业务应用或授权真实业务资料。
2. 左侧“权限管理”：开通获取文件夹文件清单、读取新版文档正文所需的只读权限（`drive:drive:readonly`、`docx:document:readonly`，按当前官方接口列出的可选权限配置）。不申请消息、邮件、日历或写文档权限。
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
  "documentIds": ["授权的新版文档标识"]
}
```

文件已被 Git 忽略；构建会检查非空配置。App 实际请求文件夹列表再按白名单过滤，正文也校验白名单与文件夹归属。列表 403、正文成功时，通常是文件夹尚未给应用授权；接口权限与资料协作者权限是两层检查。遇到拒绝由管理员修复，不切换到个人身份或模拟正文。

## 本轮已准备资料

资料所有者为用户确认登录的“张”。专用应用“星流科技”已发布机器人能力，并作为文件夹的可阅读协作者；未发送通知。

- [Syntropic 专用演示资料](https://vqhgd6lm2by.feishu.cn/drive/folder/XYZZf9lnxlGwhgddy5Pcwyucnpg)
- [星流科技业务介绍](https://vqhgd6lm2by.feishu.cn/docx/UGRTdU7YGoDyPzxWUuac3cYpnwb)

正文为虚构公司业务材料，不是预生成 JD；招聘目标为 AI Agent 工程师、Agent 研发、6 人、杭州／上海。已通过专用应用实际读取列表及正文验证。

## 安装包和有效期

构建从本机忽略文件读取凭据，注入受控包 `Resources/feishu-demo.json`，不通过前端环境变量或模型上下文传递 Secret。用户已接受该专用应用凭据随受控包分发及可提取风险；不包含 Pi 模型凭据。

token 仅缓存在后台内存，使用接口返回的有效期并提前重新获取；多请求共享获取过程。遇到 token 失效重新获取且最多重试一次，权限缺失与错误密钥不无限重试。退出恢复不删除本机配置或包内凭据；换机器和重开 App 自动重新获取 token，不要求演示者登录。

官方参考：[获取应用 token](https://open.feishu.cn/document/server-docs/authentication-management/access-token/tenant_access_token_internal)、[读取文件夹](https://open.feishu.cn/document/server-docs/docs/drive-v1/folder/list)、[读取正文](https://open.feishu.cn/document/server-docs/docs/docx-v1/document/raw_content)、[协作者与机器人能力说明](https://www.feishu.cn/content/383321056779)。
