"use client";

import type { DoubaoVoiceSession } from "./types";

type SpeechSdk = typeof import("byted-ailab-speech-sdk");

let cachedSession: DoubaoVoiceSession | null = null;
let sessionPromise: Promise<DoubaoVoiceSession> | null = null;
let sdkPromise: Promise<SpeechSdk> | null = null;

async function fetchVoiceSession(): Promise<DoubaoVoiceSession> {
  const response = await fetch("/api/voice/session", { method: "POST", headers: { Accept: "application/json" } });
  const body = await response.json().catch(() => ({})) as DoubaoVoiceSession & { error?: string };
  if (!response.ok) throw new Error(body.error || `Voice service returned HTTP ${response.status}`);
  return body;
}

/** Short-lived Doubao credentials, refreshed ahead of expiry and shared by every voice feature. */
export function getVoiceSession(): Promise<DoubaoVoiceSession> {
  if (cachedSession && cachedSession.expiresAt - 30_000 > Date.now()) return Promise.resolve(cachedSession);
  sessionPromise ??= fetchVoiceSession().then((session) => {
    cachedSession = session;
    return session;
  }).finally(() => { sessionPromise = null; });
  return sessionPromise;
}

export function getSpeechSdk(): Promise<SpeechSdk> {
  sdkPromise ??= import("byted-ailab-speech-sdk");
  return sdkPromise;
}

export function authenticatedUrl(endpoint: string, session: DoubaoVoiceSession, resourceId: string): string {
  const url = new URL(endpoint);
  url.searchParams.set("api_resource_id", resourceId);
  url.searchParams.set("api_app_key", session.appId);
  url.searchParams.set("api_access_key", `Jwt; ${session.token}`);
  url.searchParams.set("api_connect_id", crypto.randomUUID());
  return url.toString();
}

/** Recognizer request used by both dictation and live conversation. */
export function asrRequestConfig(endWindowMs: number) {
  return {
    user: { uid: "pi-web" },
    audio: { format: "pcm" as const, rate: 16_000, bits: 16, channel: 1 },
    request: {
      model_name: "bigmodel",
      show_utterances: true,
      result_type: "full",
      enable_itn: true,
      enable_punc: true,
      end_window_size: endWindowMs,
    },
  };
}

export const ASR_RECORD_OPTIONS = { timeSlice: 200, numberOfAudioChannels: 1, desiredSampRate: 16_000, disableLogs: true };

/** Loudness of a recorder chunk (WAV with a 44-byte header) in the 0..1 range. */
export function micLevel(chunk: Blob): Promise<number> {
  return chunk.slice(44).arrayBuffer().then((buffer) => {
    if (buffer.byteLength < 2) return 0;
    const samples = new Int16Array(buffer.slice(0, buffer.byteLength - (buffer.byteLength % 2)));
    let sum = 0;
    let count = 0;
    for (let index = 0; index < samples.length; index += 8) {
      const sample = samples[index] / 32_768;
      sum += sample * sample;
      count += 1;
    }
    return count ? Math.min(1, Math.sqrt(sum / count) * 8) : 0;
  });
}
