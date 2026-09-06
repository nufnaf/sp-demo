import type { CSSProperties } from "react";
import type { VoiceState } from "@/lib/voice/types";

interface VoiceOrbProps {
  state: VoiceState;
  /** Microphone or playback loudness in the 0..1 range. */
  level?: number;
  size?: number;
  className?: string;
}

/**
 * A stable voice presence. CSS gently follows the audio envelope while slow
 * internal drift and interpolated colors distinguish conversational states.
 */
export function VoiceOrb({ state, level = 0, size = 168, className = "" }: VoiceOrbProps) {
  const clamped = Number.isFinite(level) && (state === "hearing" || state === "speaking")
    ? Math.max(0, Math.min(1, (level - 0.04) / 0.96))
    : 0;
  return (
    <div
      className={`voice-orb voice-orb--${state}${className ? ` ${className}` : ""}`}
      style={{ "--voice-orb-size": `${size}px`, "--voice-level": clamped } as CSSProperties}
      aria-hidden="true"
    >
      <span className="voice-orb__halo" />
      <span className="voice-orb__core">
        <span className="voice-orb__cloud" />
        <span className="voice-orb__cloud voice-orb__cloud--alt" />
        <span className="voice-orb__sheen" />
      </span>
    </div>
  );
}
