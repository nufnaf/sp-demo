# Apps 启动台

参考 macOS Tahoe 的 Apps 浏览界面，使用居中的毛玻璃面板、搜索、分类和可滚动应用网格。小屏自动改为三列，低高度窗口使用紧凑布局，为现有对话入口和 Dock 留出空间。

## 实现与图标来源

- `LaunchpadPanel` 负责展示、筛选和焦点交互；应用加载与打开仍由 `AgentDesktop` 管理。
- 网格复用 [React Aria GridList](https://react-aria.adobe.com/GridList)，使用组件子路径导入；材质和动画使用 CSS。支持方向键、Enter、Esc、中文输入法，以及减少动态效果和透明度的系统偏好。
- 系统应用复用 `DockItemIcon`，启动台与 Dock 共用同一组背景色规则。
- 品牌图片复用 `AppBrandImage`，启动台、Dock 与应用市场均从 `china-apps` 获取资产和统一留白；其他插件仍共用 `BrandAppIcon`。
- 布局参考：[Apple Apps 使用说明](https://support.apple.com/en-gb/guide/mac-help/-mh35840/mac)。

## 验证

启动本 worktree 的开发服务器后运行：

```sh
npm run dev
node scripts/verify-launchpad.mjs
```

浏览器脚本会建立独立 agent-browser 会话，先检查真实应用列表及应用市场的打开，再通过浏览器请求拦截测试 31 个应用的目录。不会安装测试连接器或发送对话。覆盖搜索、分类、空结果、清除、方向键、Enter、Esc、焦点恢复、点击外部关闭，以及 1440×900、1280×633、768×1024、390×844、844×390 五种尺寸。截图默认保存在 `/tmp/syntropic-launchpad-verification`。

本次验证：类型检查、本次改动文件的 ESLint、浏览器脚本通过；减少透明度另经浏览器模拟验证。相关回归测试 21/22 通过，余下一项飞书渲染结构断言在原始 checkout 也失败。全仓库 lint 的 4 个错误位于已有的 `.agents/skills/lark-apps/creative-design/starter-components` 示例文件，本次未修改这些文件。
