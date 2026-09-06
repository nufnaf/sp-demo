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
 * The presence of the assistant in voice mode: a soft sphere that breathes
 * while listening, swells with the user's voice, drifts while thinking, and
 * pulses with its own speech. Everything is CSS; the level drives a variable.
 */
export function VoiceOrb({ state, level = 0, size = 168, className = "" }: VoiceOrbProps) {
  const clamped = Math.max(0, Math.min(1, level));
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
