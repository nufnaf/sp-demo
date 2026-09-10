# 快捷输入发送后的会话恢复修复

排查起点：`d38b3ff`。分支：`codex/fix-quick-prompt-session`。

## 问题与证据

桌面快捷文字只填入输入框，发送走主助手 `useJarvis`。启动时已把会话 ID 交给界面，但 Pi 0.84.3 默认等到首条 assistant 消息才创建会话文件。

十分钟闲置回收后，恢复逻辑可能拿着缓存路径打开尚不存在的文件。SDK 会生成另一个 ID，并以进程目录作为 cwd；界面和主助手登记仍保留旧 ID。新 ID 注册还会移除旧路径映射，后续旧 ID 请求因此可能报 `Session not found`。

同时，旧事件流原来会在 wrapper 销毁后继续发送心跳，没有跟随新 wrapper；输入框又在请求成功前清空，导致失败后无法直接重试、进度看似停滞。

上述链路已通过当前 SDK 和真实 API 回归测试验证。没有现场请求日志，因此不能断言用户演示时必然由同一触发条件导致。

## 修改

- 主助手初始化时保存原会话头与条目，再通过 SDK 重新载入，使后续消息正常追加；不伪造 assistant 消息，不改普通空白会话的默认保存策略。
- 同一工作目录的并发主助手初始化共享已有启动锁，返回同一个 ID。
- 恢复时拒绝缺失文件或不匹配的 ID，避免静默进入另一个工作目录。缺失会话的命令返回明确的 404 / `accepted: false`。
- wrapper 销毁时通知并关闭事件流；客户端等待新连接就绪后发送。重连期间已完成的回复通过历史读取恢复，避免覆盖更新的实时事件。
- 请求被接受后才清除对应草稿；保留发送期间新输入的文字。连续提交只发一次，失败解除等待，结果不明的请求不自动重发。
- 会话失效时重新解析主助手，为用户下一次手动发送准备连接，不自动重放上一条命令。

## 验证

- `lib/jarvis-session-lifecycle.test.mjs`：真实 SDK、主助手 API、发送 API 和 SSE；通过测试时钟推进十分钟，覆盖空会话/已有对话回收、多个订阅者、无路径缓存恢复、并发初始化、缺失文件与 ID 不匹配。
- `scripts/desktop-composer.test.mjs`：真实 Chrome 页面，注入 HTTP/SSE 故障，覆盖 404 后保留草稿并重试、服务器接受后响应丢失不重发、连续提交与新草稿保护、重连完成前不发送。
- 独立测试工作台上手动执行“点击生成 JD 快捷文字 → 发送”：任务完成，JD 文件自动打开。
- 类型检查、改动文件 ESLint、`git diff --check` 通过。
- 相关测试组通过；扩展检查中 `lib/rpc-manager.test.mjs` 的 `built-in subagents persist their selected resource policy` 仍失败，基线同样失败：旧的源码正则要求 `SessionManager.create` 第二个参数为 `undefined`，当前基线实际使用 `presentationSessionDir(parent.cwd)`。本次未修改该无关断言。

运行核心回归：

```sh
node --test lib/jarvis-session-lifecycle.test.mjs lib/agent-event-stream.test.mjs
```

浏览器测试需指向独立的演示测试服务，避免使用正在演示的安装版：

```sh
SYNTROPIC_TEST_URL=http://127.0.0.1:<测试端口> node --test scripts/desktop-composer.test.mjs
```

测试采用独立工作台和 Pi 数据目录，没有加载账号凭据，也没有执行岗位发布、外部消息或日程写入。飞书日历在该无凭据环境中未验证。

本修复不包含已安装桌面版本的替换。
