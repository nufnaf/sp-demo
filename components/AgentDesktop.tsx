"use client";
import { FeishuDemoApp, FeishuDemoDocument } from "./FeishuDemoApp";
import { PresentationSchedule } from "./RecruitingPipeline";

import { SyntropicMark } from "./SyntropicMark";
import { DesktopDesignIcon } from "./DesktopDesignIcon";
import { DesktopStartStage } from "./DesktopStartStage";
import { DesktopComposerInput } from "./DesktopComposerInput";
import { DesktopDock } from "./DesktopDock";
import { isJdDemoArtifact } from "@/lib/recruiting-publication";
import { DesktopWorkspaceWidgets, workspaceReference, type WorkspaceWidgetItem } from "./DesktopWorkspaceWidgets";
import { DesktopCollaboration } from "./DesktopCollaboration";
import { compactDesktopTurns } from "@/lib/desktop-conversation";

import dynamic from "next/dynamic";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { AppShell } from "./AppShell";
import { fitWindow, resizeWindow, type ResizeEdge, type WindowFrame, type WindowArea } from "@/lib/window-geometry";
import { APP_LOGO_GLYPHS } from "./AppLogoGlyphs";
import { AppStore, AppStoreBrandIcon } from "./AppStore";
import { clearDesktopReminders, DesktopReminders } from "./DesktopReminders";
import { DraggableDesktopWidget } from "./DraggableDesktopWidget";
import { FileViewer } from "./FileViewer";
import { extractTurnWrittenFiles } from "@/lib/turn-written-files";
import { getFileName } from "@/lib/file-paths";
import { BUILTIN_LAUNCHPAD_APPS, getLaunchpadApps, toConnectorLaunchpadApp, type ConnectorLaunchpadApp, type LaunchpadApp, type LaunchpadCategory, type PluginLaunchpadApp } from "@/lib/launchpad-apps";
import type { AppConnectResponse, AppConnectionStatus, AppDataResponse, ConnectedAppId } from "@/lib/app-connection-types";
import type { PluginsResponse } from "@/lib/api-types";
import type { AgentMessage, SessionContext, SessionInfo, ToolResultMessage } from "@/lib/types";
import { useRealtimeVoice } from "@/hooks/useRealtimeVoice";
import { useDesktopNotice } from "@/hooks/useDesktopNotice";
import { useJarvis, type JarvisTask } from "@/hooks/useJarvis";
import { useDictation } from "@/hooks/useDictation";
import { VoiceOrb } from "./VoiceOrb";
import { BrowserApp } from "./BrowserApp";
import { SalesCRMApp } from "./SalesCRMApp";
import { InsightsApp } from "./InsightsApp";
import { HRRecruitingApp } from "./HRRecruitingApp";
import { RecruitingPublication } from "./RecruitingPublication";
import { DesktopNotification } from "./DesktopNotification";
import { subscribeBrowserEvents } from "@/lib/browser/client-events";
import { InvestmentWorkspaceApp } from "./InvestmentWorkspaceApp";
import type { BrowserSystemEvent, BrowserTaskState } from "@/lib/browser/types";
import { captureBrowserOrigin, isBrowserOriginCurrent, browserReturnDestination, type BrowserReturnOrigin } from "@/lib/browser/return-to-origin";
import type { FileOpenRequest } from "@/lib/files-app/types";
import {
  isInsightTaskSession,
  type InsightResult,
} from "@/lib/insight-automation";
import "./AgentDesktop.css";

const AgentSettingsApp = dynamic(
  () => import("./AgentSettingsApp").then((module) => module.AgentSettingsApp),
  {
    ssr: false,
    loading: () => <div className="agent-settings-loading" role="status">正在打开设置…</div>,
  },
);

const FilesApp = dynamic(
  () => import("./FilesApp").then((module) => module.FilesApp),
  {
    ssr: false,
    loading: () => <div className="agent-settings-loading" role="status">正在打开文件…</div>,
  },
);

const TerminalApp = dynamic(
  () => import("./TerminalApp").then((module) => module.TerminalApp),
  {
    ssr: false,
    loading: () => <div className="agent-settings-loading" role="status">正在打开终端…</div>,
  },
);

type IconName =
  | "arrow-up" | "bell" | "chat" | "chevron-down" | "clock" | "close"
  | "browser"
  | "eye" | "file" | "folder" | "grid" | "insight" | "list" | "maximize" | "mic" | "minimize" | "waveform"
  | "sales" | "files" | "investment" | "plus" | "recruiting" | "search" | "settings" | "tasks" | "terminal" | "tiles";

type SystemDockAppId = "system:calendar" | "system:crm" | "system:tasks" | "system:library" | "system:hr" | "system:investment" | "system:browser" | "system:files" | "system:terminal" | "system:store" | "system:settings";

interface SystemDockApp {
  kind: "system";
  id: SystemDockAppId;
  name: string;
  description: string;
  category: LaunchpadCategory;
  icon: IconName;
  rank: number;
}

type DockItem = LaunchpadApp | SystemDockApp;

const SYSTEM_DOCK_APPS: SystemDockApp[] = [
  { kind: "system", id: "system:tasks", name: "任务", description: "查看当前正在推进的任务", category: "其他", icon: "tasks", rank: 1 },
  { kind: "system", id: "system:library", name: "产物库", description: "浏览 Agent 生成的文件产物", category: "其他", icon: "files", rank: 2 },
  { kind: "system", id: "system:crm", name: "销售 CRM", description: "管理客户、订单、回款与销售数据洞察", category: "企业协同", icon: "sales", rank: 3.5 },
  { kind: "system", id: "system:hr", name: "人才招聘", description: "统一管理岗位、候选人与招聘数据源", category: "企业协同", icon: "recruiting", rank: 3 },
  { kind: "system", id: "system:investment", name: "投资管理", description: "管理投资公司、投资阶段、公司调研与数据来源", category: "金融数据", icon: "investment", rank: 4 },
  { kind: "system", id: "system:browser", name: "浏览器", description: "和 Agent 共同浏览并操作网页", category: "知识办公", icon: "browser", rank: 5 },
  { kind: "system", id: "system:files", name: "文件", description: "浏览、预览和轻量编辑工作台文件", category: "产品开发", icon: "folder", rank: 6 },
  { kind: "system", id: "system:terminal", name: "终端", description: "在当前工作台运行开发命令", category: "产品开发", icon: "terminal", rank: 7 },
  { kind: "system", id: "system:store", name: "应用市场", description: "发现和管理 Syntropic 应用", category: "其他", icon: "grid", rank: 8 },
  { kind: "system", id: "system:settings", name: "设置", description: "配置模型、技能与 Agent", category: "其他", icon: "settings", rank: 9 },
];

const ICONS: Record<IconName, ReactNode> = {
  "arrow-up": <><path d="M12 19V5"/><path d="m6 11 6-6 6 6"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  browser: APP_LOGO_GLYPHS.browser,
  chat: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/></>,
  "chevron-down": <path d="m7 10 5 5 5-5"/>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  close: <path d="m7 7 10 10M17 7 7 17"/>,
  eye: <><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.5"/></>,
  file: <><path d="M6 2h8l4 4v16H6Z"/><path d="M14 2v5h5M9 12h6M9 16h6"/></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
  insight: <><path d="M12 3a7 7 0 0 0-4 12.7V19h8v-3.3A7 7 0 0 0 12 3Z"/><path d="M9 22h6M9 15h6"/></>,
  maximize: <><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"/></>,
  mic: <><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></>,
  waveform: <><path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/></>,
  minimize: <path d="M5 12h14"/>,
  list: <><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="5" cy="6" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="18" r="1"/></>,
  folder: APP_LOGO_GLYPHS.folder,
  files: <><path d="M6 7H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h9"/><path d="M8 3h8l4 4v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M16 3v5h4M10 12h6M10 16h6"/></>,
  sales: <><rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V4h8v3M3 12h18M10 15h4"/></>,
  investment: APP_LOGO_GLYPHS.investment,
  plus: <path d="M12 5v14M5 12h14"/>,
  recruiting: APP_LOGO_GLYPHS.recruiting,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V3h4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
  tasks: <><rect x="3" y="3" width="18" height="18" rx="3.5"/><path d="m6.5 8 1.2 1.2L10 7M13 8h4M6.5 14l1.2 1.2L10 13M13 14h4"/></>,
  terminal: <><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 9 3 3-3 3M13 15h4"/></>,
  tiles: <><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></>,
};

const DICTATION_BARS = [0.35, 0.55, 0.8, 0.6, 1, 0.7, 0.45, 0.85, 0.65, 0.95, 0.5, 0.75, 0.4, 0.9, 0.6, 0.3];

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg className="agent-os-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>;
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`agent-os-brand-mark${compact ? " compact" : ""}`} aria-hidden="true">
      <SyntropicMark size="100%"/>
    </span>
  );
}

interface Artifact {
  filePath: string;
  sessionId: string;
  cwd: string;
  taskTitle: string;
  modified: string;
}

interface SessionDetailResponse {
  context?: SessionContext;
}

interface WorkspaceOption {
  cwd: string;
  name: string;
  managed: boolean;
}

function artifactIdentity(artifact: Artifact): string {
  return `${artifact.sessionId}:${artifact.filePath}`;
}

function taskTitle(session: SessionInfo): string {
  return session.name?.trim() || session.firstMessage?.trim() || "未命名任务";
}

function compactText(value: string, max = 64): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized;
}

function isHtmlArtifact(artifact: Artifact): boolean {
  return /\.html?$/i.test(artifact.filePath);
}

function formatArtifactModified(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatInsightModified(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return new Intl.DateTimeFormat("zh-CN", sameDay
    ? { hour: "2-digit", minute: "2-digit", hour12: false }
    : { month: "numeric", day: "numeric" }).format(date);
}

const LAUNCHPAD_CATEGORIES: Array<"全部" | LaunchpadCategory> = ["全部", "企业协同", "金融数据", "法律服务", "产品开发", "设计协作", "团队协作", "知识办公", "其他"];

function BrandAppIcon({ app }: { app: LaunchpadApp }) {
  if (app.kind === "connector") return <>
    {/* Official connector brand assets are intentionally loaded without Next image optimization. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={app.connector.logoUrl} alt="" referrerPolicy="no-referrer"/>
  </>;
  if (app.appearance === "figma") return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#f24e1e" d="M5 2h7v7H8.5A3.5 3.5 0 0 1 5 5.5Z"/><path fill="#ff7262" d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12Z"/><path fill="#a259ff" d="M5 9h7v7H8.5a3.5 3.5 0 1 1 0-7Z"/><circle cx="15.5" cy="12.5" r="3.5" fill="#1abcfe"/><path fill="#0acf83" d="M5 16h7v3.5A3.5 3.5 0 1 1 5 19.5Z"/></svg>;
  if (app.appearance === "google") return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285f4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.7h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.2Z"/><path fill="#34a853" d="M12 22c2.7 0 5-.9 6.6-2.5l-3.2-2.5c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.8-5.6-4.2H3.1v2.6A10 10 0 0 0 12 22Z"/><path fill="#fbbc05" d="M6.4 13.7a6 6 0 0 1 0-3.4V7.7H3.1a10 10 0 0 0 0 8.6Z"/><path fill="#ea4335" d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.7 9.7 0 0 0 3.1 7.7l3.3 2.6A6 6 0 0 1 12 6.1Z"/></svg>;
  if (app.appearance === "feishu") return <Image src="/icons/feishu-logo.svg" width={48} height={48} unoptimized alt=""/>;
  const paths: Partial<Record<LaunchpadApp["appearance"], ReactNode>> = {
    github: <path d="M12 .3A12 12 0 0 0 8.2 23.7c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C15.3 5 16.3 5.3 16.3 5.3c.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z"/>,
    slack: <path d="M5 15.2a2.5 2.5 0 1 1-2.5-2.5H5Zm1.3 0a2.5 2.5 0 0 1 5 0v6.3a2.5 2.5 0 1 1-5 0ZM8.8 5a2.5 2.5 0 1 1 2.5-2.5V5Zm0 1.3a2.5 2.5 0 0 1 0 5H2.5a2.5 2.5 0 1 1 0-5ZM19 8.8a2.5 2.5 0 1 1 2.5 2.5H19Zm-1.3 0a2.5 2.5 0 0 1-5 0V2.5a2.5 2.5 0 1 1 5 0Zm-2.5 10.1a2.5 2.5 0 1 1-2.5 2.5v-2.5Zm0-1.2a2.5 2.5 0 0 1 0-5h6.3a2.5 2.5 0 1 1 0 5Z"/>,
    notion: <path d="M4.5 4.2c.7.6 1 .6 2.4.5l13.2-.8c.3 0 0-.3 0-.3l-2.2-1.6c-.4-.3-1-.7-2.1-.6L3 2.3c-.5 0-.6.3-.4.5Zm.8 3.1v13.9c0 .7.4 1 1.2 1l14.5-.9c.8 0 .9-.6.9-1.1V6.4c0-.6-.2-.9-.7-.9L6 6.4c-.6 0-.7.3-.7.9Zm14.3.7c.1.4 0 .8-.4.9l-.7.1v10.3c-.6.3-1.2.5-1.7.5-.7 0-.9-.2-1.5-.9l-4.6-7.2v7l1.5.3s0 .8-1.2.8l-3.2.2c-.1-.2 0-.7.3-.7l.9-.3V9.9l-1.2-.1c-.1-.4.2-1 .8-1.1l3.5-.2 4.8 7.2V9.3l-1.3-.1c-.1-.5.3-.9.8-1Z"/>,
    linear: <path d="M2.9 4.2A12 12 0 1 1 19.8 21.1Zm-1.1 1.4 16.6 16.6c-.5.3-1.1.6-1.7.8L1 7.3c.2-.6.5-1.1.8-1.7ZM.3 9.2l14.5 14.5c-.7.2-1.4.3-2.2.3L0 11.4c0-.8.1-1.5.3-2.2ZM.2 14l9.8 9.8A12 12 0 0 1 .2 14Z"/>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[app.appearance] ?? <text x="12" y="16" textAnchor="middle">{app.icon}</text>}</svg>;
}

function AppLogo({ app, compact = false }: { app: LaunchpadApp; compact?: boolean }) {
  return <span className={`agent-os-app-logo is-${app.appearance}${app.kind === "connector" ? " is-official-icon" : ""}${compact ? " is-compact" : ""}`}><BrandAppIcon app={app}/></span>;
}

function DockItemIcon({ item, launchpad = false }: { item: DockItem; launchpad?: boolean }) {
  if (item.kind !== "system") return launchpad ? <BrandAppIcon app={item}/> : <AppLogo app={item} compact/>;
  if (item.id === "system:calendar") return <DesktopDesignIcon name="calendar" size={launchpad ? 46 : 28}/>;
  if (item.id === "system:hr") return <DesktopDesignIcon name="people" size={launchpad ? 46 : 28}/>;
  if (item.id === "system:store") return <AppStoreBrandIcon className={launchpad ? "agent-os-launchpad-system-store" : "agent-store-dock-icon"}/>;
  return <Icon name={item.icon} size={launchpad ? 46 : 22}/>;
}

interface ConnectedAppConfig {
  sections: string[];
  dataLabel: string;
  emptyTitle: string;
  emptyDescription: string;
}

type DataLaunchpadApp = PluginLaunchpadApp | ConnectorLaunchpadApp;

const CONNECTED_APP_CONFIG: Record<PluginLaunchpadApp["appearance"], ConnectedAppConfig> = {
  github: { sections: ["概览", "仓库", "Pull Requests", "Issues"], dataLabel: "代码协作数据", emptyTitle: "还没有载入 GitHub 数据", emptyDescription: "连接 GitHub 账号后，仓库、PR 和 Issue 会集中展示在这里。" },
  figma: { sections: ["最近文件", "项目", "组件", "评论"], dataLabel: "设计协作数据", emptyTitle: "还没有载入 Figma 文件", emptyDescription: "连接 Figma 后，可以在 Syntropic 内浏览文件、组件和评论上下文。" },
  slack: { sections: ["收件箱", "频道", "私信", "搜索"], dataLabel: "团队沟通数据", emptyTitle: "还没有载入 Slack 消息", emptyDescription: "连接工作区后，频道消息、私信和搜索结果会展示在这里。" },
  notion: { sections: ["最近页面", "团队空间", "数据库", "搜索"], dataLabel: "知识库数据", emptyTitle: "还没有载入 Notion 内容", emptyDescription: "连接 Notion 后，页面、数据库和团队知识会展示在这里。" },
  linear: { sections: ["我的事项", "Issues", "项目", "周期"], dataLabel: "研发管理数据", emptyTitle: "还没有载入 Linear 数据", emptyDescription: "连接 Linear 后，Issue、项目与周期进度会展示在这里。" },
  google: { sections: ["邮件", "云端硬盘", "文档", "表格", "幻灯片"], dataLabel: "Google 数据", emptyTitle: "还没有载入 Google 数据", emptyDescription: "连接 Google 账号后，Gmail 与 Workspace 文件会展示在这里。" },
  default: { sections: ["概览", "最近数据", "搜索"], dataLabel: "应用数据", emptyTitle: "还没有载入应用数据", emptyDescription: "完成数据连接后，相关内容会展示在这里。" },
};

function isConnectedAppAppearance(value: DataLaunchpadApp["appearance"]): value is ConnectedAppId {
  return value !== "default";
}

const CONNECTION_FIELDS: Partial<Record<ConnectedAppId, Array<{ name: string; label: string; placeholder: string; optional?: boolean }>>> = {
  github: [{ name: "token", label: "Fine-grained Personal Access Token", placeholder: "github_pat_…" }],
  figma: [{ name: "token", label: "Personal Access Token", placeholder: "figd_…" }],
  slack: [
    { name: "botToken", label: "Bot Token", placeholder: "xoxb-…" },
    { name: "userToken", label: "User Token", placeholder: "xoxp-…", optional: true },
  ],
  linear: [{ name: "token", label: "Personal API Key", placeholder: "lin_api_…" }],
  google: [
    { name: "clientId", label: "OAuth Client ID", placeholder: "…apps.googleusercontent.com" },
    { name: "clientSecret", label: "OAuth Client Secret", placeholder: "GOCSPX-…" },
  ],
};

function ConnectionPanel({ app, status, busy, error, onClose, onConnect, onDisconnect }: {
  app: DataLaunchpadApp;
  status: AppConnectionStatus | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConnect: (values: Record<string, string>) => void;
  onDisconnect: () => void;
}) {
  const appId = isConnectedAppAppearance(app.appearance) ? app.appearance : null;
  const fields = app.kind === "connector" ? app.connector.fields : appId ? CONNECTION_FIELDS[appId] ?? [] : [];
  const [values, setValues] = useState<Record<string, string>>(() => app.kind === "connector"
    ? Object.fromEntries(app.connector.fields.filter((field) => field.defaultValue).map((field) => [field.name, field.defaultValue!]))
    : {});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const connected = status?.state === "connected";
  const connectorAuthorization = app.kind === "connector" ? app.connector.authorization : null;
  const isOAuth = appId === "notion" || appId === "google" || connectorAuthorization?.kind === "oauth";
  const visibleFields = app.kind !== "connector"
    ? fields
    : connectorAuthorization?.kind === "browser-token"
      ? fields.filter((field) => field.name !== "mcpUrl")
      : showAdvanced ? fields : [];
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onConnect(values);
  };

  return <div className="agent-os-connection-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="agent-os-connection-panel" role="dialog" aria-modal="true" aria-label={`管理 ${app.name} 连接`}>
      <header><AppLogo app={app}/><span><strong>{connected ? `${app.name} 已连接` : `连接 ${app.name}`}</strong><small>授权信息只保存在此设备，并供 Syntropic 连接器使用。</small></span><button type="button" onClick={onClose} aria-label="关闭"><Icon name="close" size={16}/></button></header>
      <div className="agent-os-connection-body">
        <div className={`agent-os-connection-state is-${status?.state ?? "connecting"}`}><i/><span><strong>{status?.account ?? (connected ? "连接有效" : "等待授权")}</strong><small>{status?.detail ?? "正在检查连接状态…"}</small></span></div>
        {status?.dependency ? <p className="agent-os-connection-dependency"><strong>运行依赖：</strong>{status.dependency}</p> : null}
        {connected ? <>
          <div className="agent-os-connection-scopes"><strong>授权后可读取</strong>{status.scopes.map((scope) => <span key={scope}><i/> {scope}</span>)}</div>
          <button className="agent-os-connection-danger" type="button" disabled={busy} onClick={onDisconnect}>断开连接</button>
        </> : <form onSubmit={submit}>
          {appId === "notion" ? <p className="agent-os-connection-help">点击后将打开 Notion 官方授权页面。你可以在 Notion 中选择 Syntropic 能访问的页面与团队空间。</p> : null}
          {appId === "google" ? <p className="agent-os-connection-help">在 Google Cloud 创建“Web application”OAuth 凭据，并加入以下 Authorized redirect URI。授权范围包含 Gmail 只读以及 Drive、Docs、Sheets 与 Slides。<code className="agent-os-connection-uri">{`${window.location.origin}/api/apps/google/oauth/callback`}</code></p> : null}
          {appId === "slack" ? <p className="agent-os-connection-help">Bot Token 用于频道数据；User Token 仅用于全局消息搜索，可留空。Bot 还需被邀请进入要读取的频道。</p> : null}
          {appId === "github" && status?.state === "setup_required" ? <p className="agent-os-connection-help is-warning">当前设备没有检测到 <code>gh</code>。先安装 GitHub CLI，才能保证应用界面和 Syntropic 插件 使用同一套授权。</p> : null}
          {connectorAuthorization ? <div className={`agent-os-connection-guide is-${connectorAuthorization.kind}`}><span className="agent-os-connection-guide-icon">{connectorAuthorization.kind === "oauth" ? "↗" : connectorAuthorization.kind === "browser-token" ? "1" : "i"}</span><span><strong>{connectorAuthorization.title}</strong><small>{connectorAuthorization.description}</small></span></div> : null}
          {connectorAuthorization?.actionUrl ? <a className="agent-os-connection-action" href={connectorAuthorization.actionUrl} target="_blank" rel="noreferrer">{connectorAuthorization.actionLabel ?? "打开官方授权页面"}<span>↗</span></a> : null}
          {app.kind === "connector" && connectorAuthorization?.kind !== "browser-token" && connectorAuthorization?.kind !== "oauth" ? <button className="agent-os-connection-advanced-toggle" type="button" onClick={() => setShowAdvanced((value) => !value)}>{showAdvanced ? "收起管理员配置" : "我已获得管理员凭据"}</button> : null}
          {app.kind === "connector" && connectorAuthorization?.kind === "oauth" ? <button className="agent-os-connection-advanced-toggle" type="button" onClick={() => setShowAdvanced((value) => !value)}>{showAdvanced ? "收起手动 Token" : "使用已有 Token（高级）"}</button> : null}
          {visibleFields.map((field) => <label key={field.name}><span>{field.label}{field.optional ? <em>可选</em> : null}</span><input type={(field as { inputType?: "password" | "text" | "url" }).inputType ?? "password"} autoComplete="off" value={values[field.name] ?? ""} placeholder={field.placeholder} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}/></label>)}
          <div className="agent-os-connection-scopes"><strong>将授予的能力</strong>{status?.scopes.map((scope) => <span key={scope}><i/> {scope}</span>)}</div>
          {error ? <p className="agent-os-connection-error" role="alert">{error}</p> : null}
          {(connectorAuthorization?.kind !== "enterprise" || showAdvanced) ? <button className="agent-os-connection-primary" type="submit" disabled={busy || !appId || status?.state === "setup_required"}>{busy ? "正在处理…" : isOAuth && !showAdvanced ? `继续授权 ${app.name}` : app.kind === "connector" ? `连接 ${app.name}` : `验证并连接 ${app.name}`}</button> : null}
        </form>}
      </div>
    </section>
  </div>;
}

function CollaborationCliAppView({ app, onNotice }: { app: ConnectorLaunchpadApp; onNotice: (message: string) => void }) {
  const appId = app.appearance as "wecom" | "dingtalk" | "beisen" | "boss-zhipin";
  const [status, setStatus] = useState<CollaborationCliStatus | null>(null);
  const [flow, setFlow] = useState<CollaborationAuthFlow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/apps/${appId}/cli`, { cache: "no-store" });
    const body = await response.json() as CollaborationCliStatus & { error?: string };
    if (!response.ok) throw new Error(body.error ?? `无法检查${app.name} CLI`);
    setStatus(body);
    return body;
  }, [app.name, appId]);

  useEffect(() => {
    let cancelled = false;
    void refresh().catch((statusError: unknown) => {
      if (!cancelled) setError(statusError instanceof Error ? statusError.message : String(statusError));
    });
    return () => { cancelled = true; };
  }, [refresh]);

  const postAction = useCallback(async (action: string, flowId?: string) => {
    const response = await fetch(`/api/apps/${appId}/cli`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, flowId }),
    });
    const body = await response.json() as (CollaborationCliStatus & CollaborationAuthFlow & { error?: string });
    if (!response.ok) throw new Error(body.error ?? `${app.name} 操作失败`);
    return body;
  }, [app.name, appId]);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const wasInstalled = status?.installed === true;
      const current = await postAction("install") as CollaborationCliStatus;
      setStatus(current);
      if (!wasInstalled) onNotice(`${app.name} CLI 与 Skill 已安装`);
      const nextFlow = await postAction("login") as CollaborationAuthFlow;
      setFlow(nextFlow);
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : String(connectError));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    const currentFlow = flow;
    setFlow(null);
    if (currentFlow) await postAction("cancel", currentFlow.flowId).catch(() => undefined);
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await postAction("verify") as CollaborationCliStatus;
      setStatus(next);
      setFlow(null);
      onNotice(`${app.name} 账号已连接`);
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : String(verifyError));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!flow || flow.requiresConfirmation) return;
    let cancelled = false;
    const poll = window.setInterval(() => {
      void refresh().then((next) => {
        if (cancelled || next.authState !== "authenticated") return;
        window.clearInterval(poll);
        setFlow(null);
        onNotice(`${app.name} 账号已连接`);
      }).catch(() => undefined);
    }, 1_500);
    return () => { cancelled = true; window.clearInterval(poll); };
  }, [app.name, flow, onNotice, refresh]);

  const authenticated = status?.authState === "authenticated";
  if (!authenticated || flow) return <div className="agent-os-native-onboarding">
    <main className={flow ? "is-authorizing" : ""}>
      {flow ? <>
        <div className="agent-os-onboarding-auth-visual">
          {flow.requiresConfirmation ? <div className="agent-os-onboarding-browser" aria-label={`${app.name}授权窗口已打开`}><Icon name="browser" size={40}/><span className="agent-os-onboarding-live-dot"/><strong>授权窗口已打开</strong></div> : <Image src={flow.qrCodeDataUrl} width={208} height={208} unoptimized alt={`${app.name}授权二维码`}/>}
        </div>
        <section className="agent-os-onboarding-copy">
          <span className="agent-os-onboarding-step">账号授权</span>
          <h1>{flow.requiresConfirmation ? `登录 ${app.name}` : "扫描二维码继续"}</h1>
          <p>{flow.requiresConfirmation ? `在刚刚打开的 ${app.name} 页面完成登录，然后返回这里。` : `使用手机扫描二维码，完成后会自动连接 ${app.name}。`}</p>
          {flow.userCode ? <code className="agent-os-onboarding-code">{flow.userCode}</code> : null}
          <div className="agent-os-onboarding-actions">
            {flow.requiresConfirmation ? <button className="is-primary" type="button" disabled={busy} onClick={() => { void verify(); }}>{busy ? <><span className="agent-os-spinner"/>正在验证</> : "我已完成登录"}</button> : <a className="is-primary" href={flow.verificationUrl} target="_blank" rel="noreferrer">在浏览器中继续</a>}
            <button className="is-secondary" type="button" onClick={() => { void cancel(); }}>取消</button>
          </div>
        </section>
      </> : <section className="agent-os-onboarding-welcome">
        <AppLogo app={app}/>
        <h1>连接 {app.name}</h1>
        <p>登录后即可在 Syntropic 中使用{app.connector.capabilities.slice(0, 3).join("、")}。</p>
        {error ? <p className="agent-os-onboarding-error" role="alert">{error}</p> : null}
        <button className="agent-os-onboarding-primary" type="button" disabled={busy} onClick={() => { void connect(); }}>{busy ? <><span className="agent-os-spinner"/>正在准备</> : "继续"}</button>
        <small className="agent-os-onboarding-privacy"><span>✓</span> 授权凭据仅保存在这台设备上</small>
        <a className="agent-os-onboarding-help" href={app.connector.officialUrl} target="_blank" rel="noreferrer">了解授权方式</a>
      </section>}
      {flow && error ? <p className="agent-os-onboarding-error" role="alert">{error}</p> : null}
    </main>
  </div>;

  return <div className="agent-os-feishu-app agent-os-cli-app is-connected">
    <header><AppLogo app={app}/><span><small>已连接</small><h1>{status?.account || status?.organization || app.name}</h1><p>{app.name} 已可供 Syntropic 使用。</p></span><em className="is-ready">已连接</em></header>
    <section className="agent-os-cli-capabilities"><header><span><small>已授予 Agent</small><h2>可用能力</h2></span></header><div>{app.connector.capabilities.map((capability) => <span key={capability}><i/> {capability}</span>)}</div><p>授权信息由本机安全保存。</p></section>
  </div>;
}

function ConnectedAppDataView({ app, onNotice }: { app: DataLaunchpadApp; onNotice: (message: string) => void }) {
  const config = app.kind === "connector" ? { sections: ["概览", ...app.connector.capabilities], dataLabel: `${app.connector.category}连接器`, emptyTitle: `还没有载入 ${app.name} 数据`, emptyDescription: "完成企业授权后，Agent 可通过配置的 MCP 或开放平台访问获准数据。" } : CONNECTED_APP_CONFIG[app.appearance];
  const appId = isConnectedAppAppearance(app.appearance) ? app.appearance : null;
  const [section, setSection] = useState(config.sections[0]);
  const [query, setQuery] = useState("");
  const [connection, setConnection] = useState<AppConnectionStatus | null>(null);
  const [data, setData] = useState<AppDataResponse | null>(null);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const disabled = app.kind === "plugin" && app.plugin.disabled;
  const appScope = app.kind === "plugin" && app.plugin.scope === "project" ? "项目" : "全局";
  const resources = app.kind === "plugin" ? app.plugin.resources : app.connector.capabilities.map((name) => ({ name, kind: app.connector.authMode === "mcp" ? "MCP" : "OpenAPI", path: name }));
  const resourceCount = app.kind === "plugin" ? Object.values(app.plugin.counts).reduce((total, count) => total + count, 0) : resources.length;
  const filteredResources = resources.filter((resource) => `${resource.name} ${resource.kind}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const kindLabel = (kind: string) => ({ extension: "扩展", skill: "技能", prompt: "提示词", theme: "主题" })[kind] ?? kind;

  const readStatus = useCallback(async () => {
    if (!appId) return null;
    const response = await fetch(`/api/apps/${appId}/connection`, { cache: "no-store" });
    const body = await response.json() as AppConnectionStatus & { error?: string };
    if (!response.ok) throw new Error(body.error ?? "连接状态读取失败");
    setConnection(body);
    return body;
  }, [appId]);

  const readData = useCallback(async () => {
    if (!appId) return;
    setLoadingData(true);
    setDataError(null);
    try {
      const response = await fetch(`/api/apps/${appId}/data?section=${encodeURIComponent(section)}&q=${encodeURIComponent(query.trim())}`, { cache: "no-store" });
      const body = await response.json() as AppDataResponse & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "数据读取失败");
      setData(body);
      if (body.account) setConnection((current) => current ? { ...current, account: body.account } : current);
    } catch (error) {
      setData(null);
      setDataError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingData(false);
    }
  }, [appId, query, section]);

  useEffect(() => {
    let cancelled = false;
    void readStatus().catch((error: unknown) => {
      if (!cancelled) setConnectionError(error instanceof Error ? error.message : String(error));
    });
    return () => { cancelled = true; };
  }, [readStatus]);

  useEffect(() => {
    if (connection?.state !== "connected") return;
    const timer = window.setTimeout(() => { void readData(); }, 320);
    return () => window.clearTimeout(timer);
  }, [connection?.state, readData]);

  const refresh = async () => {
    try {
      const next = await readStatus();
      if (next?.state === "connected") await readData();
      onNotice(`${app.name} 数据已刷新`);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : String(error));
    }
  };

  const connect = async (values: Record<string, string>) => {
    if (!appId) return;
    const usesBrowserOAuth = appId === "notion" || appId === "google" || (app.kind === "connector" && app.connector.authorization.kind === "oauth" && !values.accessToken);
    const oauthWindow = usesBrowserOAuth ? window.open("about:blank", `agent-os-${appId}-oauth`, "popup,width=760,height=760") : null;
    setBusy(true);
    setConnectionError(null);
    try {
      const response = await fetch(`/api/apps/${appId}/connection`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const result = await response.json() as AppConnectResponse & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "授权失败");
      setConnection(result.status);
      if (!result.authUrl) {
        setConnectionOpen(false);
        await readData();
        onNotice(`${app.name} 已连接`);
        return;
      }
      if (oauthWindow) oauthWindow.location.href = result.authUrl;
      else window.open(result.authUrl, "_blank", "noopener,noreferrer");
      const deadline = Date.now() + 5 * 60_000;
      const poll = async (): Promise<void> => {
        if (Date.now() > deadline) throw new Error("授权等待超时，请重试");
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
        const next = await readStatus();
        if (next?.state !== "connected") return poll();
      };
      await poll();
      setConnectionOpen(false);
      await readData();
      onNotice(`${app.name} 已连接`);
    } catch (error) {
      oauthWindow?.close();
      setConnectionError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!appId || !window.confirm(`要断开 ${app.name} 吗？本机保存的授权信息会被移除。`)) return;
    setBusy(true);
    setConnectionError(null);
    try {
      const response = await fetch(`/api/apps/${appId}/connection`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" });
      const body = await response.json() as AppConnectionStatus & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "断开失败");
      setConnection(body);
      setData(null);
      setConnectionOpen(false);
      onNotice(`${app.name} 已断开`);
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const connected = connection?.state === "connected";
  const visibleItems = data?.items ?? [];
  const usesDirectOAuth = app.kind === "connector" && app.connector.authorization.kind === "oauth";

  if (usesDirectOAuth && !connection && !connectionError) return <div className="agent-os-feishu-opening" role="status" aria-live="polite">
    <AppLogo app={app}/><span className="agent-os-spinner"/><strong>正在打开 {app.name}…</strong>
  </div>;

  if (usesDirectOAuth && !connected) return <div className="agent-os-native-onboarding">
    <main><section className="agent-os-onboarding-welcome">
      <AppLogo app={app}/>
      <h1>连接 {app.name}</h1>
      <p>登录后即可在 Syntropic 中使用{app.connector.capabilities.slice(0, 3).join("、")}。</p>
      {connectionError ? <p className="agent-os-onboarding-error" role="alert">{connectionError}</p> : null}
      <button className="agent-os-onboarding-primary" type="button" disabled={busy} onClick={() => { void connect({}); }}>{busy ? <><span className="agent-os-spinner"/>等待授权</> : "继续"}</button>
      <small className="agent-os-onboarding-privacy"><span>✓</span> 将前往 {app.name} 官方页面授权</small>
      <a className="agent-os-onboarding-help" href={app.connector.officialUrl} target="_blank" rel="noreferrer">了解授权方式</a>
    </section></main>
  </div>;

  return <div className={`agent-os-connected-app is-${app.appearance}`}>
    <aside>
      <header><AppLogo app={app}/><span><strong>{app.name}</strong><small>Syntropic 数据应用</small></span></header>
      <nav aria-label={`${app.name} 数据分类`}>{config.sections.map((item) => <button key={item} type="button" aria-current={section === item ? "page" : undefined} onClick={() => setSection(item)}><i/>{item}</button>)}</nav>
      <footer><span className={disabled || !connected ? "is-disabled" : ""}/><div><strong>{disabled ? "应用已停用" : connected ? "数据连接正常" : "等待账号连接"}</strong><small>{appScope === "全局" ? "所有工作区可用" : "当前项目可用"}</small></div></footer>
    </aside>
    <main>
      <header className="agent-os-connected-toolbar">
        <label><Icon name="search" size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`搜索 ${app.name}`} aria-label={`搜索 ${app.name} 数据`}/></label>
        <button type="button" disabled={loadingData} onClick={() => { void refresh(); }}>{loadingData ? "刷新中…" : "刷新"}</button>
      </header>
      <div className="agent-os-connected-content">
        <header><span><small>{config.dataLabel}</small><h1>{section}</h1><p>通过 Syntropic 连接器读取并组织 {app.name} 数据，不改变原应用中的内容。</p></span><em>{disabled ? "已停用" : "已安装"}</em></header>
        <section className="agent-os-connected-metrics" aria-label="连接概览">
          <article><small>连接状态</small><strong>{disabled ? "不可用" : connection?.state === "connected" ? connection.account ?? "已授权" : connection?.state === "setup_required" ? "需要配置" : connection?.state === "connecting" ? "授权中" : "等待授权"}</strong></article>
          <article><small>Agent 能力</small><strong>{resourceCount}</strong></article>
          <article><small>应用范围</small><strong>{appScope}</strong></article>
        </section>
        <section className="agent-os-connected-data">
          <div className={visibleItems.length ? "agent-os-connected-list" : "agent-os-connected-empty"}>{visibleItems.length ? <>
            <header><strong>{section}</strong><small>{visibleItems.length} 项真实数据</small></header>
            {visibleItems.map((item) => {
              const content = <><span><strong>{item.title}</strong>{item.subtitle ? <small>{item.subtitle}</small> : null}</span><em>{item.meta ?? item.kind}</em></>;
              return item.url ? <a key={item.id} href={item.url} target="_blank" rel="noreferrer">{content}</a> : <div key={item.id}>{content}</div>;
            })}
            {data?.note ? <p className="agent-os-connected-note">{data.note}</p> : null}
          </> : <><AppLogo app={app}/><strong>{loadingData ? "正在读取数据…" : dataError ? "数据读取失败" : query && connected ? "没有匹配的数据" : config.emptyTitle}</strong><p>{dataError ?? (query && connected ? "换一个关键词后重试。" : connected ? data?.note ?? "当前分类暂时没有数据。" : config.emptyDescription)}</p><button type="button" onClick={() => setConnectionOpen(true)}>{connected ? "管理数据连接" : "连接账号"}</button></>}</div>
          <aside><header><strong>Agent 可用能力</strong><small>{filteredResources.length} 项</small></header>{filteredResources.length ? filteredResources.map((resource) => <div key={`${resource.kind}:${resource.path}`}><span><i/>{resource.name}</span><em>{kindLabel(resource.kind)}</em></div>) : <p>暂无匹配能力</p>}</aside>
        </section>
      </div>
    </main>
    {connectionOpen ? <ConnectionPanel app={app} status={connection} busy={busy} error={connectionError} onClose={() => setConnectionOpen(false)} onConnect={(values) => { void connect(values); }} onDisconnect={() => { void disconnect(); }}/> : null}
  </div>;
}

function ConnectedAppView({ app, onNotice }: { app: DataLaunchpadApp; onNotice: (message: string) => void }) {
  if (app.kind === "connector" && (["wecom", "dingtalk", "beisen", "boss-zhipin"] as string[]).includes(app.appearance) && app.connector.authMode === "cli") {
    return <CollaborationCliAppView app={app} onNotice={onNotice}/>;
  }
  return <ConnectedAppDataView app={app} onNotice={onNotice}/>;
}

interface FeishuCliStatus {
  installed: boolean;
  configured: boolean;
  version?: string;
  authState: "authenticated" | "not_authenticated" | "unknown";
  authDetail: string;
  account?: string;
}

interface FeishuAuthFlow {
  flowId?: string;
  kind: "configuration" | "permission" | "login";
  verificationUrl: string;
  qrCodeDataUrl: string;
}

interface CollaborationCliStatus {
  appId: "wecom" | "dingtalk" | "beisen" | "boss-zhipin";
  installed: boolean;
  skillsInstalled: boolean;
  version?: string;
  authState: "authenticated" | "not_authenticated" | "unknown";
  authDetail: string;
  account?: string;
  organization?: string;
}

interface CollaborationAuthFlow {
  flowId: string;
  verificationUrl: string;
  qrCodeDataUrl: string;
  userCode?: string;
  instruction: string;
  requiresConfirmation?: boolean;
}

interface FeishuDocument {
  source?: "feishu-demo";
  id: string;
  title: string;
  type: string;
  url?: string;
  summary?: string;
  modifiedAt?: string;
}

interface FeishuDocumentsResponse {
  items?: FeishuDocument[];
  hasMore?: boolean;
  mode?: "recent" | "search";
  error?: string;
  kind?: "not_authenticated" | "missing_scope" | "cli_error";
  consoleUrl?: string;
}

let cachedFeishuStatus: FeishuCliStatus | null = null;

const FEISHU_DOCUMENT_TYPES: Record<string, string> = {
  doc: "文档", docx: "文档", wiki: "知识库", sheet: "表格", bitable: "多维表格", slides: "幻灯片", mindnote: "思维笔记",
};

const PINNED_DOCK_APPS_KEY = "pi-agent-os:pinned-dock-items-v2";
const LEGACY_PINNED_DOCK_APPS_KEY = "pi-agent-os:pinned-dock-apps";

function parseDockItems(value: string | null): DockItem[] {
  try {
    const parsed = JSON.parse(value ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((app): app is DockItem => Boolean(
      app && typeof app === "object" && "id" in app && "name" in app && "kind" in app,
    ));
  } catch {
    return [];
  }
}

function readPinnedDockApps(): DockItem[] {
  const stored = window.localStorage.getItem(PINNED_DOCK_APPS_KEY);
  if (stored !== null) return parseDockItems(stored).flatMap<DockItem>((item): DockItem[] => {
    if (item.kind !== "system") return [item];
    const storedId = (item as { id: string }).id === "system:code" ? "system:files" : item.id;
    if (storedId === "system:calendar") return [item];
    const currentSystemApp = SYSTEM_DOCK_APPS.find((systemApp) => systemApp.id === storedId);
    return currentSystemApp ? [currentSystemApp] : [];
  });
  const legacyApps = parseDockItems(window.localStorage.getItem(LEGACY_PINNED_DOCK_APPS_KEY));
  return [...SYSTEM_DOCK_APPS, ...legacyApps.filter((item) => item.kind !== "system")];
}

function FeishuAppView({ app, onNotice, onOpenDocument }: {
  app: Extract<LaunchpadApp, { kind: "builtin" }>;
  onNotice: (message: string) => void;
  onOpenDocument: (document: FeishuDocument) => void;
}) {
  const [status, setStatus] = useState<FeishuCliStatus | null>(() => cachedFeishuStatus);
  const [loading, setLoading] = useState(cachedFeishuStatus === null);
  const [busy, setBusy] = useState(false);
  const [flow, setFlow] = useState<FeishuAuthFlow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [documentQuery, setDocumentQuery] = useState("");
  const [documents, setDocuments] = useState<FeishuDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<FeishuDocumentsResponse | null>(null);
  const [documentType, setDocumentType] = useState("all");

  const updateStatus = useCallback((nextStatus: FeishuCliStatus) => {
    cachedFeishuStatus = nextStatus;
    setStatus(nextStatus);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/apps/feishu", { cache: "no-store" });
      const body = await response.json() as FeishuCliStatus & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "无法检查飞书 CLI");
      updateStatus(body);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : String(statusError));
    } finally {
      setLoading(false);
    }
  }, [updateStatus]);

  useEffect(() => { void refresh(); }, [refresh]);

  const postAction = useCallback(async (action: string, extra: Record<string, string> = {}) => {
    const response = await fetch("/api/apps/feishu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const body = await response.json() as (FeishuCliStatus & FeishuAuthFlow & { started?: boolean; error?: string });
    if (!response.ok) throw new Error(body.error ?? "飞书操作失败");
    return body;
  }, []);

  const beginFlow = useCallback(async (action: "configure" | "login") => {
    setBusy(true);
    setError(null);
    try {
      const nextFlow = await postAction(action) as FeishuAuthFlow;
      setFlow(nextFlow);
      if (nextFlow.kind === "login" && nextFlow.flowId) {
        await postAction("complete_login", { flowId: nextFlow.flowId });
      }
    } catch (flowError) {
      setError(flowError instanceof Error ? flowError.message : String(flowError));
    } finally {
      setBusy(false);
    }
  }, [postAction]);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      let current = status;
      if (!current?.installed) {
        current = await postAction("install") as FeishuCliStatus;
        updateStatus(current);
        onNotice("飞书 CLI 与官方 Skill 已安装");
      }
      await beginFlow(current.configured ? "login" : "configure");
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : String(connectError));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!flow || flow.kind === "permission") return;
    let cancelled = false;
    const poll = window.setInterval(() => {
      void fetch("/api/apps/feishu", { cache: "no-store" }).then(async (response) => {
        const next = await response.json() as FeishuCliStatus;
        if (cancelled || !response.ok) return;
        updateStatus(next);
        if (flow.kind === "configuration" && next.configured) {
          window.clearInterval(poll);
          setFlow(null);
          await beginFlow("login");
        } else if (flow.kind === "login" && next.authState === "authenticated") {
          window.clearInterval(poll);
          setFlow(null);
          onNotice("飞书账号已连接");
        }
      }).catch(() => undefined);
    }, 1_500);
    return () => { cancelled = true; window.clearInterval(poll); };
  }, [beginFlow, flow, onNotice, updateStatus]);

  const authenticated = status?.authState === "authenticated";

  useEffect(() => {
    if (!authenticated || flow) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setDocumentsLoading(true);
      setDocumentsError(null);
      const params = new URLSearchParams();
      if (documentQuery.trim()) params.set("q", documentQuery.trim());
      const url = `/api/apps/feishu/documents${params.size ? `?${params}` : ""}`;
      void fetch(url, { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          const body = await response.json() as FeishuDocumentsResponse;
          if (!response.ok) throw Object.assign(new Error(body.error ?? "无法读取飞书云文档"), { body });
          setDocuments(body.items ?? []);
        })
        .catch((fetchError: unknown) => {
          if (controller.signal.aborted) return;
          const body = (fetchError as { body?: FeishuDocumentsResponse }).body;
          setDocuments([]);
          setDocumentsError(body ?? { error: fetchError instanceof Error ? fetchError.message : String(fetchError) });
        })
        .finally(() => { if (!controller.signal.aborted) setDocumentsLoading(false); });
    }, documentQuery ? 320 : 0);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [authenticated, documentQuery, flow]);

  const documentWorkspace = authenticated && !flow;
  const visibleDocuments = documentType === "all" ? documents : documents.filter((document) => document.type === documentType);
  const documentSections = [
    { id: "all", label: "全部文档", icon: "list" as const },
    { id: "docx", label: "文档", icon: "file" as const },
    { id: "sheet", label: "表格", icon: "grid" as const },
    { id: "bitable", label: "多维表格", icon: "tiles" as const },
    { id: "slides", label: "幻灯片", icon: "maximize" as const },
  ];

  if (!status) return <div className="agent-os-feishu-opening" role={error ? "alert" : "status"} aria-live="polite">
    <AppLogo app={app}/>
    {error ? <>
      <strong>暂时无法打开飞书云文档</strong>
      <p>{error}</p>
      <button type="button" disabled={loading} onClick={() => { void refresh(); }}>重新检查</button>
    </> : <>
      <span className="agent-os-spinner"/>
      <strong>正在打开飞书云文档…</strong>
      <p>正在确认账号状态</p>
    </>}
  </div>;

  if (!documentWorkspace) return <div className="agent-os-native-onboarding">
    <main className={flow ? "is-authorizing" : ""}>
      {flow ? <>
        <div className="agent-os-onboarding-auth-visual"><Image src={flow.qrCodeDataUrl} width={208} height={208} unoptimized alt={flow.kind === "configuration" ? "飞书应用配置二维码" : flow.kind === "permission" ? "飞书权限配置二维码" : "飞书账号登录二维码"}/></div>
        <section className="agent-os-onboarding-copy">
          <span className="agent-os-onboarding-step">{flow.kind === "configuration" ? "设置飞书" : flow.kind === "permission" ? "确认权限" : "账号授权"}</span>
          <h1>{flow.kind === "permission" ? "启用云文档权限" : "扫描二维码继续"}</h1>
          <p>{flow.kind === "permission" ? "在飞书开放平台启用权限，然后返回这里继续。" : "使用飞书扫描二维码，完成后会自动继续。"}</p>
          <div className="agent-os-onboarding-actions">
            <a className="is-primary" href={flow.verificationUrl} target="_blank" rel="noreferrer">在浏览器中继续</a>
            {flow.kind === "permission" ? <button className="is-secondary" type="button" disabled={busy} onClick={() => { void beginFlow("login"); }}>我已完成</button> : <button className="is-secondary" type="button" onClick={() => setFlow(null)}>取消</button>}
          </div>
        </section>
      </> : <section className="agent-os-onboarding-welcome">
        <AppLogo app={app}/>
        <h1>连接飞书</h1>
        <p>登录后即可在 Syntropic 中使用消息、文档和多维表格。</p>
        {error ? <p className="agent-os-onboarding-error" role="alert">{error}</p> : null}
        <button className="agent-os-onboarding-primary" type="button" disabled={busy || loading} onClick={() => { void connect(); }}>{busy ? <><span className="agent-os-spinner"/>正在准备</> : "继续"}</button>
        <small className="agent-os-onboarding-privacy"><span>✓</span> 使用飞书官方授权，凭据保存在本机</small>
        <a className="agent-os-onboarding-help" href="https://open.feishu.cn/document/no_class/mcp-archive/feishu-cli-installation-guide.md" target="_blank" rel="noreferrer">了解授权方式</a>
      </section>}
      {flow && error ? <p className="agent-os-onboarding-error" role="alert">{error}</p> : null}
    </main>
  </div>;

  return <div className="agent-os-feishu-app is-documents">
    <section className="agent-os-feishu-library">
      <div className="agent-os-feishu-library-body">
        <aside>
          <div className="agent-os-feishu-sidebar-search">
            <label><Icon name="search" size={14}/><input value={documentQuery} maxLength={30} onChange={(event) => setDocumentQuery(event.target.value)} placeholder="搜索文档" aria-label="搜索飞书云文档"/>{documentQuery ? <button type="button" aria-label="清空搜索" onClick={() => setDocumentQuery("")}><Icon name="close" size={11}/></button> : null}</label>
          </div>
          <nav aria-label="飞书文档类型">{documentSections.map((section) => {
            const count = section.id === "all" ? documents.length : documents.filter((document) => document.type === section.id).length;
            return <button key={section.id} type="button" aria-current={documentType === section.id ? "page" : undefined} onClick={() => setDocumentType(section.id)}><Icon name={section.icon} size={15}/><span>{section.label}</span><em>{count}</em></button>;
          })}</nav>
          <footer><span><i/>已连接</span><button type="button" disabled={busy} onClick={() => { void beginFlow("login"); }}>管理授权</button></footer>
        </aside>
        <main>
          <header><span><h2>{documentQuery.trim() ? "搜索结果" : documentSections.find((section) => section.id === documentType)?.label}</h2><p>{visibleDocuments.length} 个项目 · 点击后在桌面打开</p></span></header>
          <div className="agent-os-feishu-library-columns" aria-hidden="true"><span>名称</span><span>类型</span></div>
          {documentsError ? <div className="agent-os-feishu-documents-state is-error" role="alert"><span className="agent-os-feishu-state-icon">!</span><strong>{documentsError.kind === "missing_scope" ? "还需要云文档权限" : "文档加载失败"}</strong><p>{documentsError.error}</p><div>{documentsError.consoleUrl ? <a href={documentsError.consoleUrl} target="_blank" rel="noreferrer">在飞书开放平台启用权限 ↗</a> : null}<button type="button" disabled={busy} onClick={() => { void beginFlow("login"); }}>重新扫码授权</button></div></div> : documentsLoading && !documents.length ? <div className="agent-os-feishu-documents-state" role="status"><span className="agent-os-spinner"/>正在读取云文档…</div> : visibleDocuments.length ? <div className="agent-os-feishu-library-list" role="list">
            {visibleDocuments.map((document) => <button key={document.id} type="button" role="listitem" disabled={!document.url} onClick={() => onOpenDocument(document)} aria-label={`在桌面打开 ${document.title}`}>
              <i className={`is-${document.type}`} aria-hidden="true">{(FEISHU_DOCUMENT_TYPES[document.type] ?? "文档").slice(0, 1)}</i>
              <span><strong>{document.title}</strong><small>{document.summary || "飞书云文档"}</small></span>
              <em>{FEISHU_DOCUMENT_TYPES[document.type] ?? document.type}</em>
              <b aria-hidden="true">›</b>
            </button>)}
          </div> : <div className="agent-os-feishu-documents-state"><span className="agent-os-feishu-state-icon"><Icon name="file" size={22}/></span><strong>{documentQuery ? "没有找到匹配文档" : "这里还没有文档"}</strong><p>{documentQuery ? "换一个标题或内容关键词再试试。" : "尝试切换分类或刷新列表。"}</p></div>}
        </main>
      </div>
    </section>
  </div>;
}

function FeishuDocumentEditor({ document }: { document: FeishuDocument }) {
  const [loading, setLoading] = useState(true);
  if (!document.url) return <div className="agent-os-feishu-editor-empty"><Icon name="file" size={26}/><strong>缺少飞书原文链接</strong></div>;
  return <section className="agent-os-feishu-editor">
    <div>{loading ? <p role="status"><span className="agent-os-spinner"/>正在载入飞书文档…</p> : null}<iframe src={document.url} title={`${document.title} — 飞书原生编辑器`} allow="clipboard-read; clipboard-write; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onLoad={() => setLoading(false)}/></div>
  </section>;
}

function Launchpad({ open, cwd, onClose, onOpenApp }: {
  open: boolean;
  cwd: string | null;
  onClose: () => void;
  onOpenApp: (app: DockItem) => void;
}) {
  const [apps, setApps] = useState<LaunchpadApp[]>(() => getLaunchpadApps([]));
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"全部" | LaunchpadCategory>("全部");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const loadApps = () => {
      setLoading(true);
      setError(null);
      const url = cwd ? `/api/plugins?cwd=${encodeURIComponent(cwd)}` : "/api/plugins";
      void Promise.all([fetch(url, { cache: "no-store", signal: controller.signal }), fetch("/api/app-store/installations", { cache: "no-store", signal: controller.signal })])
        .then(async ([response, connectorResponse]) => {
          const data = await response.json() as PluginsResponse & { error?: string };
          const connectorData = await connectorResponse.json() as { installed?: string[]; builtins?: string[]; error?: string };
          if (!response.ok) throw new Error(data.error ?? "应用加载失败");
          if (!connectorResponse.ok) throw new Error(connectorData.error ?? "连接器加载失败");
          setApps(getLaunchpadApps(data.packages, [...(connectorData.builtins ?? []), ...(connectorData.installed ?? [])]));
        })
        .catch((fetchError: unknown) => {
          if (!controller.signal.aborted) setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    };
    loadApps();
    window.addEventListener("agent-os:apps-changed", loadApps);
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 180);
    return () => {
      controller.abort();
      window.removeEventListener("agent-os:apps-changed", loadApps);
      window.clearTimeout(focusTimer);
    };
  }, [cwd, open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  const allApps: DockItem[] = [...SYSTEM_DOCK_APPS, ...apps].sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  const availableCategories = LAUNCHPAD_CATEGORIES.filter((item) => item === "全部" || allApps.some((app) => app.category === item));
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleApps = allApps.filter((app) => {
    if (category !== "全部" && app.category !== category) return false;
    const source = app.kind === "plugin" ? app.plugin.source : app.kind === "connector" ? `${app.connector.authMode} ${app.connector.capabilities.join(" ")}` : app.kind === "builtin" ? "飞书 lark cli builtin" : "Syntropic system app";
    return !normalizedQuery || `${app.name} ${app.description} ${source}`.toLocaleLowerCase().includes(normalizedQuery);
  });

  if (!open) return null;
  return (
    <section className="agent-os-launchpad" role="dialog" aria-label="启动台" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <header className="agent-os-launchpad-header">
        <label><Icon name="search" size={17}/><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索应用" aria-label="搜索应用"/></label>
        <button type="button" aria-label="关闭启动台" onClick={onClose}><Icon name="close" size={18}/></button>
      </header>
      <nav className="agent-os-launchpad-categories" aria-label="应用分类">
        {availableCategories.map((item) => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
      </nav>
      <div className="agent-os-launchpad-grid" role="list" aria-busy={loading}>
        {error ? <div className="agent-os-launchpad-state is-error" role="alert">{error}</div> : null}
        {!loading && !error && !visibleApps.length ? <div className="agent-os-launchpad-state">没有匹配的应用</div> : null}
        {visibleApps.map((app) => <div role="listitem" key={app.id}>
          <button className="agent-os-launchpad-app" type="button" onClick={() => onOpenApp(app)} aria-label={`打开 ${app.name}`}>
            <span className={`agent-os-launchpad-icon ${app.kind === "system" ? `is-system is-${app.id.slice(7)}` : `is-${app.appearance}${app.kind === "connector" ? " is-official-icon" : ""}`}`} aria-hidden="true"><DockItemIcon item={app} launchpad/></span>
            <strong>{app.name}</strong>
          </button>
        </div>)}
      </div>
      <footer aria-label={`${allApps.length} 个可用应用`}><i className="active"/></footer>
    </section>
  );
}

function extractArtifacts(session: SessionInfo, messages: AgentMessage[]): Artifact[] {
  const results = new Map<string, ToolResultMessage>();
  for (const message of messages) {
    if (message.role === "toolResult") results.set(message.toolCallId, message);
  }
  const seen = new Set<string>();
  const artifacts: Artifact[] = [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "assistant") continue;
    for (const { filePath } of extractTurnWrittenFiles(message.content, results, session.cwd)) {
      if (seen.has(filePath)) continue;
      seen.add(filePath);
      artifacts.push({
        filePath,
        sessionId: session.id,
        cwd: session.cwd,
        taskTitle: taskTitle(session),
        modified: session.modified,
      });
    }
  }
  return artifacts;
}

function ArtifactLibrary({ artifacts, selectedId, onSelect, onOpen }: {
  artifacts: Artifact[];
  selectedId: string | null;
  onSelect: (artifact: Artifact) => void;
  onOpen: (artifact: Artifact) => void;
}) {
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [quickLookOpen, setQuickLookOpen] = useState(false);
  const [quickLookOffset, setQuickLookOffset] = useState({ x: 0, y: 0 });
  const [quickLookDragging, setQuickLookDragging] = useState(false);
  const quickLookDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | null>(null);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return artifacts;
    return artifacts.filter((artifact) => `${getFileName(artifact.filePath)} ${artifact.taskTitle}`.toLocaleLowerCase().includes(normalized));
  }, [artifacts, query]);
  const selected = artifacts.find((artifact) => artifactIdentity(artifact) === selectedId) ?? null;

  const toggleQuickLook = () => {
    if (!selected) return;
    setQuickLookOpen((current) => !current);
  };

  const startQuickLookDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    const quickLook = event.currentTarget.parentElement;
    const library = quickLook?.parentElement;
    if (!quickLook || !library) return;
    const quickLookRect = quickLook.getBoundingClientRect();
    const libraryRect = library.getBoundingClientRect();
    quickLookDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: quickLookOffset.x,
      originY: quickLookOffset.y,
      minX: quickLookOffset.x + libraryRect.left + 8 - quickLookRect.left,
      maxX: quickLookOffset.x + libraryRect.right - 8 - quickLookRect.right,
      minY: quickLookOffset.y + libraryRect.top + 8 - quickLookRect.top,
      maxY: quickLookOffset.y + libraryRect.bottom - 8 - quickLookRect.bottom,
    };
    setQuickLookDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveQuickLook = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = quickLookDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setQuickLookOffset({
      x: Math.max(drag.minX, Math.min(drag.maxX, drag.originX + event.clientX - drag.startX)),
      y: Math.max(drag.minY, Math.min(drag.maxY, drag.originY + event.clientY - drag.startY)),
    });
  };

  const finishQuickLookDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (quickLookDragRef.current?.pointerId !== event.pointerId) return;
    quickLookDragRef.current = null;
    setQuickLookDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <section
      className="agent-os-library"
      aria-label="产物库"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Escape" && quickLookOpen) {
          event.preventDefault();
          setQuickLookOpen(false);
          return;
        }
        if (event.code !== "Space" || (event.target as HTMLElement).closest("button,input")) return;
        event.preventDefault();
        toggleQuickLook();
      }}
    >
      <header className="agent-os-library-toolbar">
        <div><strong>全部产物</strong><small>{filtered.length} 个文件</small></div>
        <label><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索" aria-label="搜索产物"/></label>
        <div className="agent-os-library-view-switch" aria-label="文件显示方式">
          <button type="button" aria-label="图标视图" aria-pressed={viewMode === "grid"} onClick={() => setViewMode("grid")}><Icon name="tiles" size={15}/></button>
          <button type="button" aria-label="列表视图" aria-pressed={viewMode === "list"} onClick={() => setViewMode("list")}><Icon name="list" size={15}/></button>
        </div>
        <button className="agent-os-library-quicklook-toggle" type="button" aria-label="Quick Look" aria-pressed={quickLookOpen} disabled={!selected} onClick={toggleQuickLook}><Icon name="eye" size={17}/></button>
      </header>
      <div className={`agent-os-library-files is-${viewMode}`} role="listbox" aria-label="产物文件">
        {viewMode === "list" && <div className="agent-os-library-columns" aria-hidden="true"><strong>名称</strong><span>最后修改时间</span><span>最后关联的任务</span></div>}
        {filtered.length ? filtered.map((artifact) => {
          const identity = artifactIdentity(artifact);
          const selectedNow = identity === selectedId;
          return <div
            role="option"
            tabIndex={0}
            aria-selected={selectedNow}
            className={selectedNow ? "selected" : ""}
            key={identity}
            onClick={() => onSelect(artifact)}
            onDoubleClick={() => onOpen(artifact)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              onOpen(artifact);
            }}
          >
            <span className={`agent-os-library-file-icon${viewMode === "grid" && isHtmlArtifact(artifact) ? " has-preview" : ""}`} aria-hidden="true" inert>
              {viewMode === "grid" && isHtmlArtifact(artifact) ? <FileViewer
                filePath={artifact.filePath}
                cwd={artifact.cwd}
                sourceSessionId={artifact.sessionId}
                initialDisplayMode="preview"
                watchEnabled={false}
              /> : <Icon name="file" size={viewMode === "grid" ? 31 : 17}/>}
            </span>
            <span className="agent-os-library-file-name"><strong>{getFileName(artifact.filePath)}</strong></span>
            <time dateTime={artifact.modified}>{formatArtifactModified(artifact.modified)}</time>
            <span className="agent-os-library-associated-task" title={artifact.taskTitle}>{compactText(artifact.taskTitle, 54)}</span>
          </div>;
        }) : <div className="agent-os-library-empty"><Icon name="file" size={28}/><strong>{query ? "没有匹配的产物" : "还没有文件产物"}</strong><small>{query ? "试试其他关键词" : "Agent 生成文件后会自动出现在这里"}</small></div>}
      </div>
      {selected && quickLookOpen && <aside
        className={`agent-os-library-quicklook${quickLookDragging ? " is-dragging" : ""}`}
        aria-label="Quick Look"
        style={{ transform: `translate(calc(-50% + ${quickLookOffset.x}px), calc(-50% + ${quickLookOffset.y}px))` }}
      >
        <header onPointerDown={startQuickLookDrag} onPointerMove={moveQuickLook} onPointerUp={finishQuickLookDrag} onPointerCancel={finishQuickLookDrag}>
          <span><Icon name="file" size={14}/><strong>{getFileName(selected.filePath)}</strong></span>
          <span><button type="button" onClick={() => onOpen(selected)}>打开</button><button type="button" aria-label="关闭 Quick Look" onClick={() => setQuickLookOpen(false)}><Icon name="close" size={14}/></button></span>
        </header>
        <div className="agent-os-library-preview">
          <FileViewer filePath={selected.filePath} cwd={selected.cwd} sourceSessionId={selected.sessionId} initialDisplayMode={isHtmlArtifact(selected) ? "preview" : undefined} watchEnabled/>
        </div>
      </aside>}
    </section>
  );
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function DesktopWindow({
  className,
  title,
  titleIcon,
  headerAccessory,
  kind,
  front,
  onFocus,
  onClose,
  children,
  cascadeIndex = 0,
}: {
  className?: string;
  title: string;
  titleIcon?: ReactNode;
  headerAccessory?: ReactNode;
  kind: "tasks" | "file" | "document" | "library" | "settings" | "app" | "store";
  front: boolean;
  onFocus: () => void;
  onClose: () => void;
  children: ReactNode;
  cascadeIndex?: number;
}) {
  const windowRef = useRef<HTMLElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [resizing, setResizing] = useState(false);
  const resizeRef = useRef<{ pointerId: number; edge: ResizeEdge; pointerX: number; pointerY: number; frame: WindowFrame; area: WindowArea } | null>(null);
  const [maximized, setMaximized] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
    maxX: number;
    maxY: number;
  } | null>(null);
  const cascadeStep = kind === "file" || kind === "document" ? cascadeIndex % 6 : kind === "app" ? cascadeIndex % 4 : 0;
  const centeredPosition = {
    left: `calc(50% + ${cascadeStep * 22}px)`,
    top: `calc(50% + ${cascadeStep * 16}px)`,
    translate: "-50% -50%",
  };


  useEffect(() => {
    const layer = windowRef.current?.parentElement;
    if (!layer) return;
    const observer = new ResizeObserver(() => {
      // Mobile uses full-screen CSS; preserve the desktop restore geometry.
      if (window.innerWidth <= 760) return;
      const area = { width: layer.clientWidth, height: layer.clientHeight };
      setSize((current) => {
        if (!current) return current;
        const fitted = fitWindow({ x: 8, y: 8, ...current }, area);
        return { width: fitted.width, height: fitted.height };
      });
      setPosition((current) => {
        const element = windowRef.current;
        if (!current || !element) return current;
        const fitted = fitWindow({ ...current, width: element.offsetWidth, height: element.offsetHeight }, area);
        return { x: fitted.x, y: fitted.y };
      });
    });
    observer.observe(layer);
    return () => observer.disconnect();
  }, []);

  const startResize = (event: ReactPointerEvent<HTMLDivElement>, edge: ResizeEdge) => {
    if (event.button !== 0 || !event.isPrimary || maximized) return;
    const element = windowRef.current;
    const layer = element?.parentElement;
    if (!element || !layer) return;
    event.preventDefault();
    event.stopPropagation();
    onFocus();
    const rect = element.getBoundingClientRect();
    const layerRect = layer.getBoundingClientRect();
    const area = { width: layer.clientWidth, height: layer.clientHeight };
    const frame = fitWindow({ x: rect.left - layerRect.left, y: rect.top - layerRect.top, width: element.offsetWidth, height: element.offsetHeight }, area);
    resizeRef.current = { pointerId: event.pointerId, edge, pointerX: event.clientX, pointerY: event.clientY, frame, area };
    setPosition({ x: frame.x, y: frame.y });
    setSize({ width: frame.width, height: frame.height });
    setResizing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    const frame = resizeWindow(resize.frame, resize.edge, event.clientX - resize.pointerX, event.clientY - resize.pointerY, resize.area);
    setPosition({ x: frame.x, y: frame.y });
    setSize({ width: frame.width, height: frame.height });
  };
  const finishResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (resizeRef.current?.pointerId !== event.pointerId) return;
    resizeRef.current = null;
    setResizing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    onFocus();
    if (event.button !== 0 || window.innerWidth <= 760 || maximized || (event.target as HTMLElement).closest("button")) return;
    const windowElement = event.currentTarget.parentElement;
    const windowLayer = windowElement?.parentElement;
    if (!windowElement || !windowLayer) return;
    const windowRect = windowElement.getBoundingClientRect();
    const layerRect = windowLayer.getBoundingClientRect();
    const currentPosition = position ?? {
      x: windowRect.left - layerRect.left,
      y: windowRect.top - layerRect.top,
    };
    if (!position) setPosition(currentPosition);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: currentPosition.x,
      top: currentPosition.y,
      maxX: Math.max(8, layerRect.width - 180),
      maxY: Math.max(8, layerRect.height - 42),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setPosition({
      x: Math.max(8, Math.min(drag.maxX, drag.left + event.clientX - drag.x)),
      y: Math.max(8, Math.min(drag.maxY, drag.top + event.clientY - drag.y)),
    });
  };

  return (
    <article
      ref={windowRef}
      aria-label={title}
      className={`agent-os-window agent-os-window-${kind}${className ? ` ${className}` : ""}${front ? " is-front" : ""}${maximized ? " is-maximized" : ""}${resizing ? " is-resizing" : ""}`}
      style={maximized ? undefined : { ...(position ? { left: position.x, top: position.y, translate: "none" } : centeredPosition), ...(size ? { width: size.width, height: size.height } : {}) }}
      onPointerDown={onFocus}
    >
      <header
        className="agent-os-window-bar"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => { dragRef.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
        onPointerCancel={() => { dragRef.current = null; }}
        onLostPointerCapture={() => { dragRef.current = null; }}
        onDoubleClick={(event) => { if (!(event.target as HTMLElement).closest("button")) setMaximized((value) => !value); }}
      >
        <span className="agent-os-traffic" aria-label="窗口控制">
          <button className="close" type="button" aria-label="关闭" onClick={onClose}/>
          <button className="minimize" type="button" aria-label="最小化" onClick={onClose}/>
          <button className="maximize" type="button" aria-label={maximized ? "还原" : "最大化"} onClick={() => setMaximized((value) => !value)}/>
        </span>
        <strong>{kind === "store" ? <Image src="/design/app-store/window-sidebar.svg" width={20} height={20} alt="" unoptimized/> : <>{titleIcon ?? <Icon name={kind === "tasks" ? "tasks" : kind === "settings" ? "settings" : kind === "app" ? "grid" : "file"} size={15}/>} {title}</>}</strong>
        <span>{headerAccessory}</span>
      </header>
      <div className="agent-os-window-body">{children}</div>
      {!maximized && (["n", "e", "s", "w", "ne", "se", "sw", "nw"] as ResizeEdge[]).map((edge) => (
        <div key={edge} className={`agent-os-window-resize is-${edge}`} aria-hidden="true"
          onPointerDown={(event) => startResize(event, edge)} onPointerMove={moveResize}
          onPointerUp={finishResize} onPointerCancel={finishResize} onLostPointerCapture={finishResize}/>
      ))}
    </article>
  );
}

export function AgentDesktop({ presentationCwd }: { presentationCwd?: string } = {}) {
  useEffect(() => {
    if (!presentationCwd) return;
    let frame = 0;
    let sent = false;
    const prepare = () => {
      if (sent || document.visibilityState !== "visible") return;
      // Give the mounted desktop a paint before starting background Chromium.
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (document.visibilityState !== "visible" || sent) return;
          sent = true;
          void fetch("/api/browser/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
        });
      });
    };
    prepare();
    document.addEventListener("visibilitychange", prepare);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", prepare); };
  }, [presentationCwd]);
  const now = useClock();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [runningIds, setRunningIds] = useState<Set<string>>(() => new Set());
  const [activeCwd, setActiveCwd] = useState<string | null>(presentationCwd ?? null);
  useEffect(() => {
    if (!presentationCwd) return;
    try { const saved = localStorage.getItem(`syntropic:active-workspace:${presentationCwd}`); if (saved && (saved === presentationCwd || saved.startsWith(presentationCwd.replace(/workspace$/, "workspaces/")))) setActiveCwd(saved); } catch { /* Optional UI persistence. */ }
  }, [presentationCwd]);
  const [engagedWorkspaces, setEngagedWorkspaces] = useState<Set<string>>(() => new Set());
  const markWorkspaceEngaged = useCallback((cwd: string | null) => {
    if (!cwd) return;
    setEngagedWorkspaces((current) => current.has(cwd) ? current : new Set(current).add(cwd));
    try { localStorage.setItem(`pi-web:desktop-engaged:${cwd}`, "true"); } catch { /* Optional persistence. */ }
  }, []);
  useEffect(() => {
    if (!activeCwd) return;
    try { if (localStorage.getItem(`pi-web:desktop-engaged:${activeCwd}`) === "true") markWorkspaceEngaged(activeCwd); } catch { /* Storage may be unavailable. */ }
  }, [activeCwd, markWorkspaceEngaged]);
  const [managedWorkspaces, setManagedWorkspaces] = useState<WorkspaceOption[]>([]);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const liveVoiceActiveRef = useRef(false);
  const [liveDispatches, setLiveDispatches] = useState<Array<{ task: JarvisTask; expiresAt: number }>>([]);
  const [prompt, setPrompt] = useState("");
  const composerInputRef = useRef<HTMLInputElement>(null);
  const [startMode, setStartMode] = useState<"research" | "files" | "apps" | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [openingStartResource, setOpeningStartResource] = useState(false);
  const [guideDismissed, setGuideDismissed] = useState(true);
  const [reminderCount, setReminderCount] = useState(0);
  useEffect(() => {
    setStartMode(null);
    setGuideOpen(false);
    setReminderCount(0);
    try { setGuideDismissed(Boolean(presentationCwd) || localStorage.getItem(`pi-web:desktop-start:${activeCwd ?? "default"}`) === "dismissed"); }
    catch { setGuideDismissed(false); }
  }, [activeCwd, presentationCwd]);
  const handleReminderHistory = useCallback((items: { completed: boolean }[]) => setReminderCount(items.length), []);
  const dismissGuide = () => {
    setGuideOpen(false);
    setGuideDismissed(true);
    try { localStorage.setItem(`pi-web:desktop-start:${activeCwd ?? "default"}`, "dismissed"); } catch { /* Optional preference. */ }
  };
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useDesktopNotice();
  const refreshInsightsRef = useRef<() => void>(() => {});
  const [taskSessionId, setTaskSessionId] = useState<string | null>(null);
  const [jarvisSessionId, setJarvisSessionId] = useState<string | null>(null);
  const [openArtifacts, setOpenArtifacts] = useState<Artifact[]>([]);
  const [selectedInsight, setSelectedInsight] = useState<InsightResult | null>(null);
  const [openFeishuDocuments, setOpenFeishuDocuments] = useState<FeishuDocument[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [artifactLibraryOpen, setArtifactLibraryOpen] = useState(false);
  const [selectedLibraryArtifactId, setSelectedLibraryArtifactId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [appStoreOpen, setAppStoreOpen] = useState(false);
  const [salesCrmOpen, setSalesCrmOpen] = useState(false);
  const [hrRecruitingOpen, setHrRecruitingOpen] = useState(false);
  const [investmentWorkspaceOpen, setInvestmentWorkspaceOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [jarvisPanelOpen, setJarvisPanelOpen] = useState(false);
  const [browserPageId, setBrowserPageId] = useState<string | null>(null);
  const [filesOpen, setFilesOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [fileOpenRequest, setFileOpenRequest] = useState<FileOpenRequest | null>(null);
  const [filesHaveUnsavedChanges, setFilesHaveUnsavedChanges] = useState(false);
  const [launchpadOpen, setLaunchpadOpen] = useState(false);
  const [openApps, setOpenApps] = useState<LaunchpadApp[]>([]);
  const [dockApps, setDockApps] = useState<DockItem[]>([]);
  const [pinnedDockAppIds, setPinnedDockAppIds] = useState<Set<string>>(() => new Set());
  const [dockPinsLoaded, setDockPinsLoaded] = useState(false);
  const [dockContextMenu, setDockContextMenu] = useState<{ appId: string; x: number; y: number } | null>(null);
  const [browserTasks, setBrowserTasks] = useState<BrowserTaskState[]>([]);
  const [taskOutcomes, setTaskOutcomes] = useState<Record<string, string>>({});
  const [pendingRequest, setPendingRequest] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const knownArtifactIdsRef = useRef<Set<string> | null>(null);
  const [frontWindow, setFrontWindowState] = useState<string>("tasks");
  // A delayed background read must not overtake a newer window activation.
  const windowFocusRevision = useRef(0);
  const setFrontWindow = useCallback((windowId: string) => {
    windowFocusRevision.current += 1;
    setFrontWindowState(windowId);
  }, []);
  const [insightResults, setInsightResults] = useState<InsightResult[]>([]);
  const [insightRunning, setInsightRunning] = useState(false);
  const [insightNotification, setInsightNotification] = useState<InsightResult | null>(null);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const knownInsightIdsRef = useRef<Set<string> | null>(null);

  const publicationSessionRef = useRef<string | null>(null);
  const [publishedDraft, setPublishedDraft] = useState<string | undefined>();
  useEffect(() => { publicationSessionRef.current = null; setPublishedDraft(undefined); }, [activeCwd]);

  const browserReturnOriginRef = useRef<BrowserReturnOrigin | null>(null);
  const cancelBrowserReturn = useCallback(() => { browserReturnOriginRef.current = null; }, []);
  useEffect(() => {
    const origin = browserReturnOriginRef.current;
    if (origin && !isBrowserOriginCurrent(origin, { cwd: activeCwd, taskSessionId, publicationSessionId: publicationSessionRef.current, browserOpen, frontWindow })) {
      browserReturnOriginRef.current = null;
    }
  }, [activeCwd, taskSessionId, browserOpen, frontWindow]);

  const handleBrowserEvent = useEffectEvent((message: BrowserSystemEvent | { type: "browser.ready" }) => {
    const context = { cwd: activeCwd, taskSessionId, publicationSessionId: publicationSessionRef.current, browserOpen, frontWindow };
    if (message.type === "browser.task") {
      setBrowserTasks((current) => [...current.filter((task) => task.id !== message.task.id), message.task]);
      if (message.task.cwd === activeCwd) setPendingRequest(null);
      // The JD action returns to the native recruiting result window after it
      // has loaded the actual published record. Other tasks keep normal return.
      if (publicationSessionRef.current === message.task.parentSessionId) return;
      const origin = browserReturnOriginRef.current;
      if (!origin || message.task.pageId !== origin.pageId
          || !["completed", "failed", "stopped"].includes(message.task.status)) return;
      // Consume once, including cancellation; reconnection must not steal focus later.
      browserReturnOriginRef.current = null;
      const destination = browserReturnDestination(origin, message.task, context);
      if (destination === "tasks") {
        setJarvisPanelOpen(false);
        setFrontWindow("tasks");
      }
      return;
    }
    if (message.type !== "browser.opened" || !message.foreground) return;
    if (activeCwd && message.page.cwd !== activeCwd) {
      setNotice(`浏览器已在其他工作台打开：${message.page.title || message.page.url}`);
      return;
    }
    browserReturnOriginRef.current = captureBrowserOrigin(message.page, context);
    setBrowserPageId(message.page.pageId);
    setBrowserOpen(true);
    setFrontWindow("browser");
    if (message.page.controller === "agent") setJarvisPanelOpen(false);
  });

  useEffect(() => {
    const controller = new AbortController();
    const unsubscribe = subscribeBrowserEvents({ message: (event) => {
      try { handleBrowserEvent(JSON.parse(event.data) as BrowserSystemEvent | { type: "browser.ready" }); }
      catch { /* ignore malformed browser events */ }
    },
    // Recover a completion missed during a short SSE interruption, only for
    // the task whose browser this UI actually followed into the foreground.
    open: () => {
      if (!browserReturnOriginRef.current) return;
      void fetch("/api/browser/state", { cache: "no-store", signal: controller.signal })
        .then(async (response) => response.ok ? await response.json() as { tasks: BrowserTaskState[] } : null)
        .then((state) => { if (!controller.signal.aborted) state?.tasks.forEach((task) => handleBrowserEvent({ type: "browser.task", task })); })
        .catch(() => { /* The stream remains the primary delivery path. */ });
    } });
    return () => { controller.abort(); unsubscribe(); };
  }, []);

  useEffect(() => {
    const stream = new EventSource("/api/file-app/events");
    stream.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as FileOpenRequest | { type: "file.ready" } | { type: "insight.updated"; cwd: string };
        if (message.type === "insight.updated" && message.cwd === activeCwd) refreshInsightsRef.current();
        if (message.type !== "file.open") return;
        if (activeCwd && message.cwd !== activeCwd) {
          setNotice(`文件已在其他工作台打开：${getFileName(message.filePath)}`);
          return;
        }
        setFileOpenRequest(message);
        setFilesOpen(true);
        if (message.foreground) setFrontWindow("files");
      } catch { /* ignore malformed file events */ }
    };
    return () => stream.close();
  }, [activeCwd, setNotice, setFrontWindow]);

  useEffect(() => {
    if (!activeCwd) return;
    const controller = new AbortController();
    const refresh = async () => {
      try { const r = await fetch(`/api/browser/state?cwd=${encodeURIComponent(activeCwd)}`, { cache: "no-store", signal: controller.signal }); const data = await r.json(); if (r.ok && !controller.signal.aborted) setBrowserTasks(data.tasks ?? []); } catch { /* Live events continue independently. */ }
    };
    void refresh(); const timer = setInterval(() => void refresh(), 2500);
    return () => { controller.abort(); clearInterval(timer); };
  }, [activeCwd]);

  const refreshSessions = useCallback(async () => {
    try {
      const [response, workspaceResponse] = await Promise.all([
        fetch("/api/sessions", { cache: "no-store" }),
        fetch("/api/workspaces", { cache: "no-store" }),
      ]);
      const data = await response.json() as { sessions?: SessionInfo[]; runningSessionIds?: string[] };
      const workspaceData = await workspaceResponse.json() as { workspaces?: WorkspaceOption[] };
      if (!response.ok || !data.sessions) return;
      const nextSessions = data.sessions
        .filter((session) => session.relation?.kind !== "subagent")
        .sort((a, b) => Date.parse(b.modified) - Date.parse(a.modified));
      const nextWorkspaces = workspaceResponse.ok ? workspaceData.workspaces ?? [] : [];
      setSessions(nextSessions);
      setSessionsLoaded(true);
      setManagedWorkspaces(nextWorkspaces);
      setRunningIds(new Set(data.runningSessionIds ?? []));
      setActiveCwd((current) => current ?? nextWorkspaces[0]?.cwd ?? nextSessions[0]?.cwd ?? null);
    } catch {
      // The desktop stays usable while a transient refresh fails.
    }
  }, []);

  useEffect(() => {
    void refreshSessions();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshSessions();
    }, 2_500);
    return () => window.clearInterval(timer);
  }, [refreshSessions]);

  useEffect(() => {
    if (!activeCwd) {
      setInsightResults([]);
      setInsightRunning(false);
      knownInsightIdsRef.current = null;
      return;
    }
    knownInsightIdsRef.current = null;
    setInsightResults([]);
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const params = new URLSearchParams({ cwd: activeCwd });
        const response = await fetch(`/api/insights?${params}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json() as { running?: boolean; results?: InsightResult[] };
        if (!response.ok || controller.signal.aborted) return;
        const results = data.results ?? [];
        const ids = new Set(results.map((result) => `${result.sessionId}:${result.filePath}`));
        if (knownInsightIdsRef.current) {
          const newest = results.find((result) => !knownInsightIdsRef.current!.has(`${result.sessionId}:${result.filePath}`));
          if (newest) setInsightNotification(newest);
        }
        knownInsightIdsRef.current = ids;
        setInsightResults(results);
        setInsightRunning(data.running === true);
      } catch {
        // The desktop remains usable while the background observer restarts.
      }
    };
    void refresh();
    refreshInsightsRef.current = refresh;
    const timer = window.setInterval(() => void refresh(), 5_000);
    return () => { refreshInsightsRef.current = () => {}; controller.abort(); window.clearInterval(timer); };
  }, [activeCwd]);

  const workspaceSessions = useMemo(
    () => activeCwd
      ? sessions.filter((session) => (
        session.cwd === activeCwd
        && session.id !== jarvisSessionId
        && session.name !== "Jarvis"
        && session.name !== "Syntropic"
      ))
      : [],
    [activeCwd, jarvisSessionId, sessions],
  );
  const artifactRefreshKey = `${activeCwd ?? ""}|${workspaceSessions.map((session) => `${session.id}:${session.modified}`).join("|")}`;
  const canRevealArtifact = useEffectEvent(() => !(browserOpen && frontWindow === "browser"));
  useEffect(() => {
    const focusAtRequest = windowFocusRevision.current;
    const reference = presentationCwd && activeCwd ? workspaceReference(activeCwd) : undefined;
    const presetArtifacts: Artifact[] = reference && activeCwd ? [{ filePath: `${activeCwd}/${reference}`, sessionId: `preset:${activeCwd}`, cwd: activeCwd, taskTitle: "工作台资料", modified: new Date(0).toISOString() }] : [];
    if (!activeCwd || workspaceSessions.length === 0) {
      setArtifacts(presetArtifacts);
      // Before the first list arrives, existing results must remain historical.
      // A loaded, empty workspace is a real baseline: its first result is new,
      // even when the task finishes before the first detail request returns.
      knownArtifactIdsRef.current = activeCwd && sessionsLoaded
        ? new Set(presetArtifacts.map(artifactIdentity)) : null;
      return;
    }
    const controller = new AbortController();
    void Promise.all(workspaceSessions.map(async (session) => {
      try {
        const response = await fetch(`/api/sessions/${encodeURIComponent(session.id)}?tail=200&deferThinking=1&deferMedia=1`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json() as SessionDetailResponse;
        if (response.ok && data.context) {
          const lastAssistant = data.context.messages.filter((message) => message.role === "assistant").at(-1);
          if (!controller.signal.aborted) setTaskOutcomes((current) => ({ ...current, [session.id]: lastAssistant?.role === "assistant" && lastAssistant.stopReason === "error" ? "执行失败" : lastAssistant?.role === "assistant" && lastAssistant.stopReason === "aborted" ? "已停止" : "已完成" }));
          return extractArtifacts(session, data.context.messages);
        }
        return [];
      } catch {
        return [];
      }
    })).then((groups) => {
      if (controller.signal.aborted) return;
      const nextArtifacts = [...groups.flat(), ...presetArtifacts].sort((a, b) => Date.parse(b.modified) - Date.parse(a.modified));
      const nextIds = new Set(nextArtifacts.map(artifactIdentity));
      const knownIds = knownArtifactIdsRef.current;
      setArtifacts(nextArtifacts);
      setOpenArtifacts((current) => current.map((openArtifact) =>
        nextArtifacts.find((artifact) => artifactIdentity(artifact) === artifactIdentity(openArtifact)) ?? openArtifact));
      if (knownIds) {
        const newlyGenerated = nextArtifacts.filter((artifact) => !knownIds.has(artifactIdentity(artifact))).reverse();
        const insightSessionIds = new Set(
          workspaceSessions.filter(isInsightTaskSession).map((session) => session.id),
        );
        const desktopArtifacts = newlyGenerated.filter((artifact) => !insightSessionIds.has(artifact.sessionId));
        const activeElement = document.activeElement;
        const composerIsActive = activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement;
        if (desktopArtifacts.length && !composerIsActive && windowFocusRevision.current === focusAtRequest && canRevealArtifact()) {
          setOpenArtifacts((current) => {
            const openIds = new Set(current.map(artifactIdentity));
            return [...current, ...desktopArtifacts.filter((artifact) => !openIds.has(artifactIdentity(artifact)))];
          });
          setFrontWindow(`file:${artifactIdentity(desktopArtifacts.at(-1)!)}`);
        }
      }
      knownArtifactIdsRef.current = nextIds;
    });
    return () => controller.abort();
    // session metadata is intentionally represented by this stable string.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifactRefreshKey, sessionsLoaded]);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("session");
    if (requested) setTaskSessionId(requested);
  }, []);

  useEffect(() => {
    const preferredIds = new Set(["system:tasks", "system:library", "system:hr", "system:browser", "system:files", "system:settings", "system:store"]);
    const pinnedApps: DockItem[] = presentationCwd && localStorage.getItem(PINNED_DOCK_APPS_KEY) === null
      ? [...SYSTEM_DOCK_APPS.filter((app) => preferredIds.has(app.id)), { kind: "system", id: "system:calendar", name: "团队日程", description: "查看团队会议安排", category: "团队协作", icon: "clock", rank: 6 }]
      : readPinnedDockApps();
    if (presentationCwd && !pinnedApps.some((app) => app.id === "builtin:feishu")) pinnedApps.push(BUILTIN_LAUNCHPAD_APPS.find((app) => app.id === "builtin:feishu")!);
    setDockApps(pinnedApps);
    setPinnedDockAppIds(new Set(pinnedApps.map((app) => app.id)));
    setDockPinsLoaded(true);
  }, [presentationCwd]);

  useEffect(() => {
    if (!dockPinsLoaded) return;
    try {
      window.localStorage.setItem(PINNED_DOCK_APPS_KEY, JSON.stringify(
        dockApps.filter((app) => pinnedDockAppIds.has(app.id)),
      ));
    } catch {
      // A private browsing policy should not make the Dock unusable.
    }
  }, [dockApps, dockPinsLoaded, pinnedDockAppIds]);

  useEffect(() => {
    if (!dockContextMenu) return;
    const close = () => setDockContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("pointerdown", close);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [dockContextMenu]);

  useEffect(() => {
    if (!workspaceOpen) return;
    const closeOnOutsidePress = (event: globalThis.PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".agent-os-workspace-wrap")) return;
      setWorkspaceOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setWorkspaceOpen(false);
    };
    window.addEventListener("pointerdown", closeOnOutsidePress);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsidePress);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [workspaceOpen]);

  const workspaces = useMemo(() => {
    const map = new Map<string, WorkspaceOption>();
    for (const workspace of managedWorkspaces) map.set(workspace.cwd, workspace);
    // The Agent OS desktop owns only registered workspaces. Arbitrary session
    // directories belong in the session browser and must not become phantom
    // workspace cards here.
    if (activeCwd && !map.has(activeCwd)) map.set(activeCwd, {
      cwd: activeCwd,
      name: activeCwd.split(/[\\/]/).filter(Boolean).at(-1) ?? activeCwd,
      managed: false,
    });
    return [...map.values()];
  }, [activeCwd, managedWorkspaces]);

  const workspaceStats = useMemo(() => new Map(workspaces.map((workspace) => {
    const workspaceTasks = sessions.filter((session) => (
      session.cwd === workspace.cwd && !isInsightTaskSession(session)
    ));
    return [workspace.cwd, {
      taskCount: workspaceTasks.length,
      runningCount: workspaceTasks.filter((session) => runningIds.has(session.id)).length,
      latest: workspaceTasks[0]?.modified ?? null,
    }];
  })), [runningIds, sessions, workspaces]);

  const switchWorkspace = useCallback((cwd: string) => {
    if (cwd === activeCwd) {
      setWorkspaceOpen(false);
      return;
    }
    if (filesHaveUnsavedChanges) { setNotice("请先保存文件修改，再切换工作台"); return; }
    setNotice(null);
    if (presentationCwd) {
      try { localStorage.setItem(`syntropic:active-workspace:${presentationCwd}`, cwd); } catch { /* Optional UI persistence. */ }
      setScheduleOpen(false); setHrRecruitingOpen(false); setFilesOpen(false); setBrowserOpen(false); setAppStoreOpen(false);
      setSalesCrmOpen(false); setInvestmentWorkspaceOpen(false); setSettingsOpen(false); setTerminalOpen(false); setLaunchpadOpen(false);
      setOpenApps([]); setOpenFeishuDocuments([]); setArtifactLibraryOpen(false); setJarvisPanelOpen(false); setPendingRequest(null); setPrompt("");
    }
    setActiveCwd(cwd);
    setWorkspaceOpen(false);
    setTaskSessionId(null);
    setArtifacts([]);
    setOpenArtifacts([]); setSelectedInsight(null);
    setSelectedLibraryArtifactId(null);
    setInsightNotification(null);
    setNotificationCenterOpen(false);
    knownArtifactIdsRef.current = null;
    window.history.replaceState(null, "", "/");
  }, [activeCwd, presentationCwd, filesHaveUnsavedChanges, setNotice]);

  const createWorkspace = useCallback(async () => {
    const nextNumber = workspaces.filter((workspace) => workspace.name.startsWith("新工作台")).length + 1;
    const name = `新工作台 ${nextNumber}`;
    setWorkspaceBusy(true);
    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json() as { workspace?: WorkspaceOption; error?: string };
      if (!response.ok || !data.workspace) throw new Error(data.error ?? "工作台创建失败");
      setManagedWorkspaces((current) => [data.workspace!, ...current]);
      switchWorkspace(data.workspace.cwd);
      setNotice(`已创建“${data.workspace.name}”`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setWorkspaceBusy(false);
    }
  }, [switchWorkspace, workspaces, setNotice]);

  const deleteWorkspace = useCallback(async (workspace: WorkspaceOption) => {
    const taskCount = sessions.filter((session) => session.cwd === workspace.cwd).length;
    const detail = taskCount
      ? `这会同时删除其中的 ${taskCount} 个任务、洞察和产物。`
      : "这会同时删除其中的所有文件。";
    if (!window.confirm(`确定永久删除“${workspace.name}”吗？${detail}此操作无法撤销。`)) return;
    setWorkspaceBusy(true);
    try {
      const response = await fetch("/api/workspaces", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cwd: workspace.cwd }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "工作台删除失败");
      try {
        clearDesktopReminders(workspace.cwd);
      } catch {
        // Server-side deletion is complete even if browser storage is unavailable.
      }
      setManagedWorkspaces((current) => current.filter((item) => item.cwd !== workspace.cwd));
      setSessions((current) => current.filter((session) => session.cwd !== workspace.cwd));
      if (activeCwd === workspace.cwd) {
        const next = workspaces.find((item) => item.cwd !== workspace.cwd);
        if (next) switchWorkspace(next.cwd);
        else {
          setActiveCwd(null);
          setWorkspaceOpen(false);
          setTaskSessionId(null);
          setArtifacts([]);
          setOpenArtifacts([]); setSelectedInsight(null);
          window.history.replaceState(null, "", "/");
        }
      }
      setNotice(`已删除“${workspace.name}”`);
      void refreshSessions();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setWorkspaceBusy(false);
    }
  }, [activeCwd, refreshSessions, sessions, switchWorkspace, workspaces, setNotice]);

  const visibleTasks = useMemo(() => {
    const userSessions = workspaceSessions.filter((session) => !isInsightTaskSession(session));
    const running = userSessions.filter((session) => runningIds.has(session.id));
    const recent = userSessions.filter((session) => !runningIds.has(session.id));
    return [...running, ...recent];
  }, [runningIds, workspaceSessions]);

  const openTask = useCallback((sessionId: string) => {
    if (presentationCwd) {
      const browserTask = browserTasks.filter(task => task.parentSessionId === sessionId).at(-1);
      const artifact = artifacts.find(item => item.sessionId === sessionId);
      if (browserTask?.pageId) {
        setBrowserPageId(browserTask.pageId); setBrowserOpen(true); setFrontWindow("browser");
      } else if (artifact) {
        const identity = artifactIdentity(artifact);
        setOpenArtifacts(current => current.some(item => artifactIdentity(item) === identity) ? current : [...current, artifact]);
        setFrontWindow(`file:${identity}`);
      } else {
        setNotice(runningIds.has(sessionId) ? "任务正在推进，成果会显示在最近成果中" : "这项任务暂时没有可打开的成果");
      }
      return;
    }
    setTaskSessionId(sessionId);
    setFrontWindow("tasks");
    window.history.replaceState(null, "", `?session=${encodeURIComponent(sessionId)}`);
  }, [setFrontWindow, presentationCwd, browserTasks, artifacts, runningIds, setNotice]);

  useEffect(() => {
    if (!taskSessionId) return;
    const task = sessions.find((session) => session.id === taskSessionId);
    if (!task || task.cwd === activeCwd) return;
    setActiveCwd(task.cwd);
    setArtifacts([]);
    setOpenArtifacts([]); setSelectedInsight(null);
    knownArtifactIdsRef.current = null;
  }, [activeCwd, sessions, taskSessionId]);

  const openArtifact = useCallback((artifact: Artifact) => {
    const identity = artifactIdentity(artifact);
    setOpenArtifacts((current) => current.some((item) => artifactIdentity(item) === identity)
      ? current.map((item) => artifactIdentity(item) === identity ? artifact : item)
      : [...current, artifact]);
    setFrontWindow(`file:${identity}`);
  }, [setFrontWindow]);

  const openInsightResult = useCallback((result: InsightResult) => {
    setSelectedInsight(result);
    setFrontWindow("insights");
    setInsightNotification(null);
    setNotificationCenterOpen(false);
  }, [setFrontWindow]);

  const openFeishuDocument = useCallback((document: FeishuDocument) => {
    if (!document.url) return;
    setOpenFeishuDocuments((current) => current.some((item) => item.id === document.id)
      ? current.map((item) => item.id === document.id ? document : item)
      : [...current, document]);
    setFrontWindow(`feishu-document:${document.id}`);
    if (activeCwd) void fetch("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cwd: activeCwd, activity: "document.opened", document }),
    }).catch(() => undefined);
  }, [activeCwd, setFrontWindow]);

  const openArtifactLibrary = useCallback(() => {
    setArtifactLibraryOpen(true);
    setSelectedLibraryArtifactId((current) => current ?? (artifacts[0] ? artifactIdentity(artifacts[0]) : null));
    setFrontWindow("library");
  }, [artifacts, setFrontWindow]);

  const closeLaunchpad = useCallback(() => setLaunchpadOpen(false), []);

  const rememberDockItem = useCallback((item: DockItem) => {
    setDockApps((current) => current.some((dockItem) => dockItem.id === item.id)
      ? current.map((dockItem) => dockItem.id === item.id ? item : dockItem)
      : [...current, item]);
  }, []);

  const openLaunchpadApp = useCallback((app: LaunchpadApp) => {
    setLaunchpadOpen(false);
    setOpenApps((current) => current.some((item) => item.id === app.id)
      ? current.map((item) => item.id === app.id ? app : item)
      : [...current, app]);
    rememberDockItem(app);
    setDockContextMenu(null);
    setFrontWindow(`app:${app.id}`);
  }, [rememberDockItem, setFrontWindow]);

  const openInvestmentSource = useCallback(async (sourceId: "feishu" | "google" | "qichacha") => {
    if (sourceId === "feishu") {
      openLaunchpadApp(BUILTIN_LAUNCHPAD_APPS[0]);
      return;
    }
    if (sourceId === "qichacha") {
      const app = toConnectorLaunchpadApp("qichacha");
      if (app) openLaunchpadApp(app);
      return;
    }
    const existing = openApps.find((app) => app.kind === "plugin" && app.appearance === "google");
    if (existing) {
      openLaunchpadApp(existing);
      return;
    }
    try {
      const url = activeCwd ? `/api/plugins?cwd=${encodeURIComponent(activeCwd)}` : "/api/plugins";
      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json() as PluginsResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "无法读取应用列表");
      const google = getLaunchpadApps(data.packages).find((app) => app.kind === "plugin" && app.appearance === "google");
      if (google) {
        openLaunchpadApp(google);
        return;
      }
      setAppStoreOpen(true);
      setFrontWindow("store");
      setNotice("请先在应用商店安装 Google Workspace，再连接 Gmail");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }, [activeCwd, openApps, openLaunchpadApp, setNotice, setFrontWindow]);

  const openDockItem = useCallback((item: DockItem) => {
    if (item.kind !== "system") {
      openLaunchpadApp(item);
      return;
    }
    setLaunchpadOpen(false);
    setDockContextMenu(null);
    rememberDockItem(item);
    if (item.id === "system:calendar") {
      setScheduleOpen(true);
      setFrontWindow("schedule");
    } else if (item.id === "system:tasks") {
      if (sessions[0]) openTask(sessions[0].id);
    } else if (item.id === "system:library") {
      openArtifactLibrary();
    } else if (item.id === "system:crm") {
      setSalesCrmOpen(true);
      setFrontWindow("crm");
    } else if (item.id === "system:hr") {
      setHrRecruitingOpen(true);
      setFrontWindow("hr");
    } else if (item.id === "system:investment") {
      setInvestmentWorkspaceOpen(true);
      setFrontWindow("investment");
    } else if (item.id === "system:browser") {
      setBrowserOpen(true);
      setFrontWindow("browser");
    } else if (item.id === "system:files") {
      setFilesOpen(true);
      setFrontWindow("files");
    } else if (item.id === "system:terminal") {
      setTerminalOpen(true);
      setFrontWindow("terminal");
    } else if (item.id === "system:store") {
      setAppStoreOpen(true);
      setFrontWindow("store");
    } else if (item.id === "system:settings") {
      setSettingsOpen(true);
      setFrontWindow("settings");
    }
  }, [openArtifactLibrary, openLaunchpadApp, openTask, rememberDockItem, sessions, setFrontWindow]);

  const isDockItemOpen = useCallback((item: DockItem) => {
    if (item.kind !== "system") return openApps.some((openApp) => openApp.id === item.id);
    if (item.id === "system:calendar") return scheduleOpen;
    if (item.id === "system:tasks") return Boolean(taskSessionId) && frontWindow === "tasks";
    if (item.id === "system:library") return artifactLibraryOpen;
    if (item.id === "system:crm") return salesCrmOpen;
    if (item.id === "system:hr") return hrRecruitingOpen;
    if (item.id === "system:investment") return investmentWorkspaceOpen;
    if (item.id === "system:browser") return browserOpen;
    if (item.id === "system:files") return filesOpen;
    if (item.id === "system:terminal") return terminalOpen;
    if (item.id === "system:store") return appStoreOpen;
    return settingsOpen;
  }, [appStoreOpen, artifactLibraryOpen, browserOpen, filesOpen, frontWindow, hrRecruitingOpen, salesCrmOpen, investmentWorkspaceOpen, openApps, settingsOpen, taskSessionId, terminalOpen, scheduleOpen]);

  const toggleDockAppPin = useCallback((app: DockItem) => {
    setPinnedDockAppIds((current) => {
      const next = new Set(current);
      if (next.has(app.id)) {
        next.delete(app.id);
        if (!isDockItemOpen(app)) {
          setDockApps((dockItems) => dockItems.filter((item) => item.id !== app.id));
        }
      } else {
        next.add(app.id);
        rememberDockItem(app);
      }
      return next;
    });
    setDockContextMenu(null);
  }, [isDockItemOpen, rememberDockItem]);

  const releaseTemporaryDockItem = useCallback((id: string) => {
    if (!pinnedDockAppIds.has(id)) setDockApps((current) => current.filter((item) => item.id !== id));
  }, [pinnedDockAppIds]);

  const closeArtifactLibrary = useCallback(() => {
    setArtifactLibraryOpen(false);
    releaseTemporaryDockItem("system:library");
  }, [releaseTemporaryDockItem]);

  const closeAppStore = useCallback(() => {
    setAppStoreOpen(false);
    releaseTemporaryDockItem("system:store");
  }, [releaseTemporaryDockItem]);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    releaseTemporaryDockItem("system:settings");
  }, [releaseTemporaryDockItem]);

  const ensureCwd = useCallback(async () => {
    if (activeCwd) return activeCwd;
    const response = await fetch("/api/default-cwd", { method: "POST" });
    const data = await response.json() as { cwd?: string; error?: string };
    if (!response.ok || !data.cwd) throw new Error(data.error ?? "无法创建默认工作目录");
    setActiveCwd(data.cwd);
    return data.cwd;
  }, [activeCwd]);

  const startTask = useCallback(async (message: string, recruitingTask?: "publication") => {
    const normalizedMessage = message.trim();
    if (!normalizedMessage) return null;
    setSubmitting(true);
    try {
      const cwd = await ensureCwd();
      const response = await fetch("/api/agent/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cwd, type: "prompt", message: normalizedMessage, ...(recruitingTask ? { recruitingTask } : {}) }),
      });
      const data = await response.json() as { sessionId?: string; error?: string };
      if (!response.ok || !data.sessionId) throw new Error(data.error ?? "任务创建失败");
      setSessions((current) => [{
        id: data.sessionId!, path: "", cwd, created: new Date().toISOString(), modified: new Date().toISOString(),
        messageCount: 1, firstMessage: normalizedMessage, transient: true,
      }, ...current.filter((session) => session.id !== data.sessionId)]);
      markWorkspaceEngaged(cwd);
      setRunningIds((current) => new Set(current).add(data.sessionId!));
      setPrompt("");
      setNotice("任务已交给 Syntropic，正在桌面持续推进");
      window.setTimeout(() => void refreshSessions(), 450);
      return data.sessionId;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [ensureCwd, refreshSessions, markWorkspaceEngaged, setNotice]);

  // Jarvis is the desktop's conversation partner. It only talks and delegates;
  // real work runs in background Pi sessions that show up as tasks here.
  const handleJarvisTaskStarted = useCallback((task: JarvisTask) => {
    setPendingRequest(null);
    if (liveVoiceActiveRef.current) setLiveDispatches((current) => [...current.filter((item) => item.task.sessionId !== task.sessionId), { task, expiresAt: Date.now() + 12_000 }]);
    markWorkspaceEngaged(activeCwd);
    if (activeCwd) setSessions((current) => current.some((session) => session.id === task.sessionId) ? current : [{ id: task.sessionId, path: "", cwd: activeCwd, created: task.createdAt, modified: task.createdAt, messageCount: 1, firstMessage: task.description, transient: true }, ...current]);
    setNotice(`Syntropic 已派出任务：${task.description}`);
    setRunningIds((current) => new Set(current).add(task.sessionId));
    window.setTimeout(() => void refreshSessions(), 450);
  }, [activeCwd, markWorkspaceEngaged, refreshSessions, setNotice]);
  const handleJarvisTaskSettled = useCallback((task: JarvisTask) => {
    setNotice(`任务「${task.description}」${task.status === "aborted" ? "已停止" : task.status === "failed" ? "未完成，请查看详情" : "已完成"}`);
    setRunningIds((current) => {
      const next = new Set(current);
      next.delete(task.sessionId);
      return next;
    });
    window.setTimeout(() => void refreshSessions(), 450);
  }, [refreshSessions, setNotice]);
  const jarvis = useJarvis({ cwd: activeCwd, onTaskStarted: handleJarvisTaskStarted, onTaskSettled: handleJarvisTaskSettled });
  const sentAfterReplyRef = useRef(0);
  useEffect(() => {
    // Replies settle the task indicator; transcript visibility is user-owned.
    if (pendingRequest && !jarvis.running && jarvis.latestReplyTurnId > sentAfterReplyRef.current) {
      setPendingRequest(null);
    }
  }, [pendingRequest, jarvis.running, jarvis.latestReplyTurnId]);

  // Outranks the task window's ChatWindow so the voice conversation stays with
  // Jarvis even while a task window is open.
  const desktopVoice = useRealtimeVoice({
    priority: 20,
    agentRunning: jarvis.running,
    speechText: jarvis.speechText,
    onPrompt: jarvis.send,
    // Spoken turns take precedence over whatever Jarvis was still working on.
    onSteer: jarvis.interruptAndSend,
    onInterrupt: jarvis.interruptAndSend,
    onAbort: jarvis.abort,
  });

  useEffect(() => {
    if (jarvis.error) {
      setNotice(jarvis.error);
      setPendingRequest(null);
    }
  }, [jarvis.error, setNotice]);
  useEffect(() => {
    setJarvisSessionId(jarvis.sessionId);
  }, [jarvis.sessionId]);
  // Conversation history is available on demand without interrupting work.
  const compactTurns = useMemo(() => compactDesktopTurns(jarvis.turns, jarvis.tasks), [jarvis.turns, jarvis.tasks]);
  const followConversationRef = useRef(true);
  const latestJarvisTurnId = jarvis.turns.length ? jarvis.turns[jarvis.turns.length - 1].id : 0;
  const jarvisTranscriptRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const element = jarvisTranscriptRef.current;
    if (element && followConversationRef.current) element.scrollTop = element.scrollHeight;
  }, [jarvisPanelOpen, latestJarvisTurnId, jarvis.streamingText]);

  // Tell the server when the user is talking or Jarvis is speaking, so task
  // results wait for a pause instead of talking over the conversation.
  const voiceBusy = desktopVoice.state === "hearing" || desktopVoice.state === "speaking";
  useEffect(() => {
    if (!jarvis.sessionId) return;
    const sessionId = jarvis.sessionId;
    const timer = window.setTimeout(() => {
      void fetch("/api/jarvis", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, busy: voiceBusy }),
      }).catch(() => {});
    }, 250);
    return () => window.clearTimeout(timer);
  }, [jarvis.sessionId, voiceBusy]);

  useEffect(() => {
    if (desktopVoice.error) setNotice(desktopVoice.error);
  }, [desktopVoice.error, setNotice]);

  const sendDesktopMessage = async (text: string) => {
    const message = text.trim();
    if (!message || !jarvis.sessionId) return;
    sentAfterReplyRef.current = jarvis.latestReplyTurnId;
    markWorkspaceEngaged(activeCwd);
    setPendingRequest(message);
    dismissGuide();
    followConversationRef.current = true;
    setJarvisPanelOpen(false);
    composerInputRef.current?.blur();
    setPrompt("");
    desktopVoice.noteUserInput();
    await jarvis.send(message);
  };
  const submitPrompt = async (event: FormEvent) => {
    event.preventDefault();
    await sendDesktopMessage(prompt);
  };
  const dictationCompletionRef = useRef<"draft" | "send">("draft");
  // Tap-to-dictate can either return the finished transcript to the composer
  // or send it immediately, depending on which control ended the recording.
  const dictation = useDictation({
    onResult: (text) => {
      const completeText = prompt.trim() ? `${prompt.trimEnd()} ${text}` : text;
      if (dictationCompletionRef.current === "draft") {
        setPrompt(completeText);
        return;
      }
      setPrompt(completeText);
      void sendDesktopMessage(completeText);
    },
  });
  const startConversation = useCallback(() => {
    dictation.cancel();
    desktopVoice.toggle();
  }, [dictation, desktopVoice]);
  const jarvisRunningTasks = jarvis.tasks.filter((task) => task.status === "running");

  // Live discussion keeps captions and short dispatch receipts beside the orb.
  // Ongoing task progress belongs to the persistent collaboration shelf.
  const liveCaptionSource = desktopVoice.transcript
    ? { kind: "user" as const, text: desktopVoice.transcript }
    : desktopVoice.caption
      ? { kind: "jarvis" as const, text: desktopVoice.caption }
      : jarvis.streamingText
        ? { kind: "jarvis" as const, text: jarvis.streamingText }
        : null;
  const [liveCaption, setLiveCaption] = useState<{ kind: "user" | "jarvis"; text: string } | null>(null);
  useEffect(() => {
    if (!desktopVoice.isActive) {
      setLiveCaption(null);
      return;
    }
    if (liveCaptionSource) {
      setLiveCaption(liveCaptionSource);
      return;
    }
    const timer = window.setTimeout(() => setLiveCaption(null), 3_000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desktopVoice.isActive, liveCaptionSource?.kind, liveCaptionSource?.text]);
  useEffect(() => {
    liveVoiceActiveRef.current = desktopVoice.isActive;
    if (!desktopVoice.isActive) setLiveDispatches([]);
    return () => { liveVoiceActiveRef.current = false; };
  }, [desktopVoice.isActive]);
  useEffect(() => { setLiveDispatches([]); }, [activeCwd]);
  useEffect(() => {
    if (!liveDispatches.length) return;
    const nextExpiry = Math.min(...liveDispatches.map((item) => item.expiresAt));
    const timer = window.setTimeout(() => {
      setLiveDispatches((current) => current.filter((item) => item.expiresAt > Date.now()));
    }, Math.max(0, nextExpiry - Date.now()));
    return () => window.clearTimeout(timer);
  }, [liveDispatches]);
  const [liveMenuOpen, setLiveMenuOpen] = useState(false);
  useEffect(() => {
    if (!desktopVoice.isActive) {
      setLiveMenuOpen(false);
      return;
    }
    const endConversation = desktopVoice.toggle;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") endConversation();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [desktopVoice.isActive, desktopVoice.toggle]);

  const formatDate = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", weekday: "short" }).format(now);
  const formatTime = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  const runningCount = workspaceSessions.filter((session) => runningIds.has(session.id) && !isInsightTaskSession(session)).length;
  const hasOpenWindow = Boolean(selectedInsight || scheduleOpen || taskSessionId || artifactLibraryOpen || settingsOpen || appStoreOpen || salesCrmOpen || hrRecruitingOpen || investmentWorkspaceOpen || browserOpen || filesOpen || terminalOpen || launchpadOpen || openApps.length || openArtifacts.length || openFeishuDocuments.length);
  const hasStartedWork = Boolean(activeCwd && engagedWorkspaces.has(activeCwd)) || visibleTasks.length > 0 || artifacts.length > 0;
  useEffect(() => {
    if (visibleTasks.length > 0 || artifacts.length > 0 || jarvis.running) markWorkspaceEngaged(activeCwd);
  }, [activeCwd, visibleTasks.length, artifacts.length, jarvis.running, markWorkspaceEngaged]);
  const showStart = !hasStartedWork && !hasOpenWindow && !jarvisPanelOpen && !desktopVoice.isActive && !jarvis.running && (guideOpen || (!guideDismissed && visibleTasks.length === 0 && artifacts.length === 0 && reminderCount === 0 && insightResults.length === 0));
  const startPlaceholder = startMode === "files" ? "想怎样处理这份材料？" : startMode === "apps" ? "想让应用帮你做什么？" : "比较两款产品，或研究一个你关心的问题…";
  const chooseStart = (mode: "research" | "files" | "apps") => {
    setStartMode(mode);
  };
  const dockContextApp = dockContextMenu ? dockApps.find((app) => app.id === dockContextMenu.appId) : null;
  const pinnedDockItems = dockApps.filter((item) => pinnedDockAppIds.has(item.id));
  const temporaryDockItems = dockApps.filter((item) => !pinnedDockAppIds.has(item.id));
  const renderDockItem = (item: DockItem) => {
    const open = isDockItemOpen(item);
    const className = item.kind === "system" ? `dock-${item.id.slice(7)}` : `dock-app is-${item.appearance}${item.kind === "connector" ? " is-official-icon" : ""}`;
    return <button
      key={item.id}
      className={`${className}${open ? " is-open" : ""}`}
      type="button"
      aria-label={open ? `切换到 ${item.name}` : `打开 ${item.name}`}
      aria-pressed={open}
      data-label={item.name}
      onClick={() => openDockItem(item)}
      onContextMenu={(event) => {
        event.preventDefault();
        setDockContextMenu({ appId: item.id, x: event.clientX, y: event.clientY - 8 });
      }}
    >
      <DockItemIcon item={item}/>
      {item.kind === "system" && item.id === "system:tasks" && runningCount > 0 ? <em>{runningCount}</em> : null}
    </button>;
  };

  const widgetTasks: WorkspaceWidgetItem[] = visibleTasks.map((session) => {
    const browserTask = browserTasks.filter((task) => task.parentSessionId === session.id).at(-1);
    const running = browserTask ? ["starting", "running", "stopping"].includes(browserTask.status) : runningIds.has(session.id);
    const status = browserTask ? ({ completed: "已完成", failed: "执行失败", stopped: "已停止", starting: "正在准备", running: "进行中", stopping: "正在停止" })[browserTask.status] : running ? "进行中" : jarvis.tasks.find((task) => task.sessionId === session.id)?.status === "aborted" ? "已停止" : taskOutcomes[session.id] ?? "查看任务进展";
    return { id: session.id, title: taskTitle(session), detail: status, running, onOpen: () => openTask(session.id) };
  });
  for (const task of browserTasks.filter((task) => task.cwd === activeCwd && !workspaceSessions.some((session) => session.id === task.parentSessionId))) {
    widgetTasks.push({ id: task.id, title: /发布/.test(task.task) ? "发布 AI Agent 工程师岗位" : "查询招聘进展", detail: ({ completed: "已完成", failed: "执行失败", stopped: "已停止", starting: "正在准备", running: "进行中", stopping: "正在停止" })[task.status], running: ["starting", "running", "stopping"].includes(task.status), onOpen: () => { if (task.pageId) { setBrowserPageId(task.pageId); setBrowserOpen(true); setFrontWindow("browser"); } } });
  }
  if (pendingRequest && jarvis.running) widgetTasks.unshift({ id: "pending-request", title: pendingRequest, detail: "正在准备", running: true, onOpen: () => { if (presentationCwd) setNotice("正在准备任务，进展会显示在当前任务中"); else setJarvisPanelOpen(true); } });
  widgetTasks.sort((a, b) => Number(Boolean(b.running)) - Number(Boolean(a.running)));

  return (
    <RecruitingPublication
        key={activeCwd ?? "no-workspace"}
        notice={notice}
        onDismissNotice={() => setNotice(null)}
        insights={insightResults}
        browserTasks={browserTasks}
        onOpenInsight={openInsightResult}
        cwd={activeCwd}
        viewedArtifact={frontWindow === "insights" && selectedInsight ? { ...selectedInsight, taskTitle: "AI 洞察" } : openArtifacts.find((artifact) => `file:${artifactIdentity(artifact)}` === frontWindow) ?? null}
        onStartTask={(message) => startTask(message, "publication")}
        onTaskStarted={(sessionId) => { publicationSessionRef.current = sessionId; }}
        onPublished={(job, sessionId) => {
          setPublishedDraft(job.draft);
          const origin = browserReturnOriginRef.current;
          if (origin?.sessionId === sessionId && isBrowserOriginCurrent(origin, { cwd: activeCwd, taskSessionId, publicationSessionId: publicationSessionRef.current, browserOpen, frontWindow })) {
            browserReturnOriginRef.current = null;
            setJarvisPanelOpen(false);
            setHrRecruitingOpen(true);
            setFrontWindow("hr");
          }
          setNotice(`「${job.title}」已发布到内部招聘系统`);
        }}
        onSettled={(sessionId) => {
          if (publicationSessionRef.current === sessionId) publicationSessionRef.current = null;
          if (browserReturnOriginRef.current?.sessionId === sessionId) browserReturnOriginRef.current = null;
        }}
        onNotice={setNotice}
    >
      {({ notification, widgetInsights }) => (
    <main className={`agent-os${showStart ? " has-start-guide" : ""}`}>
      <div className="agent-os-wallpaper" aria-hidden="true"/>

      <header className="agent-os-menu-bar">
        <button className="agent-os-brand" type="button" onClick={() => { setTaskSessionId(null); setOpenArtifacts([]); setSelectedInsight(null); setArtifactLibraryOpen(false); window.history.replaceState(null, "", "/"); }}>
          <BrandMark/><strong>Syntropic</strong>
        </button>
        <div className="agent-os-workspace-wrap">
          <button className="agent-os-workspace" type="button" aria-haspopup="dialog" aria-expanded={workspaceOpen} onClick={() => setWorkspaceOpen((value) => !value)}>
            <i/><span className="agent-os-workspace-name">{workspaces.find((item) => item.cwd === activeCwd)?.name ?? "Agent 工作台"}</span><span className={`agent-os-workspace-chevron${workspaceOpen ? " open" : ""}`} aria-hidden="true"><Icon name="chevron-down" size={12}/></span>
          </button>
          {workspaceOpen && <section className="agent-os-workspace-menu" role="dialog" aria-label="管理工作台">
            <header>
              <span><strong>工作台</strong><small>{workspaces.length} 个工作台</small></span>
              <button type="button" onClick={() => void createWorkspace()} disabled={workspaceBusy} aria-label="新建工作台" title="新建工作台"><Icon name="plus" size={15}/></button>
            </header>
            {workspaces.length ? <div className="agent-os-workspace-grid" role="list">{workspaces.map((workspace, index) => {
              const stats = workspaceStats.get(workspace.cwd) ?? { taskCount: 0, runningCount: 0, latest: null };
              const active = workspace.cwd === activeCwd;
              return <article className={`agent-os-workspace-tile tone-${index % 4}${active ? " active" : ""}`} role="listitem" key={workspace.cwd}>
                {workspace.managed && (!presentationCwd || workspace.cwd !== presentationCwd) && <button className="delete" type="button" aria-label={`删除 ${workspace.name}`} title="删除工作台" disabled={workspaceBusy} onClick={() => void deleteWorkspace(workspace)}><Icon name="close" size={10}/></button>}
                <button className="select" type="button" onClick={() => switchWorkspace(workspace.cwd)} aria-current={active ? "true" : undefined} aria-label={`切换到${workspace.name}，${stats.taskCount} 个任务，${stats.runningCount} 个运行中`}>
                  <span className="agent-os-workspace-preview" aria-hidden="true"><i className="one"/><i className="two"/><i className="three"/></span>
                  <span className="agent-os-workspace-copy"><strong>{workspace.name}</strong></span>
                </button>
              </article>;
            })}</div> : <div className="agent-os-workspace-empty"><span><Icon name="grid" size={24}/></span><strong>还没有工作台</strong><small>新建一个工作台，让任务、洞察和产物彼此独立。</small></div>}
          </section>}
        </div>
        <div className="agent-os-system-status">
          <button
            type="button"
            className={notificationCenterOpen ? "is-active" : ""}
            aria-label="通知"
            aria-expanded={notificationCenterOpen}
            onClick={() => setNotificationCenterOpen((value) => !value)}
          >
            <DesktopDesignIcon name="bell" size={20}/>
            {(runningCount > 0 || insightNotification) && <i className={insightNotification ? "is-insight" : ""}/>}
          </button>
          <span suppressHydrationWarning>{formatDate}</span><span suppressHydrationWarning>{formatTime}</span><button className="agent-os-avatar" type="button" aria-label="Syntropic"><SyntropicMark size={16}/></button>
          {notificationCenterOpen && (
            <section className="agent-os-notification-center" aria-label="通知中心">
              <header><strong>通知</strong><small>{insightResults.length ? `${insightResults.length} 条洞察` : "暂无新通知"}</small></header>
              <div>
                {insightResults.length ? insightResults.map((result) => (
                  <button type="button" key={`${result.sessionId}:${result.filePath}`} onClick={() => openInsightResult(result)}>
                    <span><Icon name="insight" size={16}/></span>
                    <span><strong>{result.title}</strong></span>
                    <time>{formatInsightModified(result.modified)}</time>
                  </button>
                )) : <p>新的洞察会出现在这里</p>}
              </div>
            </section>
          )}
        </div>
      </header>

      <section className="agent-os-desktop" aria-label="Syntropic 桌面">
        <DraggableDesktopWidget
          className={`agent-os-widget-reminders${reminderCount === 0 ? " is-empty-hidden" : ""}`}
          defaultPosition={{ left: "clamp(34px, 9vw, 180px)", top: "clamp(90px, 15vh, 165px)" }}
          widgetId="reminders"
        >
          <DesktopReminders
            key={activeCwd ?? "default"}
            workspaceKey={activeCwd ?? "default"}
            onLaunch={(title) => startTask(`请完成以下待办事项：${title}\n\n请先理解当前项目上下文，然后直接实施并验证结果。除非待办事项明确提到某项外部服务，否则只使用当前项目文件和本地工具，不要主动检查或请求配置 Linear、Slack、Notion、Figma 等外部账号。`)}
            onOpenTask={openTask}
            onHistoryChange={handleReminderHistory}
          />
        </DraggableDesktopWidget>

        {presentationCwd && activeCwd && <DesktopWorkspaceWidgets key={activeCwd} cwd={activeCwd} recruiting={activeCwd === presentationCwd}
          working={widgetTasks.some(task => task.running)} tasks={widgetTasks}
          artifacts={artifacts.map(artifact => ({ id: artifactIdentity(artifact), title: getFileName(artifact.filePath), detail: artifact.taskTitle, onOpen: () => openArtifact(artifact) }))}
          insights={widgetInsights}
          onOpenLibrary={openArtifactLibrary} onOpenRecruiting={() => { setHrRecruitingOpen(true); setFrontWindow("hr"); }}
          onOpenSchedule={() => { setScheduleOpen(true); setFrontWindow("schedule"); }}
          onOpenPreset={file => openArtifact({ filePath: `${activeCwd}/${file}`, sessionId: `preset:${activeCwd}`, cwd: activeCwd, taskTitle: "工作台资料", modified: new Date().toISOString() })}/> }
        {!presentationCwd && hasStartedWork && <DraggableDesktopWidget className="collaboration-shelf" widgetId="collaboration-shelf-v1" defaultPosition={{ left: "24px", top: "32px" }}>
          <DesktopCollaboration
            working={runningCount > 0 || jarvis.running}
            analyzing={insightRunning}
            tasks={visibleTasks.map((session) => {
              const running = runningIds.has(session.id);
              const files = artifacts.filter((artifact) => artifact.sessionId === session.id).length;
              const status = jarvis.tasks.find((task) => task.sessionId === session.id)?.status;
              return { id: session.id, title: taskTitle(session), running, detail: running ? "正在推进" : status === "aborted" ? "已停止 · 查看详情" : files ? `已生成 ${files} 个文件` : "查看任务进展", onOpen: () => openTask(session.id) };
            })}
            artifacts={artifacts.map((artifact) => ({ id: artifactIdentity(artifact), title: getFileName(artifact.filePath), detail: artifact.taskTitle, onOpen: () => openArtifact(artifact) }))}
            insights={insightResults.map((result) => ({ id: `${result.sessionId}:${result.filePath}`, title: result.title, detail: formatInsightModified(result.modified), onOpen: () => openInsightResult(result) }))}
            onOpenLibrary={openArtifactLibrary}
          />
        </DraggableDesktopWidget>}

      </section>

      <Launchpad open={launchpadOpen} cwd={activeCwd} onClose={closeLaunchpad} onOpenApp={openDockItem}/>

      <section className="agent-os-window-layer">
        {!presentationCwd && taskSessionId && <DesktopWindow title="任务" kind="tasks" front={frontWindow === "tasks"} onFocus={() => setFrontWindow("tasks")} onClose={() => { setTaskSessionId(null); window.history.replaceState(null, "", "/"); }}>
          <div className="agent-os-pi-app"><AppShell key={taskSessionId} initialSessionId={taskSessionId}/></div>
        </DesktopWindow>}
        {artifactLibraryOpen && <DesktopWindow title="产物库" kind="library" front={frontWindow === "library"} onFocus={() => setFrontWindow("library")} onClose={closeArtifactLibrary}>
          <ArtifactLibrary
            artifacts={artifacts}
            selectedId={selectedLibraryArtifactId}
            onSelect={(artifact) => setSelectedLibraryArtifactId(artifactIdentity(artifact))}
            onOpen={openArtifact}
          />
        </DesktopWindow>}
        {openArtifacts.map((artifact, index) => {
          const identity = artifactIdentity(artifact);
          const windowId = `file:${identity}`;
          const isDemoJd = artifact.cwd === presentationCwd && getFileName(artifact.filePath) === "ai-agent-engineer-jd.html";
          return <DesktopWindow
            key={identity}
            title={isDemoJd ? "岗位 JD" : getFileName(artifact.filePath)}
            className={isDemoJd ? "agent-os-window-jd" : undefined}
            titleIcon={isDemoJd ? <Image src="/design/jd/command-line.svg" width={20} height={20} alt="" unoptimized/> : undefined}
            headerAccessory={isDemoJd ? <span className="jd-window-status">星流科技 正在招聘</span> : undefined}
            kind="file"
            cascadeIndex={index}
            front={frontWindow === windowId}
            onFocus={() => setFrontWindow(windowId)}
            onClose={() => {
              const remaining = openArtifacts.filter((item) => artifactIdentity(item) !== identity);
              const nextFront = remaining.at(-1);
              setOpenArtifacts(remaining);
              setFrontWindow(nextFront ? `file:${artifactIdentity(nextFront)}` : artifactLibraryOpen ? "library" : "tasks");
            }}
          >
            <div className="agent-os-file-app"><FileViewer filePath={artifact.filePath} cwd={artifact.cwd} sourceSessionId={artifact.sessionId} initialDisplayMode={isHtmlArtifact(artifact) ? "preview" : undefined} watchEnabled={frontWindow === windowId}/></div>
          </DesktopWindow>;
        })}
        {selectedInsight && selectedInsight.cwd === activeCwd && <DesktopWindow className="agent-os-window-insights" title="AI 洞察" kind="app" front={frontWindow === "insights"} onFocus={() => setFrontWindow("insights")} onClose={() => setSelectedInsight(null)}>
          <InsightsApp
            results={insightResults}
            selected={insightResults.find(item => item.filePath === selectedInsight.filePath) ?? selectedInsight}
            analyzing={insightRunning}
            onSelect={openInsightResult}
            onOpenFile={() => openArtifact({ ...selectedInsight, taskTitle: "AI 洞察" })}
          />
        </DesktopWindow>}
        {scheduleOpen && <DesktopWindow kind="app" title="团队日程" front={frontWindow === "schedule"} onFocus={() => setFrontWindow("schedule")} onClose={() => setScheduleOpen(false)}><PresentationSchedule recruiting={!presentationCwd || activeCwd === presentationCwd} demoAppointments={!!presentationCwd && activeCwd === presentationCwd}/></DesktopWindow>}
        {openFeishuDocuments.map((document, index) => {
          const windowId = `feishu-document:${document.id}`;
          return <DesktopWindow
            key={document.id}
            title={document.title}
            titleIcon={<Image src="/icons/feishu-logo.svg" width={16} height={16} unoptimized alt=""/>}
            kind="document"
            cascadeIndex={index}
            front={frontWindow === windowId}
            onFocus={() => setFrontWindow(windowId)}
            onClose={() => {
              const remaining = openFeishuDocuments.filter((item) => item.id !== document.id);
              const nextDocument = remaining.at(-1);
              setOpenFeishuDocuments(remaining);
              setFrontWindow(nextDocument ? `feishu-document:${nextDocument.id}` : openApps.some((app) => app.id === "builtin:feishu") ? "app:builtin:feishu" : "tasks");
            }}
          ><>{document.source === "feishu-demo" ? <FeishuDemoDocument id={document.id}/> : <FeishuDocumentEditor document={document}/>}</></DesktopWindow>;
        })}
        {settingsOpen && <DesktopWindow title="设置" kind="settings" front={frontWindow === "settings"} onFocus={() => setFrontWindow("settings")} onClose={closeSettings}>
          <AgentSettingsApp cwd={activeCwd} sessionId={taskSessionId} onClose={closeSettings} onSessionReloaded={() => void refreshSessions()}/>
        </DesktopWindow>}
        {appStoreOpen && <DesktopWindow title="应用市场" kind="store" front={frontWindow === "store"} onFocus={() => setFrontWindow("store")} onClose={closeAppStore} titleIcon={<AppStoreBrandIcon className="agent-store-title-icon"/>}>
          <AppStore onOpenApp={openLaunchpadApp} onNotice={setNotice}/>
        </DesktopWindow>}
        {salesCrmOpen && <DesktopWindow className="agent-os-window-crm" title="销售 CRM" kind="app" front={frontWindow === "crm"} onFocus={() => setFrontWindow("crm")} onClose={() => {
          setSalesCrmOpen(false);
          releaseTemporaryDockItem("system:crm");
        }} titleIcon={<Icon name="sales" size={16}/>}>
          <SalesCRMApp key={activeCwd ?? "no-workspace"} cwd={activeCwd} onStartTask={startTask} onNotice={setNotice}/>
        </DesktopWindow>}
        {hrRecruitingOpen && <DesktopWindow className="agent-os-window-hr" title="人才招聘" kind="app" front={frontWindow === "hr"} onFocus={() => setFrontWindow("hr")} onClose={() => {
          setHrRecruitingOpen(false);
          releaseTemporaryDockItem("system:hr");
        }} titleIcon={<span className="agent-os-hr-title-icon"><Icon name="recruiting" size={13}/></span>}>
          <HRRecruitingApp
              presentation={Boolean(presentationCwd)}
              onOpenInsight={openInsightResult}
            cwd={activeCwd}
            publishedDraft={publishedDraft}
            onOpenPublishedJob={(url) => {
              if (!activeCwd) return;
              void fetch("/api/browser/pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cwd: activeCwd, url, foreground: true }) })
                .then(async (response) => { if (!response.ok) throw new Error("无法打开职位网页"); })
                .catch(() => setNotice("无法打开职位网页，请稍后重试。"));
            }}
            onStartTask={startTask}
            onOpenSource={(sourceId) => {
              if (sourceId === "feishu") {
                openLaunchpadApp(BUILTIN_LAUNCHPAD_APPS[0]);
                return;
              }
              const app = toConnectorLaunchpadApp(sourceId);
              if (app) openLaunchpadApp(app);
            }}
            onNotice={setNotice}
          />
        </DesktopWindow>}
        {investmentWorkspaceOpen && <DesktopWindow className="agent-os-window-investment" title="投资管理" kind="app" front={frontWindow === "investment"} onFocus={() => setFrontWindow("investment")} onClose={() => {
          setInvestmentWorkspaceOpen(false);
          releaseTemporaryDockItem("system:investment");
        }} titleIcon={<span className="agent-os-investment-title-icon"><Icon name="investment" size={13}/></span>}>
          <InvestmentWorkspaceApp key={activeCwd ?? "no-workspace"} cwd={activeCwd} onStartTask={startTask} onNotice={setNotice} onOpenSource={(sourceId) => { void openInvestmentSource(sourceId); }}/>
        </DesktopWindow>}
        {browserOpen && activeCwd && <DesktopWindow className="agent-os-window-browser" title="浏览器" kind="app" front={frontWindow === "browser"} onFocus={() => setFrontWindow("browser")} onClose={() => {
          setBrowserOpen(false);
          releaseTemporaryDockItem("system:browser");
        }} titleIcon={<Icon name="browser" size={16}/> }>
          <BrowserApp key={activeCwd} onUserInteraction={cancelBrowserReturn} cwd={activeCwd} initialPageId={browserPageId} onOpenSettings={() => { setSettingsOpen(true); setFrontWindow("settings"); }}/>
        </DesktopWindow>}
        {filesOpen && activeCwd && <DesktopWindow title="文件" kind="app" front={frontWindow === "files"} onFocus={() => setFrontWindow("files")} onClose={() => {
          if (filesHaveUnsavedChanges && !window.confirm("文件应用中有未保存的修改，确定关闭吗？")) return;
          setFilesOpen(false);
          setFilesHaveUnsavedChanges(false);
          releaseTemporaryDockItem("system:files");
        }} titleIcon={<Icon name="folder" size={16}/> }>
          <FilesApp key={activeCwd} cwd={activeCwd} openRequest={fileOpenRequest} onDirtyChange={setFilesHaveUnsavedChanges} watchEnabled={frontWindow === "files"}/>
        </DesktopWindow>}
        {terminalOpen && activeCwd && <DesktopWindow className="agent-os-window-terminal" title="终端" kind="app" front={frontWindow === "terminal"} onFocus={() => setFrontWindow("terminal")} onClose={() => {
          setTerminalOpen(false);
          releaseTemporaryDockItem("system:terminal");
        }} titleIcon={<Icon name="terminal" size={16}/> }>
          <TerminalApp key={activeCwd} cwd={activeCwd}/>
        </DesktopWindow>}
        {openApps.map((app, index) => {
          const windowId = `app:${app.id}`;
          return <DesktopWindow key={app.id} title={app.name} titleIcon={<AppLogo app={app} compact/>} kind="app" cascadeIndex={index} front={frontWindow === windowId} onFocus={() => setFrontWindow(windowId)} onClose={() => {
            const remaining = openApps.filter((item) => item.id !== app.id);
            const nextApp = remaining.at(-1);
            setOpenApps(remaining);
            if (!pinnedDockAppIds.has(app.id)) setDockApps((current) => current.filter((item) => item.id !== app.id));
            setFrontWindow(nextApp ? `app:${nextApp.id}` : "tasks");
          }}>
            {app.kind === "builtin" ? (
              <>{presentationCwd ? <FeishuDemoApp recruiting={activeCwd === presentationCwd} onOpen={openFeishuDocument}/> : <FeishuAppView app={app} onNotice={setNotice} onOpenDocument={openFeishuDocument}/>}</>
            ) : (
              <ConnectedAppView app={app} onNotice={setNotice}/>
            )}
          </DesktopWindow>;
        })}
      </section>

      <section className={`agent-os-ai-surface${showStart ? " is-starting" : ""}${desktopVoice.isActive ? ` voice-active voice-${desktopVoice.state}` : ""}`}>
        {showStart && <DesktopStartStage scene={startMode ?? "research"} onSceneChange={chooseStart} onDismiss={dismissGuide}/>}
        {!presentationCwd && jarvisPanelOpen ? (
          <section className={`agent-os-jarvis-panel voice-${desktopVoice.state}${jarvis.running ? " is-running" : ""}${desktopVoice.isActive ? " is-live" : ""}`} aria-label="Syntropic 对话" id="desktop-conversation">
            <header>
              <span className="conversation-heading"><Icon name="chat" size={14}/><strong>对话</strong><small>{jarvis.running ? "正在回应" : "Syntropic"}</small></span>
              <button type="button" onClick={jarvis.reset} title="开始一段新的对话">新对话</button>
              <button type="button" aria-label="收起对话记录" onClick={() => setJarvisPanelOpen(false)}><Icon name="close" size={14}/></button>
            </header>
            <div className="agent-os-jarvis-transcript" ref={jarvisTranscriptRef} onScroll={(event) => { const el = event.currentTarget; followConversationRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48; }}>
              {jarvis.turns.length === 0 && !jarvis.running ? (
                <p className="agent-os-jarvis-empty">你好，我是 Syntropic。告诉我你想做什么，我会帮你理清思路、推进任务，并在完成后告诉你。</p>
              ) : null}
              {compactTurns.map((turn) => turn.role === "task" && turn.task ? (
                <button
                  key={turn.id}
                  type="button"
                  className={`agent-os-jarvis-task is-${turn.task.status}${turn.taskEvent === "settled" ? " is-settled" : ""}`}
                  onClick={() => openTask(turn.task!.sessionId)}
                  title="打开任务窗口查看细节"
                >
                  <span className="conversation-task-icon"><Icon name={turn.task.status === "running" ? "clock" : "tasks"} size={16}/></span>
                  <span className="conversation-task-copy"><small>后台任务 · {turn.task.status === "running" ? "正在执行" : turn.task.status === "aborted" ? "已停止" : turn.task.status === "failed" ? "未完成，请查看详情" : "已完成"}</small><strong>{turn.task.description}</strong></span>
                  <span className="conversation-task-open" aria-hidden="true">↗</span>
                </button>
              ) : (
                <div key={turn.id} className={`agent-os-jarvis-bubble is-${turn.role}`}>{turn.text}</div>
              ))}
              {jarvis.streamingText ? <div className="agent-os-jarvis-bubble is-assistant is-live">{jarvis.streamingText}</div> : null}
              {jarvis.running && !jarvis.streamingText ? <div className="agent-os-jarvis-bubble is-assistant is-thinking"><i/><i/><i/></div> : null}
              {desktopVoice.transcript ? <div className="agent-os-jarvis-bubble is-user is-live">{desktopVoice.transcript}</div> : null}
            </div>
            {jarvisRunningTasks.length > 0 && <footer><small><i className="conversation-active-dot"/>{jarvisRunningTasks.length} 个任务在后台推进</small><span>收起后仍会继续</span></footer>}
          </section>
        ) : null}
        {desktopVoice.isActive ? (
          <div className={`agent-os-live${liveMenuOpen ? " is-menu-open" : ""}`} data-state={desktopVoice.state}>
            {liveCaption ? (
              <div key={liveCaption.kind} className={`agent-os-caption is-${liveCaption.kind}`} aria-live="polite">{liveCaption.text}</div>
            ) : null}
            <div className="agent-os-live__row">
              <div className="agent-os-live__chips" aria-label="新派出的任务" aria-live="polite">
                {liveDispatches.slice(-3).map(({ task }) => (
                  <button key={task.sessionId} type="button" className="agent-os-live__chip is-dispatched" onClick={() => openTask(task.sessionId)} title="打开任务窗口">
                    <i/><span><small>已派出</small><strong>{task.description}</strong><em>进展见「当前任务」</em></span><Icon name="arrow-up" size={13}/>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="agent-os-live__orb"
                aria-label={desktopVoice.isSpeaking ? "打断 Syntropic" : liveMenuOpen ? "收起选项" : "Syntropic 选项"}
                onClick={() => {
                  if (desktopVoice.isSpeaking) desktopVoice.interrupt();
                  else setLiveMenuOpen((value) => !value);
                }}
              >
                <VoiceOrb state={desktopVoice.state} level={desktopVoice.voiceLevel} size={112}/>
              </button>
              <div className="agent-os-live__actions">
                {!presentationCwd && <button type="button" aria-pressed={jarvisPanelOpen} onClick={() => { setJarvisPanelOpen((value) => !value); setLiveMenuOpen(false); }} title={jarvisPanelOpen ? "隐藏文字记录" : "文字记录"}><Icon name="chat" size={16}/></button>}
                <button type="button" className="end" onClick={desktopVoice.toggle} title="结束对话（Esc）"><Icon name="close" size={16}/></button>
              </div>
            </div>
          </div>
        ) : (
        <form className={`agent-os-composer${dictation.isRecording ? " is-dictating" : ""}`} onSubmit={submitPrompt}>
          {dictation.isRecording ? (
            <div className="agent-os-dictation" role="status" aria-live="polite">
              {presentationCwd ? <span className="composer-brand" aria-hidden="true"><BrandMark compact/></span> : <button className="jarvis-toggle" type="button" aria-label={jarvisPanelOpen ? "收起 Syntropic 面板" : "打开 Syntropic 面板"} aria-pressed={jarvisPanelOpen} onClick={() => setJarvisPanelOpen((value) => !value)}><BrandMark compact/></button>}
              <div className="agent-os-dictation__capture">
                <span className="agent-os-dictation__wave" aria-hidden="true" style={{ "--voice-level": dictation.level } as React.CSSProperties}>
                  {DICTATION_BARS.map((weight, index) => <i key={index} style={{ "--bar": weight, "--delay": `${index * 37}ms` } as React.CSSProperties}/>)}
                </span>
                {dictation.transcript ? <span className="agent-os-dictation__text">{dictation.transcript}</span> : null}
              </div>
              <button type="button" className="agent-os-dictation__stop" aria-label="停止听写并返回输入框" disabled={dictation.state === "finishing"} onClick={() => { dictationCompletionRef.current = "draft"; dictation.stop(); }}><span aria-hidden="true"/></button>
              <button type="button" className="send agent-os-dictation__send" aria-label="发送语音转录" disabled={dictation.state === "finishing"} onClick={() => { dictationCompletionRef.current = "send"; dictation.stop(); }}>{dictation.state === "finishing" && dictationCompletionRef.current === "send" ? <span className="agent-os-spinner"/> : <Icon name="arrow-up" size={19}/>}</button>
            </div>
          ) : (
            <>
              {presentationCwd ? <span className="composer-brand" aria-hidden="true"><BrandMark compact/></span> : <button className="jarvis-toggle" type="button" aria-label={jarvisPanelOpen ? "收起 Syntropic 面板" : "打开 Syntropic 面板"} aria-pressed={jarvisPanelOpen} onClick={() => setJarvisPanelOpen((value) => !value)}><BrandMark compact/></button>}
              {showStart && (startMode === "files" || startMode === "apps") && <button className="stage-resource-button" type="button" disabled={openingStartResource} onClick={async () => {
                if (startMode === "apps") { setGuideOpen(false); setLaunchpadOpen(true); return; }
                setOpeningStartResource(true);
                try { await ensureCwd(); setGuideOpen(false); setFilesOpen(true); setFrontWindow("files"); }
                catch (error) { setNotice(error instanceof Error ? error.message : "无法打开工作台文件"); }
                finally { setOpeningStartResource(false); }
              }}>{openingStartResource ? "打开中…" : startMode === "files" ? "浏览文件" : "选择应用"}</button>}
              <DesktopComposerInput key={activeCwd} inputRef={composerInputRef} value={prompt} onChange={setPrompt}
                recruiting={!!presentationCwd && activeCwd === presentationCwd} hasJd={artifacts.some(isJdDemoArtifact)}
                busy={jarvis.running || widgetTasks.some(task => task.running)} viewingRecruiting={hrRecruitingOpen && frontWindow === "hr"}
                placeholder={showStart ? startPlaceholder : jarvis.ready ? hasStartedWork ? "和 Syntropic 说点什么" : "发布今天的第一项任务吧～" : "Syntropic 正在启动…"}/>
              <button className="voice dictate" type="button" aria-label="语音输入" onClick={() => { dictationCompletionRef.current = "draft"; dictation.toggle(); }}><DesktopDesignIcon name="microphone" size={20}/></button>
              {prompt.trim() ? (
                <button className="send" type="submit" aria-label="发送给 Syntropic" disabled={!jarvis.sessionId}>{submitting ? <span className="agent-os-spinner"/> : <Icon name="arrow-up" size={19}/>}</button>
              ) : (
                <button className="voice realtime" type="button" aria-label="开始实时语音对话" onClick={startConversation}><Icon name="waveform" size={19}/></button>
              )}
            </>
          )}
        </form>
        )}
        {!desktopVoice.isActive && !showStart && !hasStartedWork && !hasOpenWindow && !jarvisPanelOpen && <div className="agent-os-start-footer">
          <button type="button" aria-expanded={showStart} onClick={() => { setGuideOpen(true); setJarvisPanelOpen(false); }}><Icon name="tiles" size={13}/><span>可以做什么</span><span className="guide-entry-arrow" aria-hidden="true">›</span></button>
        </div>}
      </section>

      <DesktopDock>
        <button className={`dock-launchpad${launchpadOpen ? " is-open" : ""}`} type="button" aria-label="启动台" aria-pressed={launchpadOpen} data-label="启动台" onClick={() => { setWorkspaceOpen(false); setLaunchpadOpen((value) => !value); }}><Icon name="grid" size={22}/></button><i/>
        {pinnedDockItems.map(renderDockItem)}
        {temporaryDockItems.length ? <i className="agent-os-dock-app-divider"/> : null}
        {temporaryDockItems.map(renderDockItem)}
      </DesktopDock>

      {dockContextApp && dockContextMenu ? <div
        className="agent-os-dock-context-menu"
        role="menu"
        aria-label={`${dockContextApp.name} 程序坞选项`}
        style={{ left: dockContextMenu.x, top: dockContextMenu.y }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <strong>{dockContextApp.name}</strong>
        <button type="button" role="menuitemcheckbox" aria-checked={pinnedDockAppIds.has(dockContextApp.id)} onClick={() => toggleDockAppPin(dockContextApp)}>
          <span>{pinnedDockAppIds.has(dockContextApp.id) ? "从程序坞中移除" : "在程序坞中保留"}</span>
          {pinnedDockAppIds.has(dockContextApp.id) ? <b aria-hidden="true">✓</b> : null}
        </button>
      </div> : null}

      {notification}
      {!activeCwd && notice && <DesktopNotification
        ariaLabel="工作台通知" label="工作台动态" title={notice} autoDismiss
        dismissLabel="关闭通知" onDismiss={() => setNotice(null)}
      />}

    </main>
      )}
    </RecruitingPublication>
  );
}
