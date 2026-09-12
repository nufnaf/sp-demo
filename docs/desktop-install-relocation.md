# macOS 安装位置变化时的崩溃

2026-09-10，同事反馈解压位置可以打开，移入 Applications 后崩溃。暂未收到同事的 ZIP 版本、macOS 版本或崩溃报告，不能确认其所有失败都属于以下原因。

## 已复现的问题

用已分发的 r4（buildId `78410230-4fde-43d7-b4dd-0f8913651a31`）实测：

- 完全退出后，从解压位置冷启动正常；完全退出后复制到 `/Applications` 再启动也正常，用户运行目录的资源链接随路径更新。
- 仅关闭窗口，原地再打开正常。
- 仅关闭窗口，后台进程仍在运行时移动整个 App，再从新位置打开：连续两次主进程 `EXC_BREAKPOINT / SIGTRAP`。两次分别从 Applications 移出、从临时目录移入 Applications；移动本身未结束进程，重新激活时才崩溃。
- 两份本机报告为 `Syntropic-2026-09-10-130536.ips` 与 `Syntropic-2026-09-10-130639.ips`。报告保留在本机，不把完整机器信息提交到仓库。

诊断副本证明重新激活时 Electron 的 `app.getPath('exe')`、`app.getAppPath()` 和 `process.resourcesPath` 都仍指向旧位置。旧 `focusWindow` 无条件创建窗口，进入依赖旧 App 路径的原生窗口/子进程初始化，JavaScript 的页面加载错误处理无法拦住主进程中止。具体原生断言未符号化，不能把堆栈的近邻符号当成精确故障函数。

## 修复与用户操作

在激活和创建窗口前检查打包资源目录。旧目录不存在时不再创建窗口，显示「应用位置已变化」提示；确认后走正常退出流程，停止本 App 拥有的后台服务。用户从新位置重新打开即可；新进程按现有机制修复运行目录链接。

保留 macOS 关窗后后台继续运行的行为。不会猜测新位置、杀死其他进程或更改系统安全设置。安装和更新说明补充：先按 ⌘Q 完全退出，等待复制结束后再打开。

修复版已实测移动后提示、确认后退出、服务端口释放、新位置重开及两场预设会议正常；没有新增崩溃报告。23 项 Electron 测试及改动文件 ESLint 通过，包含真实临时目录移动、重复激活只退出一次、原地关窗恢复、冷启动路径变化、后台服务清理和启动遮罩测试。

## 分发

r5 是 r4 的启动器修复包，仅替换 `electron/main.mjs`、新增 `electron/app-location.mjs`，更新构建标识与安装说明并重新签名。复用 r4 已验收的业务运行时和专用配置，没有把其他任务尚未合入的 UI 改动混入此次包。

buildId：`5d1cc97f-3f52-4814-8b09-715b63b6b3d1`。旧 r4 ZIP 保留，修复源码在 `codex/desktop-install-relocation` worktree。

若同事完全退出后安装仍崩溃，需要对照其真实系统报告继续排查；「App 已损坏」的系统拦截也不能当作本次已复现的进程崩溃。

最终 r5 ZIP 的 CRC 完整性检查及解压后的深度签名校验通过。SHA-256：`ea19e78177d8b78edf6475653910e18c8b53b15214be19c259787a353fd9a802`。

最终 ZIP 解压后移入 `/Applications/Syntropic.app` 的首次启动、关窗后原地重开已通过。随后完全退出，将同一副本更新至 `~/Applications/Syntropic.app`，旧 App 保留于本 worktree 的 `build/backups/Syntropic-before-install-relocation.app`。测试创建的系统 Applications 副本已移走，避免多份安装混淆。
