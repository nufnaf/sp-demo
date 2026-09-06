import { readStoredAuthSection, updateStoredAuthSection } from "@/lib/provider-credential-store";
import {
  DEFAULT_DOUBAO_ASR_RESOURCE_ID,
  DEFAULT_DOUBAO_TTS_RESOURCE_ID,
  DEFAULT_DOUBAO_TTS_SAMPLE_RATE,
  DEFAULT_DOUBAO_TTS_SPEAKER,
} from "./presets";

export {
  DEFAULT_DOUBAO_ASR_RESOURCE_ID,
  DEFAULT_DOUBAO_TTS_RESOURCE_ID,
  DEFAULT_DOUBAO_TTS_SAMPLE_RATE,
  DEFAULT_DOUBAO_TTS_SPEAKER,
} from "./presets";

export const DOUBAO_VOICE_AUTH_SECTION = "pi-web:doubao-voice";

export interface StoredDoubaoVoiceSettings {
  appId: string;
  accessKey: string;
  asrResourceId?: string;
  ttsResourceId?: string;
  ttsSpeaker?: string;
  ttsSampleRate?: number;
}

export interface PublicDoubaoVoiceSettings {
  configured: boolean;
  stored: boolean;
  appId: string;
  accessKeyConfigured: boolean;
  asrResourceId: string;
  ttsResourceId: string;
  ttsSpeaker: string;
  ttsSampleRate: number;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function sampleRateValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 8_000 && value <= 48_000
    ? value
    : undefined;
}

export async function readStoredDoubaoVoiceSettings(): Promise<StoredDoubaoVoiceSettings | null> {
  const value = await readStoredAuthSection(DOUBAO_VOICE_AUTH_SECTION);
  const appId = stringValue(value?.appId);
  const accessKey = stringValue(value?.accessKey);
  if (!appId || !accessKey) return null;
  return {
    appId,
    accessKey,
    asrResourceId: stringValue(value?.asrResourceId),
    ttsResourceId: stringValue(value?.ttsResourceId),
    ttsSpeaker: stringValue(value?.ttsSpeaker),
    ttsSampleRate: sampleRateValue(value?.ttsSampleRate),
  };
}

function resolveEffectiveSettings(stored: StoredDoubaoVoiceSettings | null): StoredDoubaoVoiceSettings | null {
  const appId = stored?.appId || stringValue(process.env.DOUBAO_SPEECH_APP_ID);
  const accessKey = stored?.accessKey || stringValue(process.env.DOUBAO_SPEECH_ACCESS_KEY);
  if (!appId || !accessKey) return null;
  return {
    appId,
    accessKey,
    asrResourceId: stored?.asrResourceId || stringValue(process.env.DOUBAO_ASR_RESOURCE_ID),
    ttsResourceId: stored?.ttsResourceId || stringValue(process.env.DOUBAO_TTS_RESOURCE_ID),
    ttsSpeaker: stored?.ttsSpeaker || stringValue(process.env.DOUBAO_TTS_SPEAKER),
    ttsSampleRate: stored?.ttsSampleRate || sampleRateValue(Number(process.env.DOUBAO_TTS_SAMPLE_RATE)),
  };
}

export async function getEffectiveDoubaoVoiceSettings(): Promise<StoredDoubaoVoiceSettings | null> {
  return resolveEffectiveSettings(await readStoredDoubaoVoiceSettings());
}

export async function getPublicDoubaoVoiceSettings(): Promise<PublicDoubaoVoiceSettings> {
  const stored = await readStoredDoubaoVoiceSettings();
  const effective = resolveEffectiveSettings(stored);
  return {
    configured: Boolean(effective),
    stored: Boolean(stored),
    appId: effective?.appId ?? "",
    accessKeyConfigured: Boolean(effective?.accessKey),
    asrResourceId: effective?.asrResourceId || DEFAULT_DOUBAO_ASR_RESOURCE_ID,
    ttsResourceId: effective?.ttsResourceId || DEFAULT_DOUBAO_TTS_RESOURCE_ID,
    ttsSpeaker: effective?.ttsSpeaker || DEFAULT_DOUBAO_TTS_SPEAKER,
    ttsSampleRate: effective?.ttsSampleRate || DEFAULT_DOUBAO_TTS_SAMPLE_RATE,
  };
}

export async function saveDoubaoVoiceSettings(settings: StoredDoubaoVoiceSettings): Promise<void> {
  await updateStoredAuthSection(DOUBAO_VOICE_AUTH_SECTION, {
    appId: settings.appId.trim(),
    accessKey: settings.accessKey.trim(),
    asrResourceId: settings.asrResourceId?.trim() || DEFAULT_DOUBAO_ASR_RESOURCE_ID,
    ttsResourceId: settings.ttsResourceId?.trim() || DEFAULT_DOUBAO_TTS_RESOURCE_ID,
    ttsSpeaker: settings.ttsSpeaker?.trim() || DEFAULT_DOUBAO_TTS_SPEAKER,
    ttsSampleRate: settings.ttsSampleRate || DEFAULT_DOUBAO_TTS_SAMPLE_RATE,
  });
}

export async function removeDoubaoVoiceSettings(): Promise<void> {
  await updateStoredAuthSection(DOUBAO_VOICE_AUTH_SECTION, undefined);
}
