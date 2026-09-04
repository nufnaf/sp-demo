"use client";

import { useCallback, useEffect, useId, useRef, useSyncExternalStore } from "react";
import { getVoiceEngine } from "@/lib/voice/voice-engine";
import type { VoiceSnapshot } from "@/lib/voice/types";

interface UseRealtimeVoiceOptions {
  /** Surfaces with a higher priority receive the user's turns when several are mounted. */
  priority: number;
  agentRunning: boolean;
  /** Assistant text to narrate; pass the streaming text so sentences are spoken as they arrive. */
  speechText: string;
  onPrompt(text: string): void;
  onSteer(text: string): void;
  /** The user interrupted the assistant mid-speech; defaults to onSteer. */
  onInterrupt?(text: string): void;
  onAbort(): void;
  onAudioUnlock?(): void;
}

const OFF_SNAPSHOT: VoiceSnapshot = { state: "off", transcript: "", caption: "", error: null, level: 0 };

/**
 * Bind a surface to the shared always-on voice conversation. The engine keeps
 * the microphone open across surfaces; this hook only routes turns and text.
 */
export function useRealtimeVoice({
  priority,
  agentRunning,
  speechText,
  onPrompt,
  onSteer,
  onInterrupt,
  onAbort,
  onAudioUnlock,
}: UseRealtimeVoiceOptions) {
  const id = useId();
  const engine = getVoiceEngine();
  const snapshot = useSyncExternalStore(
    (listener) => engine.subscribe(listener),
    () => engine.getSnapshot(),
    () => OFF_SNAPSHOT,
  );

  const handlers = useRef({ onPrompt, onSteer, onInterrupt, onAbort, onAudioUnlock });
  handlers.current = { onPrompt, onSteer, onInterrupt, onAbort, onAudioUnlock };

  useEffect(() => {
    engine.registerDriver({
      id,
      priority,
      agentRunning,
      speechText,
      onPrompt: (text) => handlers.current.onPrompt(text),
      onSteer: (text) => handlers.current.onSteer(text),
      onInterrupt: (text) => (handlers.current.onInterrupt ?? handlers.current.onSteer)(text),
      onAbort: () => handlers.current.onAbort(),
    });
    return () => engine.unregisterDriver(id);
    // Registration happens once per surface; live fields are synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, id, priority]);

  useEffect(() => {
    engine.updateDriver(id, { agentRunning });
  }, [agentRunning, engine, id]);

  useEffect(() => {
    engine.updateDriver(id, { speechText });
  }, [engine, id, speechText]);

  const toggle = useCallback(() => {
    if (!engine.isActive) {
      handlers.current.onAudioUnlock?.();
      navigator.vibrate?.(8);
    }
    engine.toggle();
  }, [engine]);

  const interrupt = useCallback(() => engine.interrupt(), [engine]);
  /** Call when the user submits typed input so speech follows the newest exchange. */
  const noteUserInput = useCallback(() => engine.noteUserInput(), [engine]);

  return {
    state: snapshot.state,
    transcript: snapshot.transcript,
    caption: snapshot.caption,
    error: snapshot.error,
    voiceLevel: snapshot.level,
    isActive: snapshot.state !== "off",
    isSpeaking: snapshot.state === "speaking",
    toggle,
    interrupt,
    noteUserInput,
  };
}
