export type VoiceState =
  | "idle"
  | "connecting"
  | "listening"
  | "transcribing"
  | "agent-working"
  | "speaking"
  | "error";

export interface DoubaoVoiceSession {
  token: string;
  expiresAt: number;
  appId: string;
  asr: {
    endpoint: string;
    resourceId: string;
  };
  tts: {
    endpoint: string;
    resourceId: string;
    speaker: string;
    sampleRate: number;
  };
}

export interface VoiceUiState {
  state: VoiceState;
  transcript: string;
  error: string | null;
}
