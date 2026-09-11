# 星流科技招聘品牌改造

星流科技是使用 Syntropic 的客户企业。招聘网站和该公司发布的 JD 使用独立的蓝白品牌；Syntropic 人才招聘、查询结果、主动洞察和团队日程等功能界面保留产品自身的视觉语言。

## 设计依据与范围

依据用户提供的 `linkedin-color-system-handoff` 中的 README、tokens.css 和 HTML 参考页，采用浅灰页面、白色内容表面、克制的品牌蓝、8px 内容圆角及 4px 控件圆角。保留星流科技原四角星识别特征，统一为蓝底白星 SVG。

覆盖招聘网站全部页面、表单反馈、空状态和错误页，以及 JD 文档、公司招聘来源卡片/连接弹窗、发布渠道中的公司标识。公司介绍明确为面向企业客户的 Agent 系统研发与交付服务，保持原岗位、人数、地点及招聘流程设定。

星流 CRM 独立网站、飞书远端企业头像/文档封面不在本次源码修改范围。飞书和 BOSS 保留第三方品牌，Syntropic 的 Dock 和功能图标保留产品身份。

## 资源维护与实现

- 品牌源文件：`apps/recruiting/public/brand.css` 与 `company-logo.svg`。
- 运行 `node scripts/sync-company-brand.mjs`，同步到 `public/design/company/brand.css` 和既有的 `public/icons/company-careers-logo.svg`。保留现有路径让公司标识的所有引用一起更新。资源一致性由招聘测试检查。
- 独立网站只读取自身目录的资源，可继续以 `apps/recruiting` 为根目录部署。静态资源路由为固定白名单，含 `/demo/<run>/` 的资源、链接、表单与跳转仍保持轮次路径。
- `ui.js` 在首屏绘制前恢复公司网站的主题；默认跟随系统，手动选择存入 `novaflow:appearance`。仅允许同源脚本，不开放内联脚本。表单继续原生提交，提交中不禁用 submitter，避免丢失草稿/提交按钮的 name/value；返回缓存页面时恢复按钮。
- 无 JavaScript 时，全部业务表单仍可用，主题由 CSS 跟随系统；localStorage 不可用时仍可手动切换主题。
- JD 内嵌完整品牌 CSS、Logo 和图标，在离线文件和沙箱中可用。保留逐段展示、暂停、恢复、重新打开及打印完整内容的机制。新生成的文档采用新品牌，历史保存文件不批量重写。
- 卡片边框沿用参考色值；输入控件边界采用独立的较强对比变量，避免将装饰性浅边框直接用作唯一控件边界。成功/待处理/失败有独立语义色和文字，业务组件不散落 Hex 颜色。正在招聘、已发布职位及目标进度使用公司蓝；统计数字采用正文色；绿色仅表达已通过、已提交、保存成功等业务结果。JD 文档与宿主窗口中的公司招聘标签保持一致。
- 桌面主要内容内宽最大 1180px；375px、768px、1440px 下保持全部业务入口与信息，窄屏表格在自己的容器内横向滚动。

## 验证

- `npm run test:recruiting`：业务持久化、发布、评价、并发、隔离轮次、静态资源和品牌一致性。
- `node --test lib/recruiting-jd-demo.test.mjs lib/recruiting-jd-timing.test.mjs lib/recruiting-publication.test.mjs lib/browser/recruiting-publication.test.mjs`：JD 完整正文、离线资源、保存与恢复、取消和发布边界。
- `node scripts/recruiting-design.browser.mjs`：60 组页面/主题/宽度组合，正文对比度、页面溢出；真实浏览器表单的筛选、草稿、非法提交、正式评价、招聘结论、发布、职位设置、刷新与并发冲突；主题记忆、系统切换、键盘入口、无脚本和存储受限场景；离线 JD、打印与减少动画偏好。脚本自行创建临时数据，不访问线上招聘数据。
- `node --test scripts/jd-streaming.test.mjs`：生产沙箱中的 18 秒展示、暂停、手动滚动、重新打开、窄屏和打印。
- 全量 TypeScript 与改动文件 ESLint、`git diff --check`。

本次为源码与隔离浏览器验收，不包含线上部署、已安装 App 替换、模型驱动的外部操作或真实飞书写入。
