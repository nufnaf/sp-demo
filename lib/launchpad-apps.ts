import type { PluginPackageInfo } from "./api-types";
import { getChinaAppDefinition, type ChinaAppDefinition, type ChinaConnectorAppId } from "./china-apps.ts";

export type LaunchpadCategory = "产品开发" | "设计协作" | "团队协作" | "知识办公" | "企业协同" | "金融数据" | "法律服务" | "其他";

export type LaunchpadAppearance = "github" | "figma" | "slack" | "notion" | "linear" | "google" | "feishu" | ChinaConnectorAppId | "default";

interface LaunchpadAppBase {
  id: string;
  name: string;
  description: string;
  category: LaunchpadCategory;
  icon: string;
  appearance: LaunchpadAppearance;
  rank: number;
}

export interface PluginLaunchpadApp extends LaunchpadAppBase {
  kind: "plugin";
  appearance: "github" | "figma" | "slack" | "notion" | "linear" | "google" | "default";
  plugin: PluginPackageInfo;
}

export interface BuiltinLaunchpadApp extends LaunchpadAppBase {
  kind: "builtin";
  appearance: "feishu";
}

export interface ConnectorLaunchpadApp extends LaunchpadAppBase {
  kind: "connector";
  appearance: ChinaConnectorAppId;
  connector: ChinaAppDefinition;
}

export type LaunchpadApp = PluginLaunchpadApp | BuiltinLaunchpadApp | ConnectorLaunchpadApp;

interface AppPresentation {
  name: string;
  description: string;
  category: LaunchpadCategory;
  icon: string;
  appearance: PluginLaunchpadApp["appearance"];
  rank: number;
}

const APP_CATALOG: Record<string, AppPresentation> = {
  "@aduverger/pi-ship": {
    name: "GitHub",
    description: "代码、Issue 与 Pull Request",
    category: "产品开发",
    icon: "G",
    appearance: "github",
    rank: 10,
  },
  "pi-mono-figma": {
    name: "Figma",
    description: "读取设计稿与设计上下文",
    category: "设计协作",
    icon: "F",
    appearance: "figma",
    rank: 20,
  },
  "@dreki-gg/pi-slack": {
    name: "Slack",
    description: "团队消息与协作空间",
    category: "团队协作",
    icon: "S",
    appearance: "slack",
    rank: 30,
  },
  "@feniix/pi-notion": {
    name: "Notion",
    description: "知识库、文档与项目资料",
    category: "知识办公",
    icon: "N",
    appearance: "notion",
    rank: 40,
  },
  "pi-mono-linear": {
    name: "Linear",
    description: "项目、Issue 与研发流程",
    category: "产品开发",
    icon: "L",
    appearance: "linear",
    rank: 50,
  },
  "pi-google-workspace": {
    name: "Google Workspace",
    description: "Gmail、Drive、Docs、Sheets 与 Slides",
    category: "知识办公",
    icon: "G",
    appearance: "google",
    rank: 60,
  },
};

export function getPluginPackageName(plugin: Pick<PluginPackageInfo, "packageName" | "source">): string {
  if (plugin.packageName) return plugin.packageName;
  const specifier = plugin.source.startsWith("npm:") ? plugin.source.slice(4) : plugin.source;
  if (specifier.startsWith("@")) {
    const slash = specifier.indexOf("/");
    const versionAt = specifier.lastIndexOf("@");
    return versionAt > slash ? specifier.slice(0, versionAt) : specifier;
  }
  const versionAt = specifier.lastIndexOf("@");
  return versionAt > 0 ? specifier.slice(0, versionAt) : specifier;
}

function fallbackName(packageName: string): string {
  const unscoped = packageName.split("/").at(-1) ?? packageName;
  return unscoped
    .replace(/^pi[-_]/i, "")
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Pi App";
}

export function toLaunchpadApp(plugin: PluginPackageInfo): PluginLaunchpadApp {
  const packageName = getPluginPackageName(plugin);
  const known = APP_CATALOG[packageName];
  const name = known?.name ?? fallbackName(packageName);
  return {
    kind: "plugin",
    id: `${plugin.scope}:${plugin.source}`,
    name,
    description: known?.description ?? "Pi Agent 扩展能力",
    category: known?.category ?? "其他",
    icon: known?.icon ?? name.charAt(0).toUpperCase(),
    appearance: known?.appearance ?? "default",
    rank: known?.rank ?? 1_000,
    plugin,
  };
}

export const BUILTIN_LAUNCHPAD_APPS: BuiltinLaunchpadApp[] = [{
  kind: "builtin",
  id: "builtin:feishu",
  name: "飞书",
  description: "消息、文档、多维表格与协作空间",
  category: "企业协同",
  icon: "飞",
  appearance: "feishu",
  rank: 10,
}];

export function getInstalledLaunchpadApps(packages: PluginPackageInfo[]): PluginLaunchpadApp[] {
  return packages
    .filter((plugin) => plugin.status !== "missing")
    .map(toLaunchpadApp)
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
}

export function toConnectorLaunchpadApp(id: ChinaConnectorAppId): ConnectorLaunchpadApp | null {
  const connector = getChinaAppDefinition(id);
  if (!connector || connector.delivery !== "connector") return null;
  return { kind: "connector", id: `connector:${id}`, name: connector.name, description: connector.description, category: connector.category, icon: connector.icon, appearance: id, rank: connector.rank, connector };
}

export function getLaunchpadApps(packages: PluginPackageInfo[], installedConnectorIds: string[] = []): LaunchpadApp[] {
  const connectors = installedConnectorIds.flatMap((id) => {
    if (id === "feishu") return [];
    const app = toConnectorLaunchpadApp(id as ChinaConnectorAppId);
    return app ? [app] : [];
  });
  return [...BUILTIN_LAUNCHPAD_APPS, ...connectors, ...getInstalledLaunchpadApps(packages)]
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
}
