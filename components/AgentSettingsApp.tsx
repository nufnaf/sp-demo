"use client";

import { useDesktopPreferences } from "@/hooks/useDesktopPreferences";
import { PREVIEW_WIDTH_SCALES } from "@/electron/ui-preferences-schema.mjs";
import { FeishuConnectionStatus } from "./FeishuConnectionStatus";
import { ConfigSwitch } from "./SettingsUi";
import { SyntropicMark } from "./SyntropicMark";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/hooks/useI18n";
import { useTheme, type ThemePreference } from "@/hooks/useTheme";
import {
  getLastSettingsSection,
  setLastSettingsSection,
  type SettingsSection,
} from "@/lib/settings-navigation";
import { ModelsConfig } from "./ModelsConfig";
import { VoiceConfig } from "./VoiceConfig";
import { SkillsConfig } from "./SkillsConfig";
import { AgentsConfig } from "./AgentsConfig";
import { PluginsConfig } from "./PluginsConfig";
import { SettingsSectionIcon } from "./SettingsPanel";

interface AgentSettingsAppProps {
  cwd: string | null;
  sessionId: string | null;
  onClose: () => void;
  onSessionReloaded: () => void;
}

interface SettingsNavItem {
  id: SettingsSection;
  label: string;
  description: string;
  color: string;
  requiresProject: boolean;
}

function AppearanceIcon({ preference }: { preference: ThemePreference }) {
  if (preference === "light") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>;
  }
  if (preference === "dark") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>;
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>;
}

function ChevronIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>;
}

function GeneralSettings({
  cwd,
  onOpenModels,
  onOpenVoice,
}: {
  cwd: string | null;
  onOpenModels: () => void;
  onOpenVoice: () => void;
}) {
  const { locale, setLocale, supportedLocales, t } = useI18n();
  const { preference, setThemePreference } = useTheme();
  const { preferences, loaded, saving, error, updatePreferences } = useDesktopPreferences();
  const appearances: Array<{ id: ThemePreference; label: string }> = [
    { id: "light", label: t("settings.themeLight") },
    { id: "dark", label: t("settings.themeDark") },
    { id: "auto", label: t("settings.themeSystem") },
  ];

  return (
    <div className="agent-settings-general">
      <header className="agent-settings-detail-heading">
        <span className="agent-settings-heading-icon general"><SettingsSectionIcon section="general" size={25}/></span>
        <span><h1>{t("settings.general")}</h1><p>管理 Syntropic 的外观、语言与默认工作环境。</p></span>
      </header>

      <section className="agent-settings-group">
        <h2>外观</h2>
        <div className="agent-settings-appearance-grid" role="radiogroup" aria-label="外观">
          {appearances.map((item) => <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={preference === item.id}
            className={preference === item.id ? "is-selected" : ""}
            onClick={() => setThemePreference(item.id)}
          >
            <span className={`agent-settings-theme-preview ${item.id}`}><i/><i/><i/></span>
            <span><AppearanceIcon preference={item.id}/>{item.label}</span>
          </button>)}
        </div>
      </section>

      <section className="agent-settings-group">
        <h2>语言与地区</h2>
        <div className="agent-settings-form-list">
          <label><span><strong>界面语言</strong><small>应用到 Syntropic 的桌面与任务界面</small></span><select value={locale} onChange={(event) => setLocale(event.target.value as typeof locale)}>{supportedLocales.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
        </div>
      </section>

      <section className="agent-settings-group">
        <h2>桌面与悬浮窗</h2>
        <div className="agent-settings-form-list">
          <div><span><strong>多桌面</strong><small>开启桌面切换、总览和窗口移动；关闭后窗口集中显示</small></span><ConfigSwitch label="多桌面" checked={preferences.desktopSpacesEnabled} disabled={!loaded || saving} onChange={(enabled) => void updatePreferences({ desktopSpacesEnabled: enabled })}/></div>
          <label><span><strong>悬浮窗宽度</strong><small>相对于桌面卡片的默认宽度，空间不足时自动缩小</small></span><select aria-label="悬浮窗宽度" value={preferences.previewWidthScale} disabled={!loaded || saving} onChange={event => void updatePreferences({ previewWidthScale: Number(event.target.value) })}>{PREVIEW_WIDTH_SCALES.map(scale => <option key={scale} value={scale}>{scale} 倍{scale === 1.5 ? "（默认）" : ""}</option>)}</select></label>
        </div>
        <p className="agent-settings-save-status" role="status">{error ?? (saving ? "正在保存…" : "设置自动保存，重启后继续生效。")}</p>
      </section>

      <FeishuConnectionStatus/>
      <section className="agent-settings-group">
        <h2>Agent</h2>
        <div className="agent-settings-form-list">
          <button type="button" onClick={onOpenModels}><span><strong>模型与 API Key</strong><small>配置 DeepSeek 等 Provider，并选择 Agent 使用的模型</small></span><ChevronIcon/></button>
          <button type="button" onClick={onOpenVoice}><span><strong>实时语音</strong><small>配置豆包 ASR、Seed TTS 和本机凭证</small></span><ChevronIcon/></button>
          <div><span><strong>当前工作目录</strong><small>{cwd ?? "首次创建任务时自动生成"}</small></span><em>{cwd ? "已连接" : "自动"}</em></div>
          <div><span><strong>凭据存储</strong><small>API Key 只保存在本机 ~/.pi/agent/auth.json</small></span><em className="secure">本机</em></div>
        </div>
      </section>
    </div>
  );
}

function ProjectRequired({ label }: { label: string }) {
  return <div className="agent-settings-project-required"><span>⌘</span><h2>需要工作目录</h2><p>创建或打开一个任务后，即可配置这个项目的{label}。</p></div>;
}

export function AgentSettingsApp({ cwd, sessionId, onClose, onSessionReloaded }: AgentSettingsAppProps) {
  const { t } = useI18n();
  const [section, setSection] = useState<SettingsSection>(() => getLastSettingsSection(cwd));
  const [mounted, setMounted] = useState<ReadonlySet<SettingsSection>>(() => new Set([section]));
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const navItems = useMemo<SettingsNavItem[]>(() => [
    { id: "general", label: t("settings.general"), description: "外观、语言和默认行为", color: "#7f8b99", requiresProject: false },
    { id: "models", label: t("common.models"), description: "Provider、API Key 和模型", color: "#3478f6", requiresProject: false },
    { id: "voice", label: t("voiceSettings.title"), description: "豆包实时输入、播报与凭证", color: "#e45a84", requiresProject: false },
    { id: "agents", label: t("common.agents"), description: "内置与自定义子代理", color: "#7c5ce5", requiresProject: true },
    { id: "skills", label: t("common.skills"), description: "Agent 可调用的专业能力", color: "#ef8a35", requiresProject: true },
    { id: "plugins", label: t("common.plugins"), description: "扩展、工具与资源", color: "#27a66f", requiresProject: true },
  ], [t]);
  const filteredItems = navItems.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    if (cwd || !navItems.find((item) => item.id === section)?.requiresProject) return;
    setSection("general");
    setMounted((current) => new Set(current).add("general"));
  }, [cwd, navItems, section]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape" && document.activeElement === searchRef.current) {
        setQuery("");
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const activate = (next: SettingsSection) => {
    setSection(next);
    setMounted((current) => new Set(current).add(next));
    setLastSettingsSection(next);
  };
  const host = (id: SettingsSection, content: ReactNode) => mounted.has(id) ? <section key={id} hidden={section !== id} className="agent-settings-section-host">{content}</section> : null;

  return (
    <div className="agent-settings-app">
      <aside className="agent-settings-sidebar">
        <div className="agent-settings-search"><SearchIcon/><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索设置" aria-label="搜索设置"/><kbd>⌘ F</kbd></div>
        <nav aria-label="设置分类">
          {filteredItems.map((item) => <button
            key={item.id}
            type="button"
            aria-current={section === item.id ? "page" : undefined}
            disabled={item.requiresProject && !cwd}
            title={item.requiresProject && !cwd ? "需要先创建或打开一个任务" : item.description}
            onClick={() => activate(item.id)}
          >
            <span className="agent-settings-nav-icon" style={{ background: item.color }}><SettingsSectionIcon section={item.id} size={17} strokeWidth={1.9}/></span>
            <span><strong>{item.label}</strong><small>{item.description}</small></span>
          </button>)}
        </nav>
        <footer><span className="agent-settings-pi-mark"><SyntropicMark size={20}/></span><span><strong>Syntropic</strong><small>智能工作空间</small></span><i>已连接</i></footer>
      </aside>
      <main className="agent-settings-content">
        {host("general", <GeneralSettings cwd={cwd} onOpenModels={() => activate("models")} onOpenVoice={() => activate("voice")}/>)}
        {host("models", <ModelsConfig embedded onClose={onClose}/>)}
        {host("voice", <VoiceConfig embedded onClose={onClose}/>)}
        {host("agents", cwd ? <AgentsConfig embedded cwd={cwd} sessionId={sessionId} onClose={onClose} onReloaded={onSessionReloaded}/> : <ProjectRequired label="子代理"/>)}
        {host("skills", cwd ? <SkillsConfig embedded cwd={cwd} onClose={onClose}/> : <ProjectRequired label="Skills"/>)}
        {host("plugins", cwd ? <PluginsConfig embedded cwd={cwd} sessionId={sessionId} onClose={onClose} onReloaded={onSessionReloaded}/> : <ProjectRequired label="Plugins"/>)}
      </main>
    </div>
  );
}
