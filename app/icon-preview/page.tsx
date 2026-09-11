"use client";

import * as Phosphor from "@phosphor-icons/react";
import { Archive as IconoirArchive, OpenInBrowser as IconoirBrowser, Folder as IconoirFolder, Settings as IconoirSettings, Terminal as IconoirTerminal } from "iconoir-react";
import { Archive, Compass, FolderOpen, Settings2, TerminalSquare } from "lucide-react";

const choices = [["任务", "ClipboardText", "ClipboardCheck", "ClipboardCheck"], ["产物库", "ArchiveBox", "ArchiveBox", "Archive"], ["销售 CRM", "UsersThree", "UsersThree", "Users"], ["投资管理", "ChartLineUp", "ChartLineUp", "StatsUpSquare"], ["浏览器", "Compass", "Compass", "Browser"], ["文件", "FolderOpen", "FolderOpen", "Folder"], ["终端", "TerminalWindow", "TerminalWindow", "Terminal"], ["应用市场", "SquaresFour", "SquaresFour", "AppWindow"], ["设置", "GearSix", "GearSix", "Settings"]] as const;
const lucide = { Compass, FolderOpen, TerminalSquare, Settings2, Archive };
const iconoir = { Archive: IconoirArchive, Browser: IconoirBrowser, Folder: IconoirFolder, Settings: IconoirSettings, Terminal: IconoirTerminal };
function Sample({ family, name, weight }: { family: "phosphor" | "lucide" | "iconoir"; name: string; weight?: "regular" | "fill" | "duotone" }) {
  if (family === "lucide") { const Icon = lucide[name as keyof typeof lucide] ?? Archive; return <Icon size={31} strokeWidth={1.7}/>; }
  if (family === "iconoir") { const Icon = iconoir[name as keyof typeof iconoir] ?? IconoirArchive; return <Icon width={31} height={31}/>; }
  const Icon = (Phosphor as unknown as Record<string, React.ComponentType<{size?: number; weight?: "regular" | "fill" | "duotone"}>>)[name] ?? Phosphor.Archive;
  return <Icon size={31} weight={weight ?? "regular"}/>;
}
export default function IconPreview() {
  const columns = [["Phosphor · Regular", "phosphor", "regular"], ["Phosphor · Duotone", "phosphor", "duotone"], ["Phosphor · Fill", "phosphor", "fill"], ["Iconoir", "iconoir", "regular"], ["Lucide（当前）", "lucide", "regular"]] as const;
  return <main style={{ minHeight: "100dvh", padding: "48px 56px", background: "#f4f6fb", color: "#202a3a", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}><p style={{ margin: 0, color: "#68758a", fontSize: 13 }}>Syntropic · 临时预览</p><h1 style={{ margin: "10px 0 8px", fontSize: 30 }}>开源图标库对比</h1><p style={{ margin: "0 0 26px", color: "#788297", fontSize: 14 }}>同一组功能、同一尺寸和底板，方便直接比较风格。飞书与 BOSS 直聘保持真实官方图标。</p><div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(150px, 1fr))", gap: 12, maxWidth: 1180, overflowX: "auto" }}>{columns.map(([title, family, weight]) => <section key={title} style={{ minWidth: 150 }}><h2 style={{ fontSize: 13, margin: "0 0 10px", color: "#53617a" }}>{title}</h2>{choices.map(([label, phosphor, , iconoirName]) => <article key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 10px", marginBottom: 8, borderRadius: 14, background: "#fff", border: "1px solid #e3e8f2" }}><span style={{ width: 42, height: 42, display: "grid", placeItems: "center", borderRadius: 12, color: "#426fe8", background: "linear-gradient(145deg,#eef3ff,#e7ecff)" }}><Sample family={family} name={family === "phosphor" ? phosphor : family === "iconoir" ? iconoirName : phosphor} weight={weight}/></span><small style={{ fontSize: 11, color: "#68758a" }}>{label}</small></article>)}</section>)}</div></main>;
}
