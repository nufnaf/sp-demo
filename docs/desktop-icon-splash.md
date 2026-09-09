# Syntropic App 图标与启动画面

2026-09-10，工作分支 `codex/syntropic-icon-splash`，基于 `234d3ba`。

## 图标

最终图标直接复用 `public/icons/syntropic-mark.png` 的透明轮廓，将 S 显示为白色，添加蓝紫至青绿渐变圆角底板、细微高光和阴影，与工作台品牌配色保持一致。没有修改应用内原标识，也没有使用星流科技的公司图标。

- `electron/assets/syntropic-app.png`：1024 × 1024，真实透明背景，供桌面运行和启动画面使用。
- `electron/assets/Syntropic.icns`：包含 16 至 1024 像素的 macOS 图标表示，打包写入 `CFBundleIconFile`；开发启动同步设置 Dock 图标。
- `electron/assets/syntropic-app.svg`：内嵌原始标识的可编辑母版。
- `electron/assets/startup-wallpaper.webp`：从应用内 `public/design/home/wallpaper.png` 导出的本地壁纸；启动页沿用相同定位与缩放，叠加轻微暗色遮罩突出标识。
- `npm run icons:desktop`：从原标识重新生成资源；macOS 同时输出 ICNS。Sharp 固定为项目原来已使用的 0.35.3。

图像生成工具曾按“原 S 轮廓、暖白圆角底板、深墨色标识、轻微阴影、透明背景”提示制作探索图，但两次结果都把棋盘格写入 RGB，未采用。用户明确同意改用本地图形工具后，最终使用 SVG + Sharp 直接复用原标识，iconutil 导出 ICNS。

## 启动行为

本地启动画面放在同一 BrowserWindow 的 WebContentsView 上层，不依赖 Next 服务。服务状态变化只更新状态，不反复导航或重启动画。主页面在其下方加载；React 挂载、壁纸解码和字体就绪后，经过绘制帧发送受限的 ready 信号，再用 360ms 淡出揭示工作台，不强制等待完整呼吸周期。

正常画面在蓝紫、青绿波纹壁纸上显示图标、白色 Syntropic 和“智能工作空间”，包含轻微缩放、星形微光与呼吸动画。减少动态效果时停止缩放和微光，淡出缩短为 100ms。

错误状态停止动画，并在深色半透明卡片中显示原因；服务故障重试由原 supervisor 处理，页面故障在服务仍正常时仅重载页面。首屏未在 45 秒内就绪则显示可重试提示。错误会取消尚未完成的淡出。窗口关闭时显式销毁上层 WebContents、监听器和计时器。

工作台 preload 仅公开 ready；启动页 preload 仅公开状态订阅、淡出完成和重试。主进程检查发送者、主 frame 和允许的 URL，不向网页暴露 Electron 或通用 IPC。

参考：[Electron WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view)、[Dock 图标 API](https://www.electronjs.org/docs/latest/api/dock)。

## 验证

- 类型检查、改动文件 ESLint、`git diff --check` 通过。
- `npm run test:desktop`：16 项通过。
- 打包资源清理回归：1 项通过。
- `npm run test:desktop-ui`：2 项通过，覆盖真实 Electron 上层视图、正常/快速启动、错误中断淡出、重试、超时、缩放、减少动态效果、销毁以及 PNG 透明度与 ICNS 1024 像素表示。
- `SYNTROPIC_TEST_APP=build/desktop/release/Syntropic.app node --test scripts/desktop-startup-packaged.test.mjs`：1 项通过。包内真实 standalone 服务运行在独立临时端口，加载实际编译的 React/CSS/壁纸，验证首次加载与刷新后的自动收起及输入框可用。业务 API 使用测试响应，未执行模型、飞书、招聘发布操作。
- 生产构建、严格 macOS 签名校验、打包图标声明与文件一致性通过。

产物：`build/desktop/release/Syntropic.app`，构建 ID `e0df3db4-68b0-41ec-9739-7876cbc5ca2d`，约 884 MiB。沿用线上招聘站配置。该包尚未替换已安装 App。

预览：`build/startup-validation/startup.png`、`startup-error.png`、`packaged-workbench.png`。

当前 30141 端口由另一个 worktree 的开发服务使用，因此本轮使用隔离端口验证包内服务和真实首屏交接，未中断该服务，也未以正常桌面入口抢占端口。原有 supervisor 进程管理回归通过；未重跑模型驱动的整段招聘演示。

## 配色调整

用户认为初版暖白启动页与打开后的工作台差异偏大，改为共用工作台壁纸，图标采用蓝紫至青绿底板和白色原 S。窗口初始底色同步为工作台的 `#273878`。

配色版产物：`build/desktop/release-color/Syntropic.app`，构建 ID `c07dfa2c-242d-4166-bbb1-30f42d47d31c`。本次仅更新桌面样式和图片，复用上一版已验证的同一份 standalone 产物，重新签名并验证包内首屏交接。常规 `npm run package:desktop` 也会自动包含新的桌面资源。

初版预览另存为 `build/startup-validation/startup-warm.png`；`startup.png` 与 `startup-error.png` 为当前配色。现有安装未替换。
