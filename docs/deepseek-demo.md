# DeepSeek 官方 API 演示包

默认构建使用 DeepSeek 官方接口 `https://api.deepseek.com`，模型 ID 为 `deepseek-flash`（DeepSeek V4.1 Flash），思考强度 `low`。主 Agent、后台任务和浏览器任务统一选择该模型，不经过 OpenRouter。实际网络可达性仍需在演示者电脑上确认。

模型名称、工具调用与思考内容传回要求依据 2026-09-10 的官方文档：

- https://api-docs.deepseek.com/quick_start/pricing/
- https://api-docs.deepseek.com/guides/thinking_mode

## 配置与构建

在独立 worktree 的 `.env.deepseek-demo.json` 填写：

```json
{
  "apiKey": "<演示专用 DeepSeek API Key>",
  "modelId": "deepseek-flash"
}
```

`modelId` 可省略或留空，默认使用 `deepseek-flash`。文件被 Git 忽略；也可用 `SYNTROPIC_DEEPSEEK_CONFIG` 指定私有配置文件的绝对路径。Key 不进入 Git、命令参数、构建日志或使用说明。

准备同一 worktree 下已完成日历配置的 `.env.feishu-demo.json`，然后构建：

```bash
SYNTROPIC_DEMO_AUTH=deepseek \
SYNTROPIC_RECRUITING_URL=https://syntropic-recruiting.vercel.app \
npm run package:desktop
```

不指定 `SYNTROPIC_DEMO_AUTH` 时也默认 DeepSeek。仍可显式选择 `openrouter` 或 `chatgpt` 构建对应版本。构建在独立暂存目录进行，输出 `build/desktop/release/Syntropic.app`；用 `SYNTROPIC_DESKTOP_RELEASE_DIR` 指定其他输出目录。打包前确保 `node_modules` 是实际依赖目录，不是指向其他 checkout 的符号链接。

## 启动与隔离

包内只注入所选服务的模型配置。启动时为本轮演示创建独立 `auth.json`、`settings.json` 和 DeepSeek `models.json`，使用新型号而不依赖 SDK 的旧模型目录。临时认证文件权限为 0600；忽略继承的 DeepSeek/OpenRouter Key，使用包内配置。完全退出清理本轮临时凭据，下一次启动重新初始化，不修改个人 Pi 配置。

沿用内部演示包预置 Key 的分发方式，接收者无需配置 Key。提供者负责该演示 Key 的额度和撤销。普通 Web / 开发 Electron 的个人模型默认值不受此包配置影响。

## 验证

自动测试覆盖两种预置 Key 包的真实 SDK 会话初始化、主任务与浏览器模型选择、两次启动、退出清理、无效配置不泄露内容，以及 DeepSeek 流式工具调用后 `reasoning_content` 完整传回。

```bash
node --test electron/demo-model.test.mjs
```

真实验收需分别确认：官方模型列表与 Key 可用、JD 发布成功、招聘查询返回 12 人面试结束 / 3 人评价未齐、重复发布不新增岗位。JD 生成仍沿用已批准的固定演示内容，不能把它计作模型生成成功。上述后端验收与打包 App 的界面验收需分开记录，国内网络需由同事在实际环境中复测。

### 2026-09-10 后端实测

使用真实 DeepSeek Key 调用官方 `/models` 返回 200，并列出 `deepseek-flash`。两轮独立演示目录通过生产 `createPresentationTask` 执行固定 JD 生成、真实网页发布和只读查询，网站为线上内部招聘系统，未修改已安装 App 的演示数据。

| 轮次 | 网页发布 | 网页查询 | 核验 |
| --- | --- | --- | --- |
| 1 | 12.000 秒，3 步 / 4 轮模型调用 | 9.685 秒，1 步 / 3 轮 | 12 人面试结束、3 人评价未齐 |
| 2 | 10.415 秒，3 步 / 3 轮模型调用 | 17.890 秒，4 步 / 5 轮 | 12 人面试结束、3 人评价未齐 |

两轮远端职位正文与本地提取的 1611 字符 JD 完全一致；重复发布未再启动浏览器，也没有增加岗位。每轮只有 1 个岗位、30 位候选人。临时模型认证目录在测试后删除。证据在 Git 忽略目录 `build/verification/deepseek/`；这属于真实后端流程验证，不代表已完成新 App 的界面验收或国内网络验证。

测试包 `build/distribution/Syntropic-DeepSeek-20260910.zip` 已生成。包内生产服务用独立端口启动，经正常工作目录校验接口初始化后，`/api/models` 确认仅选择 `deepseek / deepseek-flash`；构建 ID 为 `4e15d873-4186-4fd1-a94d-65847ab890df`。构建、类型检查及 24 项桌面自动测试通过。此步骤没有启动原生 App 窗口，没有替换本地已安装 App。

## macOS 系统代理与发布超时

桌面后台在启动时读取 macOS 已启用的手动 HTTP、HTTPS 或 SOCKS 系统代理；无需从终端设置代理环境变量。系统中的例外地址、CIDR 和简单主机名直连规则继续生效，本机工作台和浏览器调试连接保持直连。显式设置的 `http_proxy` / `HTTP_PROXY`、`https_proxy` / `HTTPS_PROXY` 优先，`no_proxy` / `NO_PROXY` 继续生效。更换系统代理配置后完全退出并重新打开 App；此适配不解析 PAC／自动代理发现脚本，也不修改系统网络设置。

发布前与发布后的岗位读取各有 30 秒总时限（包括响应正文），可被用户停止操作取消，不自动重复提交岗位。发布前读取失败会说明“尚未提交岗位”；网页操作后的核对失败会说明保存结果尚未确认，重试时先核对已有岗位。实际错误显示在发布结果中，避免只显示不可访问的“任务状态”提示。
