import type { CSSProperties } from "react";
import type { VoiceState } from "@/lib/voice/types";

interface VoiceActivityIndicatorProps {
  state: VoiceState;
  transcript?: string;
  error?: string | null;
  level?: number;
  labels: Partial<Record<VoiceState, string>>;
  compact?: boolean;
}

const BAR_WEIGHTS = [0.52, 0.82, 1, 0.72, 0.46];

export function VoiceActivityIndicator({
  state,
  transcript = "",
  error,
  level = 0,
  labels,
  compact = false,
}: VoiceActivityIndicatorProps) {
  const normalizedLevel = Math.max(0, Math.min(1, level));
  const label = error || labels[state] || labels.idle || "Voice";
  const showTranscript = !error && transcript.trim() && transcript.trim() !== label;

  return (
    <div
      className={`voice-activity voice-activity--${state}${compact ? " voice-activity--compact" : ""}`}
      role="status"
      aria-live="polite"
      aria-atomic="false"
    >
      <span className="voice-activity__orb" aria-hidden="true">
        <span />
      </span>
      <span className="voice-activity__copy">
        <strong>{label}</strong>
        {showTranscript ? <span aria-hidden="true">{transcript.trim()}</span> : null}
      </span>
      {!error && (state === "connecting" || state === "listening" || state === "transcribing" || state === "speaking") ? (
        <span className="voice-activity__meter" aria-hidden="true">
          {BAR_WEIGHTS.map((weight, index) => (
            <i
              key={index}
              style={{ "--voice-bar-scale": Math.max(0.22, 0.22 + normalizedLevel * weight * 0.78) } as CSSProperties}
            />
          ))}
        </span>
      ) : null}
    </div>
  );
}
