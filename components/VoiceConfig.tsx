"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import type { PublicDoubaoVoiceSettings } from "@/lib/voice/settings";
import { DEFAULT_DOUBAO_TTS_SPEAKER, DOUBAO_TTS_SPEAKER_PRESETS } from "@/lib/voice/presets";
import {
  ConfigButton,
  ConfigDetail,
  ConfigDetailStack,
  ConfigField,
  ConfigFooter,
  ConfigPanelShell,
  ConfigSectionTitle,
} from "./SettingsUi";

interface VoiceDraft {
  appId: string;
  accessKey: string;
  asrResourceId: string;
  ttsResourceId: string;
  ttsSpeaker: string;
  ttsSampleRate: string;
}

const EMPTY_DRAFT: VoiceDraft = {
  appId: "",
  accessKey: "",
  asrResourceId: "volc.bigasr.sauc.duration",
  ttsResourceId: "seed-tts-2.0",
  ttsSpeaker: DEFAULT_DOUBAO_TTS_SPEAKER,
  ttsSampleRate: "24000",
};

const CUSTOM_SPEAKER = "__custom__";

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "7px 9px",
  border: "1px solid var(--border)",
  borderRadius: 6,
  outline: "none",
  color: "var(--text)",
  background: "var(--bg-panel)",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
};

function toDraft(settings: PublicDoubaoVoiceSettings): VoiceDraft {
  return {
    appId: settings.appId,
    accessKey: "",
    asrResourceId: settings.asrResourceId,
    ttsResourceId: settings.ttsResourceId,
    ttsSpeaker: settings.ttsSpeaker,
    ttsSampleRate: String(settings.ttsSampleRate),
  };
}

export function VoiceConfig({ onClose, embedded = false }: { onClose: () => void; embedded?: boolean }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<VoiceDraft>(EMPTY_DRAFT);
  const speakerIsPreset = DOUBAO_TTS_SPEAKER_PRESETS.some((preset) => preset.id === draft.ttsSpeaker);
  const [settings, setSettings] = useState<PublicDoubaoVoiceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"save" | "test" | "remove" | null>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [showKey, setShowKey] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/voice/settings", { cache: "no-store" });
    const data = await response.json() as PublicDoubaoVoiceSettings & { error?: string };
    if (!response.ok || data.error) throw new Error(data.error ?? `HTTP ${response.status}`);
    setSettings(data);
    setDraft(toDraft(data));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void load()
      .catch((cause) => {
        if (!cancelled) setMessage({ kind: "error", text: cause instanceof Error ? cause.message : String(cause) });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [load]);

  const update = (key: keyof VoiceDraft, value: string) => setDraft((current) => ({ ...current, [key]: value }));

  const save = useCallback(async (testAfterSave: boolean) => {
    setBusy(testAfterSave ? "test" : "save");
    setMessage(null);
    try {
      const response = await fetch("/api/voice/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          ttsSampleRate: Number(draft.ttsSampleRate),
          ...(draft.accessKey.trim() ? { accessKey: draft.accessKey.trim() } : {}),
        }),
      });
      const data = await response.json() as PublicDoubaoVoiceSettings & { error?: string };
      if (!response.ok || data.error) throw new Error(data.error ?? `HTTP ${response.status}`);
      setSettings(data);
      setDraft(toDraft(data));
      setShowKey(false);

      if (testAfterSave) {
        const testResponse = await fetch("/api/voice/session", { method: "POST" });
        const testData = await testResponse.json() as { error?: string };
        if (!testResponse.ok || testData.error) throw new Error(testData.error ?? `HTTP ${testResponse.status}`);
      }
      setMessage({ kind: "success", text: t(testAfterSave ? "voiceSettings.testPassed" : "voiceSettings.saved") });
    } catch (cause) {
      setMessage({ kind: "error", text: cause instanceof Error ? cause.message : String(cause) });
    } finally {
      setBusy(null);
    }
  }, [draft, t]);

  const remove = useCallback(async () => {
    setBusy("remove");
    setMessage(null);
    try {
      const response = await fetch("/api/voice/settings", { method: "DELETE" });
      const data = await response.json() as PublicDoubaoVoiceSettings & { error?: string };
      if (!response.ok || data.error) throw new Error(data.error ?? `HTTP ${response.status}`);
      setSettings(data);
      setDraft(toDraft(data));
      setMessage({ kind: "success", text: t("voiceSettings.removed") });
    } catch (cause) {
      setMessage({ kind: "error", text: cause instanceof Error ? cause.message : String(cause) });
    } finally {
      setBusy(null);
    }
  }, [t]);

  return (
    <ConfigPanelShell embedded={embedded} title={t("voiceSettings.title")} subtitle="~/.pi/agent/auth.json" onClose={onClose}>
      <ConfigDetail>
        <ConfigDetailStack className="is-fill">
          <div style={{ maxWidth: 680 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
              <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: "50%", background: settings?.configured ? "#4ade80" : "var(--border)" }} />
              <strong style={{ color: "var(--text)", fontSize: 16 }}>{t("voiceSettings.doubao")}</strong>
              <span style={{ color: settings?.configured ? "#30a46c" : "var(--text-dim)", fontSize: 11 }}>
                {settings?.configured ? t("i18n.configured") : t("i18n.notConfigured")}
              </span>
            </div>
            <p style={{ margin: "0 0 24px", color: "var(--text-muted)", fontSize: 12, lineHeight: 1.6 }}>
              {t("voiceSettings.description")}
            </p>

            <ConfigSectionTitle>{t("voiceSettings.credentials")}</ConfigSectionTitle>
            <ConfigField label={t("voiceSettings.appId")}>
              <input value={draft.appId} disabled={loading} onChange={(event) => update("appId", event.target.value)} style={inputStyle} autoComplete="off" spellCheck={false} />
            </ConfigField>
            <ConfigField label={t("voiceSettings.accessKey")}>
              <div style={{ position: "relative", width: "100%" }}>
                <input
                  type={showKey ? "text" : "password"}
                  value={draft.accessKey}
                  disabled={loading}
                  onChange={(event) => update("accessKey", event.target.value)}
                  placeholder={settings?.accessKeyConfigured ? t("voiceSettings.keyStoredPlaceholder") : t("voiceSettings.keyPlaceholder")}
                  style={{ ...inputStyle, paddingRight: 38 }}
                  autoComplete="new-password"
                  spellCheck={false}
                />
                <button type="button" onClick={() => setShowKey((value) => !value)} aria-label={showKey ? t("i18n.hideDetails") : t("i18n.showDetails")} style={{ position: "absolute", right: 5, top: 4, width: 28, height: 28, border: 0, background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>
                  {showKey ? "◉" : "◎"}
                </button>
              </div>
            </ConfigField>
            <p style={{ margin: "-3px 0 24px 132px", color: "var(--text-dim)", fontSize: 10, lineHeight: 1.5 }}>
              {settings?.stored ? t("voiceSettings.storedLocally") : settings?.configured ? t("voiceSettings.fromEnvironment") : t("voiceSettings.secretHint")}
            </p>

            <ConfigSectionTitle>{t("voiceSettings.resources")}</ConfigSectionTitle>
            <ConfigField label={t("voiceSettings.asrResource")}><input value={draft.asrResourceId} disabled={loading} onChange={(event) => update("asrResourceId", event.target.value)} style={inputStyle} spellCheck={false} /></ConfigField>
            <ConfigField label={t("voiceSettings.ttsResource")}><input value={draft.ttsResourceId} disabled={loading} onChange={(event) => update("ttsResourceId", event.target.value)} style={inputStyle} spellCheck={false} /></ConfigField>
            <ConfigField label={t("voiceSettings.speaker")}>
              <div style={{ display: "grid", gap: 6, width: "100%" }}>
                <select value={speakerIsPreset ? draft.ttsSpeaker : CUSTOM_SPEAKER} disabled={loading} onChange={(event) => update("ttsSpeaker", event.target.value === CUSTOM_SPEAKER ? "" : event.target.value)} style={inputStyle}>
                  {DOUBAO_TTS_SPEAKER_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name} · {preset.note}</option>)}
                  <option value={CUSTOM_SPEAKER}>{t("voiceSettings.speakerCustom")}</option>
                </select>
                {!speakerIsPreset && <input value={draft.ttsSpeaker} disabled={loading} onChange={(event) => update("ttsSpeaker", event.target.value)} placeholder={t("voiceSettings.speakerCustomPlaceholder")} style={inputStyle} spellCheck={false} />}
              </div>
            </ConfigField>
            <ConfigField label={t("voiceSettings.sampleRate")}><input type="number" min={8000} max={48000} step={1000} value={draft.ttsSampleRate} disabled={loading} onChange={(event) => update("ttsSampleRate", event.target.value)} style={inputStyle} /></ConfigField>
          </div>
        </ConfigDetailStack>
      </ConfigDetail>
      <ConfigFooter status={message && <span role={message.kind === "error" ? "alert" : "status"} style={{ color: message.kind === "error" ? "#f87171" : "#30a46c" }}>{message.text}</span>}>
        {settings?.stored && <ConfigButton variant="danger" disabled={busy !== null} onClick={() => void remove()}>{t("voiceSettings.remove")}</ConfigButton>}
        <ConfigButton disabled={loading || busy !== null} onClick={() => void save(true)}>{busy === "test" ? t("voiceSettings.testing") : t("voiceSettings.saveAndTest")}</ConfigButton>
        <ConfigButton variant="primary" disabled={loading || busy !== null} onClick={() => void save(false)}>{busy === "save" ? t("i18n.saving") : t("i18n.save")}</ConfigButton>
      </ConfigFooter>
    </ConfigPanelShell>
  );
}
