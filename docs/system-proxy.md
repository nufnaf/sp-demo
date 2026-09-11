# macOS 桌面系统代理

桌面后台的 HTTP/HTTPS 请求通过仅当前用户可访问的 Unix socket 进入 Electron 的独立网络 session，由 Chromium 按系统设置执行连接。招聘网站、飞书 API 和模型 HTTP/SSE 请求共用这一入口；浏览器页面本身仍由 Chromium 正常联网。不会下载 PAC 后在 Node 中执行，也不把本机代理固定为某个端口。

## 模式与边界

| 配置 | 行为 |
| --- | --- |
| PAC 自动配置 | 使用系统 PAC，按 URL 求值，遵守 PROXY / HTTPS / SOCKS / DIRECT 和候选顺序 |
| WPAD 自动发现 | 由 Chromium 的 system 模式读取并处理系统自动发现配置 |
| 手动 HTTP / HTTPS 代理 | HTTP 请求和 HTTPS CONNECT 均由 Chromium 处理，包括加密的 HTTPS 代理连接 |
| SOCKS4 / SOCKS5 | 使用 Chromium 原生实现 |
| 无代理 / 直连 | 使用系统直连路径 |
| TUN / VPN 虚拟网卡 | 由系统路由处理，不额外叠加应用代理 |
| 系统例外地址 | 使用系统网络栈的绕过规则；本机工作台和调试连接强制直连 |
| `HTTP_PROXY` / `HTTPS_PROXY` | 显式后台配置优先于系统网络；保留小写优先规则 |
| `ALL_PROXY` | 补全未指定协议的后台代理；可以使用带凭据的 HTTP / SOCKS5 地址 |
| `NO_PROXY` | 每次请求读取，支持域名及子域、端口、IPv6、全局 `*`，小写优先 |

系统配置变更交给 Chromium 的系统观察机制处理，新请求按新配置路由；不主动关闭正在进行的模型流，也不重发岗位提交。显式环境配置由启动环境提供，不修改系统配置。需要账号密码的代理可使用已有的显式环境配置；此改动不增加代理账号登录窗口，系统代理的未满足认证挑战会失败，不无限等待。不是所有企业认证产品都已经实测。

网络 session 与工作台窗口隔离，不自动使用网站 Cookie。保留调用方明确提供的 Authorization、Cookie、方法和正文。Node 调用方继续决定重定向和跨域凭据处理，响应压缩只解码一次，SSE 分段传递，取消/超时会中止原生请求。桥接不输出目标 URL、Header 或凭据日志。socket 所在目录权限 0700，socket 权限 0600，正常退出关闭并移除；不监听新的 TCP 端口。

此入口仅接入 macOS Electron 自己启动的后台。独立 Web 服务及其他系统继续使用原有环境代理/手动代理处理。此处范围是 HTTP/HTTPS/SSE，不声称为任意子进程 CLI 或独立 WebSocket 库注入系统代理。

## 验证

`node --test scripts/system-network.test.mjs` 使用独立 Electron 进程及本地代理/网站，执行实际 Chromium 请求，覆盖 PAC、PAC 的 DIRECT 和候选回退、HTTP 代理、HTTPS CONNECT、加密 HTTPS 代理、SOCKS4/5、直连、模式切换、POST 正文与认证头、无正文的 DELETE/POST/PUT/PATCH/OPTIONS 和空上传流、重定向、Cookie 隔离、压缩、SSE 及取消。证书放行仅存在于本地测试 fixture 的指定域名，不进入产品。

`lib/system-network-dispatcher.test.mjs` 和 `lib/http-dispatcher.test.mjs` 覆盖绕过规则、ALL_PROXY 及显式环境配置优先级。WPAD 的真实 DHCP/DNS 发现、TUN 供应商组合和另一台 Mac 未实测；未改变开发者系统网络设置。

2026-09-11 已从 `f299875` 构建并安装 macOS Apple Silicon 包。源包、复制包及 ZIP 解压后的签名与 buildId 一致，ZIP CRC 检查通过。已安装 App 中完成通知按钮发布岗位、招聘进展查询、重复发布保护和正常退出/重启验收，浏览器发布与查询实际使用 DeepSeek。首次招聘连接曾失败，完整复测通过且未捕获网络错误；这不替代同事电脑的 PAC 实测。启动中的飞书日历重置也验证了无正文 DELETE 请求修复。

## JD 任务卡片

首次 JD 预览播放时，当前任务卡片由已有的 `pendingJdPreviews` 状态显示“正在生成 JD”；播放完成、关闭预览或刷新恢复完整文件后显示后台保存的结果。后台会话仍准确记录文件落盘完成，失败/停止不会被播放状态覆盖。未打开预览不额外阻塞任务。发布洞察继续遵循现有播放完成与未打开时的计时规则。

`scripts/jd-pacing.test.mjs` 使用真实桌面组件和 iframe、接口夹具，覆盖播放中/暂停、完成、关闭与刷新后的状态。该验证不发布外部岗位、不调用模型。

本次额外运行现有 `components/RecruitingPublication.test.mjs` 时，19 项因测试夹具没有提供当前生产代码已使用的 `jdInsightReadyAt` 导出而失败；两个文件均与本次起点 `66ff64f` 完全一致，属于既有测试问题，不计入本次通过数。实际播放/洞察链路由上面的浏览器回归另行通过验证。

参考：[Electron 系统代理配置](https://www.electronjs.org/docs/latest/api/structures/proxy-config)、[原生网络请求](https://www.electronjs.org/docs/latest/api/client-request)。
