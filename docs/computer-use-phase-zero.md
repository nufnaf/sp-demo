> 后续接入与验收已推进，当前状态见 [Computer Use 与 App 内 Spaces](./computer-use-spaces.md)。下文保留 Phase 0 的研究与历史证据。

# Computer Use 接入：Phase 0

日期：2026-09-11。起点：`origin/dev` 的 `981660f`。

## 已对齐的目标

- 操作 macOS 上独立安装的飞书客户端。
- 从招聘洞察发起会议安排，客户端 GUI 完成日程写入；API 继续承担读取和结果核验。
- 用真实持续采集的应用画面展示操作过程，之后加入浮窗、放大和跨桌面拖动。
- 工作台与桌面是独立概念。工作台保持业务数据范围；桌面采用用户所指的 macOS Spaces 交互语义。
- 用户已确认：Spaces 和悬浮小窗均属于 Syntropic App 内部。桌面横向切换、创建新桌面、跨桌面拖动小窗、放大查看由应用内部管理，不使用 macOS 系统 Spaces 作为产品承载层。
- 复用成熟组件，在演示场景中实测具体限制，不重新论证 Computer Use 的一般可行性。

## 组件选择

使用 `@trycua/cua-driver@0.26.1`，固定 npm SDK 与平台原生包版本。复用其 macOS 执行层、窗口枚举、截图、AX 控件和后台输入；具体后台行为以本机逐项验收为准。主任务及后续日程流程继续使用现有 Pi SDK。

本地 grok-bot 重建源码提供动作协议、专用 Computer Use 任务、运行状态与预览分离的参考。它的 Box、X11 和 VNC 链路不迁入本机飞书执行路径；没有把整套 grok-bot 运行时或闭源 renderer 导入本仓库。

出处：

- [Cua Driver](https://github.com/trycua/cua/tree/main/libs/cua-driver)
- [进程内 SDK](https://cua.ai/docs/how-to-guides/driver/use-sdk-in-process)
- [SDK 参考](https://cua.ai/docs/reference/cua-driver/sdk-reference)
- [平台支持](https://cua.ai/docs/reference/cua-driver/platform-support)
- [macOS 操作与预览采集](https://cua.ai/docs/reference/cua-driver/mcp-tools)

文档中的预发布示例和 SDK 接口会变化，实际实现以安装的 0.26.1 类型声明和运行结果为准。

## 代码边界

- `electron/computer-use/driver.mjs`：一个原生 runtime、一个已选择的确切飞书窗口、一个串行操作队列。窗口 ID 用字符串跨 JS 边界，用 bigint 调用原生 SDK。
- `electron/computer-use/preview.*`：独立 Electron 预览原型。只采集图像，不暴露 GUI 写入操作。没有启动 Next、招聘网站或演示日历初始化。
- `scripts/computer-use-probe.mjs`：只读探针，默认使用修复后的共享持续采集，检查窗口识别、权限、截图和控件树；`--sdk-capture` 仅用于旧 SDK 独立窗口截图的对照。
- `scripts/computer-use-manual.mjs`、`scripts/computer-use-verify.mjs`：模型无关的单步控制台与固定草稿验收。
- `scripts/computer-use-draft.mjs`：显式启动的 Pi Agent 草稿验证（AX 优先，按需截图）。只向 Agent 暴露观察、单步后台动作和结束工具；不提供 shell、文件、浏览器或飞书 API 工具。

执行会话与查看窗口分开。执行器和预览保持独立的 AX runtime，但订阅同一原生采集服务。执行器默认向模型只提供 AX，坐标或视觉回退时才附图；查看窗口持续显示流，不会覆盖执行器的控件快照。当前是 JPEG 帧流，还未使用视频编码。

预览每次只允许一个采集请求进行，完成后才安排下一帧；断开、重连和关闭使旧采集结果失效。关闭本阶段独立预览会退出其观察 runtime；后续正式接入时，隐藏/关闭查看窗口不代表停止 Agent。

每个输入动作消费一个已观察的快照。控件失效、坐标越界、窗口关闭及后台输入拒绝不会静默重绑或自动切到前台。动作送达和业务完成是两个状态，后续保存仍须核验。

## 运行

在这个 worktree 中安装依赖：

```sh
npm ci --legacy-peer-deps
```

保留现有 React/语音 SDK 依赖组合，不在此阶段迁移它们。运行：

```sh
npm run computer:probe
npm run computer:preview
```

预览界面点击“连接飞书”。主窗口必须能够唯一识别；不要最小化源窗口。需要权限时，由运行原生组件的应用获得 macOS 辅助功能和屏幕录制授权。

已打开独立日程编辑器时，可用 `npm run computer:preview -- --calendar-editor` 检查该窗口的画面。此阶段显式选择主窗口或编辑器，尚未实现随任务自动切换。

模型无关验收通过之后，才显式运行 Agent 未保存日程草稿验证：

```sh
npm run computer:draft
```

该探针使用本机 Pi 已有的 `openai-codex/gpt-5.6-luna` 视觉模型授权，在飞书中准备北京时间次日 14:00–14:30 的“面试标准对齐”草稿。指令要求不保存、不选择真实参会人、不发送邀请；发现既有用户草稿时停止。它是开发验收入口，不是用户产品入口，也不代表正式产品已完成模型配置或保存边界。

脚本不保存模型对话或密钥。截图及不包含输入内容的动作统计保存在 Git 忽略的 `build/verification/computer-use/`。

## 当前结论：普通启动下固定表单与真实模型草稿均已通过

普通启动、完全遮挡条件下，两次固定脚本均已完成标题、日期、14:00–14:30 时间提交、说明与后台滚动。第二次来自全新草稿，初始时间为 04:30–05:00。逐检查点确认飞书 `active=false`，并人工查看关键画面；没有保存日程或邀请参会人。

- 初次无参数完整通过：`build/verification/computer-use/fixed-1789070506100/`。
- 全新草稿复验：`build/verification/computer-use/fixed-1789071090988/`，包含 `title-1.jpg`、`times.jpg`、`description-visible.jpg` 和 `report.json`。
- 一次新草稿测试在第一个检查点发现飞书仍处于前台，明确失败；将**我们自己的预览**激活后重验，没有激活或重启飞书。

**以下有启动参数的早期验收仅保留为诊断记录，不能作为正常启动或产品验收结论。实验启动脚本和 package 入口已经移除。**

### 时间提交修复

Cua 0.26.1 的普通单次坐标点击会先命中 AX 控件并尝试 AXPress；AX 返回 success 后就结束，并不保证发生真实的鼠标焦点/失焦。这使时间输入框的 AXValue 已变，但控件尚未提交。

修复使用 SDK 既有的双击路径编辑文本控件：按当前 AX 几何双击时间字段，用确切 token 设置值，再双击标题字段触发真实失焦。等待该时间字段变回 `AXStaticText` 且保留请求值，然后才判断提交成功。双击仅用于文本编辑，不用于保存或其他业务按钮。

没有删除多窗口键盘拒绝机制，没有采用自制进程键盘注入作为交付路径。直接键盘实验只在忽略目录中；最终固定脚本只使用 Cua 已有能力。通用多窗口键盘仍可能拒绝，但已验证的日程字段不再依赖这条路线。

### 真实模型验收结果

采用现有 Pi 授权的 `openai-codex/gpt-5.6-luna`（medium），从全新空白编辑窗口 22789 开始，19 次工具调用、约 2 分 15 秒完成次日 14:00–14:30 的标题、日期、时间、说明草稿。没有脚本代填，也没有调用日历 API。中途有动作拒绝/未确认，模型依据工具返回的新状态调整后完成；不是每次点击都成功的无误差演示。

`computer_finish` 与会话结束后的第二次读取均通过独立表单校验：两个时间均为 `AXStaticText`，不是尚未提交的文本框。随后另一个观察 runtime 滚动复核顶部日期时间与下方说明，核验通过且飞书 `active=false`；两张画面均已人工查看。每个成功动作的后台状态检查也均为 true。任务退出后 Electron 预览保持连接，并显示后续滚动。

证据：`build/verification/computer-use/draft-result.json`、`draft-trace.json`、`draft-independent-verification.json`、`draft-top.jpg`、`draft-description.jpg`。模型未保存日程或添加参会人。收尾已明确丢弃本轮自建草稿（`cleanup.json`），关闭独立预览；没有替换已安装 Syntropic，也没有启动主项目开发服务。

**日历范围限制：** 模型观察到选择器只显示个人日历，没有找到“Syntropic 演示日历”。本轮通过的是未保存草稿，不是演示日历写入；后续需要确认客户端可写日历的范围，不能用当前个人日历草稿代替原定业务链路。

### 模型核验不能只相信完成声明

第一轮普通启动下模型调用了 21 次工具并自报完成，但事后 AX 核对发现两个时间仍是 `AXTextField`，说明内容也只在高度为 2 的隐藏富文本输入框中。该轮**未通过**；不能用模型声明或截图中 14:00 的字样当作表单提交证据。历史输出保存在 `build/verification/computer-use/model-first-unverified/`，其中 `completed` 是当时模型的声明。

为此，工具层拒绝带 elementToken 的双击（Cua 的此路径忽略 count），操作失败后立即返回新读取的 AX 与画面，避免旧 token 被反复使用。`computer_finish` 独立检查标题、日期、时间离开编辑状态后的值，以及已经显示的说明；未通过时返回具体缺项，模型必须继续修正或如实报告失败。没有替模型自动填写，也没有重放失败的写入动作。

### 持续采集与查看生命周期

- `window-stream.swift`：用 ScreenCaptureKit display-inclusion 捕获确切飞书窗口，最大边 1440、输出上限约 5 fps。JPEG 通过管道传输，不落盘、不录音。
- `window-stream.mjs`：原生进程、帧验证与窗口级引用计数；开发入口按源码指纹编译，安装包必须预先提供签名组件。
- `capture-host.mjs` / `capture-connection.mjs`：以权限限制的本地 Unix socket 共享采集。Electron 查看窗口和 Node 任务复用同一条流，最后一个订阅者退出后才释放；窗口切换等待服务确认旧订阅释放；服务内租约变更串行化，最后一条原生流真正停止前不接受新源。
- 客户端退出/崩溃会断开 socket；无订阅者时服务自行退出。目标关闭、隐藏、移出支持的显示器区域、采集失败均停止展示旧画面并阻止继续输入。

本机曾复现不同进程分别启动 SCStream 后，结束一路导致另一路出现 `-3805`。已通过共享服务消除同窗重复采集，并验证独立子进程关闭订阅后另一进程继续收到画面。原型当前只允许一个活动源窗口；切换源窗口须先释放旧窗口订阅。它尚未实现多任务同时操作多个原生窗口。最终额外验证了：同窗两个订阅释放一个后继续采集，以及最后一个订阅释放尚未完成时请求另一个源窗口；串行等待后新源采集成功，证据为 `capture-handoff.json`。

主窗口复验还修复了缩放取整差异：1316×750 点的窗口应输出 1440×821 像素，旧实现截断成 820 导致被误判为尺寸变化。现按实际显示器像素密度缩放并四舍五入，与 Cua 坐标几何一致；重新编译后主窗口只读探针通过（`probe.json`、`feishu-probe.jpg`）。

采集监控原生窗口几何并更新裁切。窗口必须完整位于同一显示器内；跨显示器或越界的完整产品交互尚未验收。Syntropic 内部 Spaces 的预览拖动不移动源窗口，不受这个位置约束影响。

### 历史 A：有启动参数的诊断记录

2026-09-11，本轮没有调用模型、没有保存日程、没有添加参会人或发送邀请。

| 项目 | 实测结果 | 边界 |
| --- | --- | --- |
| 同进程多窗口输入 | 用当前 AX 快照中的控件 token 写入中文标题、起止时间、富文本说明 | 未取消 `same_pid_keyboard_ambiguity` 检查；通用按键仍可能拒绝 |
| 日期选择 | AX 控件几何转换成当前截图坐标，打开日期选择器并选中次日 | 当前固定脚本仅覆盖同月日期，不猜测跨月控件 |
| 完全遮挡的画面 | 临时启动参数开启后，标题三次变化、日期、时间、滚动后的说明均在图像中确认 | 当前本机飞书验证有效；默认启动、隐藏、最小化和其他原生 Space 不在通过范围内 |
| 滚动 | Cua 的定向后台滚动显示下方中文说明，随后确认飞书 `active=false` | 没有前台回退；不能推广到所有 Electron/Chromium 应用 |
| 独立预览 | 不透明窗口覆盖工作区，显示同一原生编辑窗口的持续采集画面 | 开发原型；未接入 Syntropic 正式浮窗和 Spaces |

固定步骤每次只派发一个动作，随后有界轮询 AX 后置条件；观察超时不重复提交动作。每个检查点确认目标进程 `active=false` 并保存截图。图像内容由实际查看核验，不能以文件变化或帧时间戳替代视觉核验。完整草稿字段检查约 40 秒（单个样本，非性能保证）。随后补验滚动后的说明画面；第二次完整固定脚本也已通过，含后台滚动及全部七个检查点。

本轮证据在 Git 忽略的 `build/verification/computer-use/fixed-1789068245736/`：`report.json`、`title-1.png`、`title-2.png`、`title-3.png`、`date.png`、`times.png`。滚动后的说明图像归档为该目录下的 `description-visible.png`。`description.png` 是滚动前画面，不能用它证明说明可见。

第二次完整复验证据在 `build/verification/computer-use/fixed-1789068599949/`（含 `description-visible.png`）。

已退出并丢弃本轮自建的未保存草稿。飞书会保留已关闭编辑器的原生窗口 ID，但 `isOnScreen=false`，适配器拒绝继续采集或输入，避免展示已关闭表单的旧画面。

## 历史 B：撤销启动参数后的采集对照（早于完整表单修复）

启动参数只能用来诊断 Chromium 的遮挡行为；不能要求每个目标 App 重启，也不作为产品前提。实验启动入口已移除。此前的“解决路径”结论过强，改为有条件诊断结果。

现有 Cua 0.26.1 源码使用 `SCScreenshotManager` 配合 `desktopIndependentWindow`。同样的独立窗口 filter 换成持续 `SCStream`，仍不足以解决此前的完全遮挡旧画面。Apple 另有按显示器筛选指定窗口的官方路径：`SCContentFilter(display:including:)`。本轮将其与独立窗口模式做了同进程对照，两组均使用相同的 opaque/shadow 配置。

### 无参数本机实测

飞书进程 32446 的命令为 `/Applications/Lark.app/Contents/MacOS/Feishu`，不含实验参数。确切编辑器窗口 22450。独立不透明 Electron 窗口 22454 覆盖整个工作区；其 frame 包含编辑器，zIndex 208 高于编辑器 204，目标飞书 `active=false`。对照过程中未切换目标进程或窗口、未激活飞书。

| 顺序 | 采集方式 | 结果 |
| --- | --- | --- |
| A | 持续 SCStream，display including target，并裁切至目标窗口 | 完全遮挡时图像确认标题 03 更新 |
| B | 持续 SCStream，desktopIndependentWindow | 派发标题 04 后，AX 和图像仍停在 03；图像有新的接收时间戳 |
| A | 同一目标切回 display including target | 没有再次派发输入，图像及 AX 出现标题 04 |
| 表单复验 | 持续 display stream + 现有 Cua 输入/检查点截图 | 三次标题、日期成功；时间框 AX 值改变，但失焦未稳定提交，完整脚本失败 |

因此，已找到**不修改、不重启目标 App 的有效采集路线**；不能据此声称所有原生 App 或完整日程流程均已通过。B 组的 AX 也延迟，说明观察/执行时机受到影响；不能只把问题解释为图片缓存。无参数复验再次确认通用 Return 被 Cua 以 `same_pid_keyboard_ambiguity` 拒绝；不能把 AX set_value 当作所有控件的通用键盘替代。

证据均在忽略目录 `build/verification/computer-use/`：

- `no-flags-display-repeat/title-03.png`：A 组更新。
- `no-flags-independent-repeat/stale-after-04.png` 及同名 JSON：B 组旧内容与接收时刻。
- `no-flags-display-resume/recovered-04.png`：只切采集后恢复。
- `fixed-1789069233701/`：无参数完整表单尝试，report 明确记录时间失焦失败；不得归类为通过。

当前 display 探针要求窗口完全位于同一显示器内，sourceRect 在开始时确定；尚未实现移动/缩放、跨显示器和新弹窗的动态跟踪。它是保留的采集对照工具；独立预览现已接入上述共享持续采集服务。采集结束可能由系统提前终止，探针现在将“已停止”记录为生命周期事件，避免结束时崩溃。

测试收尾：已丢弃本轮自建草稿，窗口枚举只剩飞书主窗口；已关闭独立预览及采集探针，飞书仍为普通启动。未调用模型、保存日程或发送邀请。Swift 探针重新编译、13 项驱动测试、改动脚本 ESLint 和项目 TypeScript 检查均通过。

### 研究出处与复用判断

- [Apple ScreenCaptureKit 官方演讲](https://developer.apple.com/videos/play/wwdc2022/10155/)：说明独立窗口和显示器包含筛选两种路径、遮挡及最小化语义。
- [OpenAI Codex 公开问题 #44231](https://github.com/openai/codex/issues/44231)：第三方提交者报告 display filter/sourceRect 行为并给出两种 API 对照，提供本轮实验线索；不是 OpenAI 对 ChatGPT 内部实现的官方说明。
- [Cua 点击实现](https://github.com/trycua/cua/blob/b4e3caecd709311d613dde29ddac03e29468bb38/libs/cua-driver/rust/crates/platform-macos/src/tools/click.rs)：单次坐标点击有 AXPress 快捷路径；count 仅作用于像素路径。
- [Cua 捕获实现](https://github.com/trycua/cua/blob/b4e3caecd709311d613dde29ddac03e29468bb38/libs/cua-driver/rust/crates/platform-macos/src/capture.rs)：当前 SDK 缓存 filter/config，不缓存图像。控制层继续复用，采集层需要小型适配。
- [Chromium macOS 遮挡设计](https://www.chromium.org/developers/design-documents/mac-occlusion/)：解释渲染节流背景，不构成对当前飞书内部实现的完整证明。
- 同时审阅 [mac-cua](https://github.com/hyprcat/mac-cua) 的采集源码，主要路径也是独立窗口截图，不能仅换框架就断言解决。虚拟显示器方案属于后备架构，本轮未创建虚拟显示器或移动用户窗口。

## 重复验收

先在本轮专用的未保存草稿中设置一个可识别的测试标题，通过只读探针或手动控制台获得确切窗口 ID：

```sh
npm run computer:manual
# 逐行输入 JSON：{"op":"windows"} 等，不执行 eval。
npm run computer:preview -- --calendar-editor --occlusion-test
# 点击连接飞书；不透明预览窗口覆盖工作区。
npm run computer:verify -- --window-id=窗口ID --expected-title=刚刚设置的测试标题
npm run test:computer
```

`computer:verify` 必须显式提供窗口 ID 和现有测试标题，拒绝不匹配的草稿；会修改该测试草稿，成功后保留供人工检查，不保存、不选日历、不添加参会人。它不是生产环境的日程编排脚本。固定步骤以当前 AX 语义、布局及可观察变化定位，不使用大模型或固定屏幕坐标。遇到不适配的布局会停止。

`electron/computer-use/stream-probe.swift` 仅用于只读采集对照，没有成为产品依赖：

```sh
xcrun swiftc -parse-as-library electron/computer-use/stream-probe.swift -o build/verification/computer-use/stream-probe
build/verification/computer-use/stream-probe 飞书PID 窗口ID build/verification/computer-use/stream-comparison 60 display
# 最后参数可换为 independent，必须分开运行以免另一条流改变被测状态。
```

21 项驱动和草稿核验测试通过，覆盖目标身份、旧快照、拒绝后不重试、关闭清理、AX 无需录屏、滚动坐标约束、关闭窗口保留 ID、拒绝将控件双击降成 AXPress，以及不能将未提交时间或隐藏富文本判为完成。改动文件 ESLint、项目 TypeScript 检查通过；没有启动 Next 或执行生产构建。开发 Node/Electron 的权限结果不等于正式安装版授权验收。

## 后续阶段

1. 普通启动下模型无关整段验收、真实模型 AX 优先草稿流程均已通过，不再以启动参数为前提。
2. 接入实际会议任务，先确认客户端对目标演示日历的写入权限。GUI 写入、API 读取核验，处理保存响应不确定时的去重。不能以表单填写成功代替日程保存成功。
3. 正式悬浮小窗：执行进度、操作位置、暂停/继续/停止、缩放以及与任务独立的查看生命周期。
4. Syntropic 内部 Spaces、窗口跨桌面拖放及放大。移动或隐藏预览只改变查看位置，不隐藏本机飞书、不重启采集或执行会话；工作台数据范围与桌面归属分开。
5. 端到端演示及独立安装包验证，检查原生依赖收集、签名、权限身份、启动准备和退出清理。
