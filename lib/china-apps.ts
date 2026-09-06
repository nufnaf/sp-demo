import type { AppStorePackage } from "./app-store-types";

export type ChinaConnectorAppId =
  | "wecom" | "dingtalk" | "beisen" | "boss-zhipin" | "wps" | "tencent-docs" | "tencent-meeting"
  | "tonghuashun" | "wind" | "eastmoney"
  | "pkulaw" | "huayu-law" | "qichacha" | "tianyancha";

export interface ConnectorAuthField {
  name: string;
  label: string;
  placeholder: string;
  optional?: boolean;
  inputType?: "password" | "text" | "url";
  defaultValue?: string;
}

export interface ChinaAppDefinition {
  id: ChinaConnectorAppId | "feishu";
  name: string;
  description: string;
  category: "企业协同" | "金融数据" | "法律服务";
  icon: string;
  color: string;
  rank: number;
  delivery: "connector" | "builtin";
  authMode: "cli" | "mcp" | "openapi";
  officialUrl: string;
  logoUrl: string;
  fields: ConnectorAuthField[];
  capabilities: string[];
  scopes: string[];
  authorization: {
    kind: "oauth" | "browser-token" | "enterprise";
    title: string;
    description: string;
    actionUrl?: string;
    actionLabel?: string;
  };
}

const MCP_URL: ConnectorAuthField = { name: "mcpUrl", label: "MCP Server 地址", placeholder: "https://mcp.example.cn/mcp", inputType: "url" };
const ACCESS_TOKEN: ConnectorAuthField = { name: "accessToken", label: "访问令牌", placeholder: "仅保存在当前设备", inputType: "password" };

export const CHINA_APPS: ChinaAppDefinition[] = [
  { id: "feishu", name: "飞书", description: "消息、文档、多维表格、日历与会议协作", category: "企业协同", icon: "飞", color: "#3370ff", rank: 10, delivery: "builtin", authMode: "cli", officialUrl: "https://open.feishu.cn/document/no_class/mcp-archive/feishu-cli-installation-guide.md", logoUrl: "/icons/feishu-logo.svg", fields: [], capabilities: ["消息", "云文档", "多维表格", "日历", "会议"], scopes: ["由飞书官方 CLI 按需申请权限"], authorization: { kind: "oauth", title: "使用飞书扫码授权", description: "官方 CLI 提供设备授权，用户无需填写 Client ID 或 Secret。" } },
  { id: "wecom", name: "企业微信", description: "企业通讯录、客户联系、群聊与办公协作", category: "企业协同", icon: "企", color: "#2aae67", rank: 20, delivery: "connector", authMode: "cli", officialUrl: "https://github.com/WecomTeam/wecom-cli", logoUrl: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/45/b0/2f/45b02fee-785a-5081-6cb4-ca85544d6eec/AppIcon-0-0-1x_U007epad-0-1-0-sRGB-85-220.png/512x512bb.jpg", fields: [], capabilities: ["通讯录", "消息", "客户联系", "群聊"], scopes: ["由企业微信官方 CLI 在扫码时展示并确认"], authorization: { kind: "oauth", title: "使用企业微信扫码授权", description: "自动安装官方 wecom-cli，扫码后即可连接，无需填写 Corp ID、Agent ID 或 Secret。" } },
  { id: "dingtalk", name: "钉钉", description: "组织通讯录、群消息、审批与日程", category: "企业协同", icon: "钉", color: "#1677ff", rank: 30, delivery: "connector", authMode: "cli", officialUrl: "https://github.com/DingTalk-Real-AI/dingtalk-workspace-cli", logoUrl: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/93/d3/dd/93d3ddc5-3118-09d0-4604-bf8b74bcc562/AppIcon-0-0-1x_U007epad-0-1-0-sRGB-85-220.png/512x512bb.jpg", fields: [], capabilities: ["通讯录", "群消息", "审批", "日程"], scopes: ["由钉钉官方 DWS CLI 在设备授权时展示并确认"], authorization: { kind: "oauth", title: "使用钉钉账号授权", description: "自动安装官方 DWS CLI，通过浏览器或扫码选择组织并确认权限，无需填写 AppKey 或 Secret。" } },
  { id: "beisen", name: "北森 iTalent", description: "招聘、审批、员工档案、考勤与人才管理", category: "企业协同", icon: "北", color: "#00a7a0", rank: 35, delivery: "connector", authMode: "cli", officialUrl: "https://www.beisen.com/product/cli", logoUrl: "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/65/e4/a2/65e4a2f4-0ac1-3297-bd7e-297e049476f0/AppIcon2-0-0-1x_U007emarketing-0-8-0-sRGB-85-220.png/512x512bb.jpg", fields: [], capabilities: ["招聘管理", "审批", "员工档案", "考勤休假", "组织架构", "企业知识"], scopes: ["以北森账号及所在企业配置的业务权限为准"], authorization: { kind: "oauth", title: "使用北森账号授权", description: "自动安装北森官方 CLI，通过官方浏览器页面完成账号授权，无需填写 App Key 或 Secret。" } },
  { id: "boss-zhipin", name: "BOSS 直聘", description: "职位、候选人、沟通与招聘流程", category: "企业协同", icon: "B", color: "#19b7ad", rank: 37, delivery: "connector", authMode: "cli", officialUrl: "https://github.com/joohw/boss-cli", logoUrl: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/18/f2/91/18f2917d-452a-a2fa-87d7-37012a288cab/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg", fields: [], capabilities: ["职位管理", "候选人", "沟通", "简历", "人才搜索"], scopes: ["复用用户本机 BOSS 直聘网页账号可访问的数据"], authorization: { kind: "oauth", title: "扫码连接 BOSS 直聘", description: "社区 CLI 会打开 BOSS 直聘官方登录页供用户扫码；这是 OAuth 式引导流程，但不是 BOSS 官方 OAuth 或官方连接器。" } },
  { id: "wps", name: "WPS 365", description: "云文档、日历、邮件、会议与协作消息", category: "企业协同", icon: "W", color: "#e8463a", rank: 40, delivery: "connector", authMode: "mcp", officialUrl: "https://open.wps.cn/documents/app-integration-dev/mcp-server/introduction", logoUrl: "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/3a/b1/95/3ab19544-8745-f31d-d603-855770e470d0/AppIcon-0-0-1x_U007epad-0-1-0-sRGB-0-0-85-220.png/512x512bb.jpg", fields: [{ ...MCP_URL, defaultValue: "https://openapi.wps.cn/mcp/v2/kso-doc/message" }, { ...ACCESS_TOKEN, optional: true }], capabilities: ["云文档", "日历", "邮件", "会议", "协作消息"], scopes: ["WPS 365 开放平台中已审批的 MCP 权限"], authorization: { kind: "oauth", title: "使用 WPS 账号授权", description: "跳转到 WPS 官方页面确认权限，完成后自动返回，无需复制 Token。" } },
  { id: "tencent-docs", name: "腾讯文档", description: "在线文档、表格、智能表格与空间管理", category: "企业协同", icon: "文", color: "#1e6fff", rank: 50, delivery: "connector", authMode: "mcp", officialUrl: "https://developer.cloud.tencent.com/mcp/server/11803", logoUrl: "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/f5/fc/20/f5fc2005-360b-574b-b599-19acff6617b7/AppIcon-0-0-1x_U007epad-0-11-0-0-sRGB-GLES2_U002c0-85-220.png/512x512bb.jpg", fields: [{ ...MCP_URL, defaultValue: "https://docs.qq.com/openapi/mcp", optional: true }, ACCESS_TOKEN], capabilities: ["文档", "表格", "智能表格", "空间目录"], scopes: ["腾讯文档授权空间内的文档与表格"], authorization: { kind: "browser-token", title: "在腾讯文档获取授权", description: "官方 MCP 当前使用个人 Token。打开官方页面登录并生成 Token，然后粘贴回来即可。", actionUrl: "https://docs.qq.com/open/auth/mcp.html", actionLabel: "打开腾讯文档授权页" } },
  { id: "tencent-meeting", name: "腾讯会议", description: "会议预约、参会人、录制、逐字稿与纪要", category: "企业协同", icon: "会", color: "#2b6de5", rank: 60, delivery: "connector", authMode: "mcp", officialUrl: "https://cloud.tencent.com/document/product/1095/133826", logoUrl: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/22/fb/ad/22fbad82-7f7c-0652-8fb2-cac14b3ba4ed/AppIcon-Release-0-0-1x_U007epad-0-9-0-0-85-220.png/512x512bb.jpg", fields: [{ ...MCP_URL, defaultValue: "https://mcp.meeting.tencent.com/mcp", optional: true }, { ...ACCESS_TOKEN, label: "腾讯会议 Token" }], capabilities: ["会议管理", "成员查询", "录制", "逐字稿", "会议纪要"], scopes: ["以当前腾讯会议账号管理会议并读取录制与纪要"], authorization: { kind: "browser-token", title: "使用腾讯会议账号授权", description: "官方 CLI 已支持浏览器 OAuth；当前 MCP 可在官方页面生成个人 Token。", actionUrl: "https://meeting.tencent.com/ai-skill.html", actionLabel: "打开腾讯会议授权页" } },
  { id: "tonghuashun", name: "同花顺", description: "行情、研报、公告与量化数据服务", category: "金融数据", icon: "同", color: "#e53935", rank: 110, delivery: "connector", authMode: "mcp", officialUrl: "https://quantapi.10jqka.com.cn/gwstatic/static/ds_web/quantapi-web/", logoUrl: "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/77/76/80/777680c7-05a3-474e-30a3-0e13924990ad/AppIcon-0-0-1x_U007emarketing-0-8-0-sRGB-85-220.png/512x512bb.jpg", fields: [MCP_URL, ACCESS_TOKEN], capabilities: ["行情", "研报", "公告", "量化数据"], scopes: ["以机构合同和数据许可为准"], authorization: { kind: "enterprise", title: "需要数据接口账号", description: "同花顺数据接口按账号与机构许可开通，未提供可供第三方应用接入的公开 OAuth。", actionUrl: "https://quantapi.10jqka.com.cn/gwstatic/static/ds_web/quantapi-web/", actionLabel: "登录同花顺数据接口" } },
  { id: "wind", name: "Wind 万得", description: "宏观、证券、基金、债券与企业金融数据", category: "金融数据", icon: "W", color: "#d71920", rank: 120, delivery: "connector", authMode: "mcp", officialUrl: "https://www.wind.com.cn/portal/zh/ClientApi/index.html", logoUrl: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/21/bf/ae/21bfae2a-e5ad-c539-e3a6-d89780eedd3d/AppIconIPhone-0-0-1x_U007emarketing-0-10-0-0-sRGB-85-220.png/512x512bb.jpg", fields: [MCP_URL, ACCESS_TOKEN, { name: "cliPath", label: "Wind CLI/终端路径", placeholder: "可选：本机已安装组件路径", optional: true, inputType: "text" }], capabilities: ["宏观数据", "证券", "基金", "债券", "企业数据"], scopes: ["以 Wind 账号、终端和数据许可为准"], authorization: { kind: "enterprise", title: "使用现有 Wind 许可", description: "Wind Client API 依赖已授权的终端或机构数据服务，目前没有公开第三方 OAuth。", actionUrl: "https://www.wind.com.cn/portal/zh/ClientApi/index.html", actionLabel: "查看 Wind Client API" } },
  { id: "eastmoney", name: "东方财富", description: "沪深行情、公告、资讯与投资数据", category: "金融数据", icon: "东", color: "#e9352b", rank: 130, delivery: "connector", authMode: "mcp", officialUrl: "https://choice.eastmoney.com/", logoUrl: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/cf/47/77/cf47775d-2bc8-5488-64b9-dc20708c4920/AppIcon-0-0-1x_U007ephone-0-11-0-0-sRGB-85-220.png/512x512bb.jpg", fields: [MCP_URL, ACCESS_TOKEN], capabilities: ["沪深行情", "公告", "资讯", "投资数据"], scopes: ["以开放平台或企业数据协议为准"], authorization: { kind: "enterprise", title: "需要 Choice 数据许可", description: "公开资料仅提供量化接口与机构数据服务，未发现可供第三方应用使用的 OAuth。", actionUrl: "https://choice.eastmoney.com/", actionLabel: "查看 Choice 数据服务" } },
  { id: "pkulaw", name: "北大法宝", description: "法律法规、司法案例、行政执法与法学文献", category: "法律服务", icon: "法", color: "#9d1b28", rank: 210, delivery: "connector", authMode: "mcp", officialUrl: "https://mcp.pkulaw.com/", logoUrl: "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/77/6d/e8/776de8fc-7d2f-11e6-3eec-1b75760cf163/AppIcon-0-0-1x_U007emarketing-0-6-0-85-220.png/512x512bb.jpg", fields: [MCP_URL, ACCESS_TOKEN], capabilities: ["法律法规", "司法案例", "行政执法", "法学文献"], scopes: ["以北大法宝机构账号的数据授权为准"], authorization: { kind: "enterprise", title: "需要北大法宝 MCP 授权", description: "官方已提供 MCP 服务，但公开页面未声明标准 OAuth，授权方式以机构账号与合同为准。", actionUrl: "https://mcp.pkulaw.com/", actionLabel: "打开北大法宝 MCP" } },
  { id: "huayu-law", name: "华宇法典", description: "法规检索、案例分析与司法知识服务", category: "法律服务", icon: "典", color: "#244b8c", rank: 220, delivery: "connector", authMode: "mcp", officialUrl: "https://www.thunisoft.com/", logoUrl: "https://www.thunisoft.com/r/cms/www/hyxxgw/img/logo.png", fields: [MCP_URL, ACCESS_TOKEN], capabilities: ["法规检索", "案例分析", "司法知识"], scopes: ["以华宇法典企业授权范围为准"], authorization: { kind: "enterprise", title: "需要企业项目授权", description: "未发现面向通用第三方客户端的公开 OAuth，通常由华宇项目或企业管理员配置。", actionUrl: "https://www.thunisoft.com/", actionLabel: "联系华宇获取接入方案" } },
  { id: "qichacha", name: "企查查", description: "工商、股东、风险、司法与企业关系数据", category: "法律服务", icon: "企", color: "#f05a28", rank: 230, delivery: "connector", authMode: "openapi", officialUrl: "https://openapi.qcc.com/", logoUrl: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/c6/d9/b5/c6d9b55d-d6b1-3a4f-e483-376e1177902d/AppIcon-0-0-1x_U007epad-0-1-0-85-220.png/512x512bb.jpg", fields: [{ name: "appKey", label: "AppKey", placeholder: "开放平台 AppKey", inputType: "text" }, { name: "secretKey", label: "SecretKey", placeholder: "仅保存在当前设备", inputType: "password" }, { ...MCP_URL, optional: true }], capabilities: ["工商信息", "股东穿透", "风险", "司法案件", "企业关系"], scopes: ["以企查查开放平台已购接口为准"], authorization: { kind: "enterprise", title: "需要已购 API 套餐", description: "企查查开放平台使用 AppKey/SecretKey 鉴权，未公开面向终端用户的 OAuth。", actionUrl: "https://openapi.qcc.com/", actionLabel: "打开企查查开放平台" } },
  { id: "tianyancha", name: "天眼查", description: "企业工商、关联关系、经营风险与司法信息", category: "法律服务", icon: "天", color: "#2586d7", rank: 240, delivery: "connector", authMode: "openapi", officialUrl: "https://open.tianyancha.com/", logoUrl: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/9e/2a/3d/9e2a3d17-f6ae-187a-b45f-ada8d5d7da51/AppIcon-0-0-1x_U007emarketing-0-3-0-85-220.png/512x512bb.jpg", fields: [{ name: "token", label: "开放平台 Token", placeholder: "仅保存在当前设备", inputType: "password" }, { ...MCP_URL, optional: true }], capabilities: ["工商信息", "关联关系", "经营风险", "司法信息"], scopes: ["以天眼查开放平台已购接口为准"], authorization: { kind: "enterprise", title: "需要已购 API Token", description: "天眼查开放接口使用 Authorization Token，未提供第三方 OAuth 授权流程。", actionUrl: "https://open.tianyancha.com/", actionLabel: "打开天眼查开放平台" } },
];

export const CHINA_CONNECTOR_APPS = CHINA_APPS.filter((app): app is ChinaAppDefinition & { id: ChinaConnectorAppId; delivery: "connector" } => app.delivery === "connector");

export function isChinaConnectorAppId(value: string): value is ChinaConnectorAppId {
  return CHINA_CONNECTOR_APPS.some((app) => app.id === value);
}

export function getChinaAppDefinition(id: string): ChinaAppDefinition | undefined {
  return CHINA_APPS.find((app) => app.id === id);
}

export function chinaAppStorePackages(): AppStorePackage[] {
  return CHINA_APPS.map((app) => ({
    packageName: `cn.agentos.${app.id}`,
    source: `${app.delivery}:${app.id}`,
    name: app.name,
    description: app.description,
    author: "官方/企业连接器",
    monthlyDownloads: 0,
    downloadsLabel: app.delivery === "builtin" ? "内置" : "中国区",
    updatedLabel: "持续维护",
    types: ["connector"],
    catalogUrl: app.officialUrl,
    npmUrl: app.officialUrl,
    logoUrl: app.logoUrl,
    delivery: app.delivery,
    connectionId: app.id,
    category: app.category,
    capabilities: app.capabilities,
  }));
}
