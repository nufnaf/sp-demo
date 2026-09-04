export type VoiceState =
  /** Conversation mode is off. */
  | "off"
  /** Opening the microphone and speech services. */
  | "connecting"
  /** Microphone open, waiting for the user. */
  | "listening"
  /** The user is talking. */
  | "hearing"
  /** The user's turn was sent and the agent has not answered yet. */
  | "thinking"
  /** Playing the assistant's reply. */
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

export interface VoiceSnapshot {
  state: VoiceState;
  /** Live transcript of what the user is saying. */
  transcript: string;
  /** Sentence currently being spoken. */
  caption: string;
  error: string | null;
  /** Microphone or playback loudness in the 0..1 range. */
  level: number;
}
