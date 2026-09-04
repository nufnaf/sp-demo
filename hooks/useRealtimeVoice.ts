"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DoubaoVoiceSession, VoiceState } from "@/lib/voice/types";
import { isVoiceAbortCommand, normalizeTextForSpeech } from "@/lib/voice/text";

type AsrClient = ReturnType<typeof import("byted-ailab-speech-sdk")["LabASR"]>;
type TtsClient = ReturnType<typeof import("byted-ailab-speech-sdk")["BidirectionalTTS"]>;

interface UseRealtimeVoiceOptions {
  sessionId?: string | null;
  agentRunning: boolean;
  latestAssistantText: string;
  onPrompt(text: string): void;
  onSteer(text: string): void;
  onAbort(): void;
  onAudioUnlock?(): void;
  expectReply?: boolean;
}

const PENDING_VOICE_REPLY_KEY = "pi-voice-awaiting-session";

export function markVoiceReplyPending(sessionId: string): void {
  try {
    sessionStorage.setItem(PENDING_VOICE_REPLY_KEY, sessionId);
  } catch {
    // Voice handoff is best-effort when browser storage is unavailable.
  }
}

function buildAuthenticatedUrl(
  endpoint: string,
  session: DoubaoVoiceSession,
  resourceId: string,
): string {
  const url = new URL(endpoint);
  url.searchParams.set("api_resource_id", resourceId);
  url.searchParams.set("api_app_key", session.appId);
  url.searchParams.set("api_access_key", `Jwt; ${session.token}`);
  url.searchParams.set("api_connect_id", crypto.randomUUID());
  return url.toString();
}

async function fetchVoiceSession(): Promise<DoubaoVoiceSession> {
  const response = await fetch("/api/voice/session", {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  const body = await response.json().catch(() => ({})) as DoubaoVoiceSession & { error?: string };
  if (!response.ok) throw new Error(body.error || `Voice service returned HTTP ${response.status}`);
  return body;
}

export function useRealtimeVoice({
  sessionId,
  agentRunning,
  latestAssistantText,
  onPrompt,
  onSteer,
  onAbort,
  onAudioUnlock,
  expectReply = true,
}: UseRealtimeVoiceOptions) {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const stateRef = useRef<VoiceState>("idle");
  const transcriptRef = useRef("");
  const asrRef = useRef<AsrClient | null>(null);
  const ttsRef = useRef<TtsClient | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const sessionRef = useRef<DoubaoVoiceSession | null>(null);
  const awaitingReplyRef = useRef(false);
  const lastAssistantTextRef = useRef(latestAssistantText);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishConnectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listeningOperationRef = useRef(0);
  const speakingOperationRef = useRef(0);
  const voiceLevelRef = useRef(0);

  const updateState = useCallback((next: VoiceState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const getSession = useCallback(async () => {
    const cached = sessionRef.current;
    if (cached && cached.expiresAt - 30_000 > Date.now()) return cached;
    const session = await fetchVoiceSession();
    sessionRef.current = session;
    return session;
  }, []);

  const stopSpeaking = useCallback(() => {
    speakingOperationRef.current += 1;
    if (finishConnectionTimerRef.current) {
      clearTimeout(finishConnectionTimerRef.current);
      finishConnectionTimerRef.current = null;
    }
    ttsRef.current?.close();
    ttsRef.current = null;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    audioRef.current = null;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    if (stateRef.current === "speaking") updateState("idle");
  }, [updateState]);

  const speak = useCallback(async (rawText: string) => {
    const text = normalizeTextForSpeech(rawText);
    if (!text) {
      updateState("idle");
      return;
    }
    stopSpeaking();
    const operation = speakingOperationRef.current;
    updateState("connecting");
    setError(null);
    try {
      const [session, sdk] = await Promise.all([
        getSession(),
        import("byted-ailab-speech-sdk"),
      ]);
      if (operation !== speakingOperationRef.current) return;
      const client = sdk.BidirectionalTTS();
      ttsRef.current = client;
      const audioUrl = client.start({
        url: buildAuthenticatedUrl(session.tts.endpoint, session, session.tts.resourceId),
        config: {
          user: { uid: "pi-web" },
          namespace: "BidirectionalTTS",
          req_params: {
            speaker: session.tts.speaker,
            audio_params: {
              format: "mp3",
              sample_rate: session.tts.sampleRate,
            },
            // The v3 service expects a JSON string even though SDK 4.0.10
            // declares this field as an object.
            additions: JSON.stringify({
              disable_markdown_filter: false,
              enable_latex_tn: true,
            }) as unknown as { disable_markdown_filter?: boolean; enable_latex_tn?: boolean },
          },
        },
        onSessionStarted: () => {
          if (ttsRef.current !== client) return;
          updateState("speaking");
          client.sendText(text);
          client.finishSession();
          void audioRef.current?.play().catch((playError) => {
            if (ttsRef.current !== client || (playError instanceof DOMException && playError.name === "AbortError")) return;
            setError(playError instanceof Error ? playError.message : "Audio playback was blocked");
          });
        },
        onTTSSentenceEnd: () => {
          if (finishConnectionTimerRef.current) clearTimeout(finishConnectionTimerRef.current);
          finishConnectionTimerRef.current = setTimeout(() => client.finishConnection(), 1_000);
        },
        onError: ({ msg }) => {
          if (ttsRef.current !== client) return;
          setError(msg || "Doubao speech synthesis failed");
          updateState("error");
        },
        onWSError: () => {
          if (ttsRef.current !== client) return;
          setError("Unable to connect to Doubao speech synthesis");
          updateState("error");
        },
      });
      audioUrlRef.current = audioUrl;
      const audio = new Audio(audioUrl);
      audio.preload = "auto";
      audio.onended = () => {
        if (audioRef.current !== audio) return;
        ttsRef.current = null;
        audioRef.current = null;
        if (audioUrlRef.current === audioUrl) {
          URL.revokeObjectURL(audioUrl);
          audioUrlRef.current = null;
        }
        updateState("idle");
      };
      audioRef.current = audio;
    } catch (cause) {
      if (operation !== speakingOperationRef.current) return;
      setError(cause instanceof Error ? cause.message : String(cause));
      updateState("error");
    }
  }, [getSession, stopSpeaking, updateState]);

  const submitTranscript = useCallback((value: string) => {
    const text = value.trim();
    setTranscript("");
    transcriptRef.current = "";
    if (!text) {
      updateState("idle");
      return;
    }
    if (agentRunning && isVoiceAbortCommand(text)) {
      awaitingReplyRef.current = false;
      onAbort();
      updateState("idle");
      return;
    }
    awaitingReplyRef.current = expectReply;
    if (agentRunning) onSteer(text);
    else onPrompt(text);
    updateState(expectReply ? "agent-working" : "idle");
  }, [agentRunning, expectReply, onAbort, onPrompt, onSteer, updateState]);

  const stopListening = useCallback((submit = true) => {
    if (stateRef.current !== "listening" && stateRef.current !== "connecting") return;
    listeningOperationRef.current += 1;
    voiceLevelRef.current = 0;
    setVoiceLevel(0);
    updateState("transcribing");
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    // Let the recorder's current 200 ms frame flush before closing the socket.
    stopTimerRef.current = setTimeout(() => {
      asrRef.current?.stopRecord();
      asrRef.current = null;
      if (submit) submitTranscript(transcriptRef.current);
      else {
        setTranscript("");
        transcriptRef.current = "";
        updateState("idle");
      }
    }, 240);
  }, [submitTranscript, updateState]);

  const startListening = useCallback(async () => {
    stopSpeaking();
    const operation = listeningOperationRef.current + 1;
    listeningOperationRef.current = operation;
    onAudioUnlock?.();
    setError(null);
    setTranscript("");
    transcriptRef.current = "";
    voiceLevelRef.current = 0;
    setVoiceLevel(0);
    updateState("connecting");
    navigator.vibrate?.(8);
    try {
      const [session, sdk] = await Promise.all([
        getSession(),
        import("byted-ailab-speech-sdk"),
      ]);
      if (operation !== listeningOperationRef.current) return;
      const client = sdk.LabASR({
        onStart: () => {
          if (asrRef.current === client) updateState("listening");
        },
        onMessage: (text) => {
          if (asrRef.current !== client || typeof text !== "string") return;
          transcriptRef.current = text;
          setTranscript(text);
        },
        onError: () => {
          if (asrRef.current !== client) return;
          setError("Unable to connect to Doubao speech recognition");
          updateState("error");
        },
      });
      asrRef.current = client;
      client.connect({
        url: buildAuthenticatedUrl(session.asr.endpoint, session, session.asr.resourceId),
        config: {
          user: { uid: "pi-web" },
          audio: { format: "pcm", rate: 16_000, bits: 16, channel: 1 },
          request: {
            model_name: "bigmodel",
            show_utterances: true,
            result_type: "full",
            enable_itn: true,
            enable_punc: true,
            end_window_size: 800,
          },
        },
      });
      await client.startRecord(
        {
          timeSlice: 200,
          numberOfAudioChannels: 1,
          desiredSampRate: 16_000,
          disableLogs: true,
        },
        (audioChunk) => {
          void audioChunk.slice(44).arrayBuffer().then((buffer) => {
            if (operation !== listeningOperationRef.current || buffer.byteLength < 2) return;
            const samples = new Int16Array(buffer);
            let sum = 0;
            let count = 0;
            for (let index = 0; index < samples.length; index += 8) {
              const sample = samples[index] / 32_768;
              sum += sample * sample;
              count += 1;
            }
            const rms = count ? Math.sqrt(sum / count) : 0;
            const target = Math.min(1, rms * 8);
            const smoothed = voiceLevelRef.current * 0.58 + target * 0.42;
            voiceLevelRef.current = smoothed;
            setVoiceLevel(smoothed);
          }).catch(() => {});
        },
      );
      if (operation !== listeningOperationRef.current) {
        client.stopRecord();
        if (asrRef.current === client) asrRef.current = null;
      }
    } catch (cause) {
      if (operation !== listeningOperationRef.current) return;
      asrRef.current?.stopRecord();
      asrRef.current = null;
      setError(cause instanceof Error ? cause.message : String(cause));
      updateState("error");
    }
  }, [getSession, onAudioUnlock, stopSpeaking, updateState]);

  const toggleListening = useCallback(() => {
    if (stateRef.current === "listening" || stateRef.current === "connecting") {
      stopListening(true);
      return;
    }
    if (stateRef.current === "transcribing") return;
    void startListening();
  }, [startListening, stopListening]);

  useEffect(() => {
    if (agentRunning && awaitingReplyRef.current && stateRef.current !== "listening") {
      updateState("agent-working");
    }
  }, [agentRunning, updateState]);

  useEffect(() => {
    if (!sessionId) return;
    try {
      if (sessionStorage.getItem(PENDING_VOICE_REPLY_KEY) !== sessionId) return;
      sessionStorage.removeItem(PENDING_VOICE_REPLY_KEY);
      awaitingReplyRef.current = true;
      if (agentRunning) updateState("agent-working");
    } catch {
      // Ignore unavailable browser storage; in-chat voice still works normally.
    }
  }, [agentRunning, sessionId, updateState]);

  useEffect(() => {
    const changed = latestAssistantText && latestAssistantText !== lastAssistantTextRef.current;
    if (changed) lastAssistantTextRef.current = latestAssistantText;
    if (!changed || agentRunning || !awaitingReplyRef.current) return;
    awaitingReplyRef.current = false;
    void speak(latestAssistantText);
  }, [agentRunning, latestAssistantText, speak]);

  useEffect(() => () => {
    listeningOperationRef.current += 1;
    speakingOperationRef.current += 1;
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (finishConnectionTimerRef.current) clearTimeout(finishConnectionTimerRef.current);
    asrRef.current?.stopRecord();
    ttsRef.current?.close();
    audioRef.current?.pause();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, []);

  return {
    state,
    transcript,
    error,
    voiceLevel,
    isListening: state === "listening" || state === "connecting" || state === "transcribing",
    isSpeaking: state === "speaking",
    toggleListening,
    stopSpeaking,
  };
}
