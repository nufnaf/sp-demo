"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DictationRecorder, type DictationState } from "@/lib/voice/dictation";
import { getVoiceEngine } from "@/lib/voice/voice-engine";

interface UseDictationOptions {
  /** Receives the transcribed text when a recording ends. */
  onResult(text: string): void;
  onAudioUnlock?(): void;
}

/**
 * Tap-to-dictate: speech becomes text that is sent as a normal message. It is
 * unavailable while the live voice conversation owns the microphone.
 */
export function useDictation({ onResult, onAudioUnlock }: UseDictationOptions) {
  const [state, setState] = useState<DictationState>("idle");
  const [transcript, setTranscript] = useState("");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const handlers = useRef({ onResult, onAudioUnlock });
  handlers.current = { onResult, onAudioUnlock };
  const recorderRef = useRef<DictationRecorder | null>(null);

  if (!recorderRef.current) {
    recorderRef.current = new DictationRecorder({
      onState: setState,
      onTranscript: setTranscript,
      onLevel: (value) => setLevel(Math.round(value * 100) / 100),
      onResult: (text) => handlers.current.onResult(text),
      onError: setError,
    });
  }

  useEffect(() => () => recorderRef.current?.cancel(), []);

  const start = useCallback(() => {
    if (getVoiceEngine().isActive) return;
    setError(null);
    handlers.current.onAudioUnlock?.();
    navigator.vibrate?.(8);
    void recorderRef.current?.start();
  }, []);
  const stop = useCallback(() => recorderRef.current?.stop(), []);
  const cancel = useCallback(() => recorderRef.current?.cancel(), []);
  const toggle = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.isActive) recorder.stop();
    else start();
  }, [start]);

  return {
    state,
    transcript,
    level,
    error,
    isRecording: state === "connecting" || state === "recording" || state === "finishing",
    start,
    stop,
    cancel,
    toggle,
  };
}
