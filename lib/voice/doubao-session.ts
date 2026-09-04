import type { DoubaoVoiceSession } from "./types";
import {
  DEFAULT_DOUBAO_ASR_RESOURCE_ID,
  DEFAULT_DOUBAO_TTS_RESOURCE_ID,
  DEFAULT_DOUBAO_TTS_SAMPLE_RATE,
  DEFAULT_DOUBAO_TTS_SPEAKER,
  getEffectiveDoubaoVoiceSettings,
} from "./settings";

const STS_ENDPOINT = "https://openspeech.bytedance.com/api/v1/sts/token";
// Seed ASR 2.0 uses the optimized bidirectional streaming endpoint. The legacy
// /bigmodel endpoint rejects volc.seedasr.* resources during the WS handshake.
const DEFAULT_ASR_ENDPOINT = "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async";
const DEFAULT_TTS_ENDPOINT = "wss://openspeech.bytedance.com/api/v3/tts/bidirection";
const TOKEN_LIFETIME_SECONDS = 300;
const TOKEN_REFRESH_MARGIN_MS = 30_000;

interface TokenCache {
  appId: string;
  accessKey: string;
  token: string;
  expiresAt: number;
  inFlight?: Promise<{ token: string; expiresAt: number }>;
}

declare global {
  var __piWebDoubaoVoiceToken: TokenCache | undefined;
}

export class DoubaoVoiceConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DoubaoVoiceConfigurationError";
  }
}

async function requestTemporaryToken(appId: string, accessKey: string): Promise<{ token: string; expiresAt: number }> {
  const response = await fetch(STS_ENDPOINT, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer; ${accessKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ appid: appId, duration: TOKEN_LIFETIME_SECONDS }),
    signal: AbortSignal.timeout(8_000),
  });
  const body = await response.json().catch(() => ({})) as { jwt_token?: unknown; message?: unknown };
  if (!response.ok || typeof body.jwt_token !== "string" || !body.jwt_token) {
    const detail = typeof body.message === "string" ? `: ${body.message}` : "";
    throw new Error(`Doubao speech token request failed (${response.status})${detail}`);
  }
  return {
    token: body.jwt_token,
    expiresAt: Date.now() + TOKEN_LIFETIME_SECONDS * 1_000,
  };
}

async function getTemporaryToken(appId: string, accessKey: string) {
  let cache = globalThis.__piWebDoubaoVoiceToken;
  if (!cache || cache.appId !== appId || cache.accessKey !== accessKey) {
    cache = { appId, accessKey, token: "", expiresAt: 0 };
    globalThis.__piWebDoubaoVoiceToken = cache;
  }
  if (cache.token && cache.expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now()) {
    return { token: cache.token, expiresAt: cache.expiresAt };
  }
  cache.inFlight ??= requestTemporaryToken(appId, accessKey).then((result) => {
    cache.token = result.token;
    cache.expiresAt = result.expiresAt;
    return result;
  }).finally(() => {
    cache.inFlight = undefined;
  });
  return cache.inFlight;
}

export async function createDoubaoVoiceSession(): Promise<DoubaoVoiceSession> {
  const settings = await getEffectiveDoubaoVoiceSettings();
  if (!settings) {
    throw new DoubaoVoiceConfigurationError("Doubao voice is not configured. Add its App ID and Access Key in Settings → Voice.");
  }
  const { appId, accessKey } = settings;
  const credentials = await getTemporaryToken(appId, accessKey);

  return {
    ...credentials,
    appId,
    asr: {
      endpoint: process.env.DOUBAO_ASR_ENDPOINT?.trim() || DEFAULT_ASR_ENDPOINT,
      resourceId: settings.asrResourceId || DEFAULT_DOUBAO_ASR_RESOURCE_ID,
    },
    tts: {
      endpoint: process.env.DOUBAO_TTS_ENDPOINT?.trim() || DEFAULT_TTS_ENDPOINT,
      resourceId: settings.ttsResourceId || DEFAULT_DOUBAO_TTS_RESOURCE_ID,
      speaker: settings.ttsSpeaker || DEFAULT_DOUBAO_TTS_SPEAKER,
      sampleRate: settings.ttsSampleRate || DEFAULT_DOUBAO_TTS_SAMPLE_RATE,
    },
  };
}
