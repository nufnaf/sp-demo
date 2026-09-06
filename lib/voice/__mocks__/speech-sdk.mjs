// Minimal stand-in for byted-ailab-speech-sdk's LabASR: the harness pushes results.
export const asrClients = [];
export function LabASR(callbacks) {
  const client = { callbacks, connected: false, recording: false, stopped: false,
    connect() { this.connected = true; setTimeout(() => callbacks.onStart?.(), 5); },
    async startRecord(_opts, onChunk) { this.recording = true; this.onChunk = onChunk; },
    stopRecord() { this.stopped = true; this.recording = false; setTimeout(() => callbacks.onClose?.(), 5); },
    emit(result) { callbacks.onMessage?.(result.text ?? "", { result }); },
  };
  asrClients.push(client);
  return client;
}
export function BidirectionalTTS() { throw new Error("not used"); }
export function LabTTS() { throw new Error("not used"); }
