import type { CSSProperties } from "react";
import type { VoiceState } from "@/lib/voice/types";

interface VoiceActivityIndicatorProps {
  state: VoiceState;
  /** What the user is saying right now. */
  transcript?: string;
  /** What the assistant is saying right now. */
  caption?: string;
  error?: string | null;
  level?: number;
  labels: Partial<Record<VoiceState, string>>;
  compact?: boolean;
  /** Tapping the indicator while the assistant speaks cuts playback. */
  onInterrupt?: () => void;
}

const BAR_WEIGHTS = [0.52, 0.82, 1, 0.72, 0.46];
const METER_STATES = new Set<VoiceState>(["connecting", "listening", "hearing", "speaking"]);

export function VoiceActivityIndicator({
  state,
  transcript = "",
  caption = "",
  error,
  level = 0,
  labels,
  compact = false,
  onInterrupt,
}: VoiceActivityIndicatorProps) {
  const normalizedLevel = Math.max(0, Math.min(1, level));
  const label = error || labels[state] || labels.listening || "Voice";
  const detail = error
    ? ""
    : state === "speaking"
      ? caption.trim()
      : state === "hearing" || state === "listening" || state === "thinking"
        ? transcript.trim()
        : "";
  const interruptible = state === "speaking" && Boolean(onInterrupt);

  return (
    <div
      className={`voice-activity voice-activity--${state}${compact ? " voice-activity--compact" : ""}${interruptible ? " voice-activity--interruptible" : ""}`}
      role={interruptible ? "button" : "status"}
      aria-live="polite"
      aria-atomic="false"
      tabIndex={interruptible ? 0 : undefined}
      onClick={interruptible ? onInterrupt : undefined}
      onKeyDown={interruptible ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onInterrupt?.();
        }
      } : undefined}
    >
      <span className="voice-activity__orb" aria-hidden="true">
        <span />
      </span>
      <span className="voice-activity__copy">
        <strong>{label}</strong>
        {detail && detail !== label ? <span>{detail}</span> : null}
      </span>
      {!error && METER_STATES.has(state) ? (
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
