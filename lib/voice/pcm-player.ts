/**
 * Gapless playback of streamed 16-bit mono PCM through Web Audio. Audio is
 * scheduled back to back as it arrives, can be cut instantly, and exposes an
 * output level for the activity meter.
 */
export class PcmPlayer {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private nextTime = 0;
  private readonly sources = new Set<AudioBufferSourceNode>();
  private carry: Uint8Array | null = null;
  private levelBuffer: Uint8Array<ArrayBuffer> | null = null;
  private generation = 0;

  /** Sample rate of the incoming PCM; Web Audio resamples to the device rate. */
  sampleRate = 24_000;


  /** Create the audio context. Must first run inside a user gesture. */
  unlock(): void {
    if (!this.context) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.context = new Ctor({ latencyHint: "interactive" });
      this.gain = this.context.createGain();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 256;
      this.gain.connect(this.analyser);
      this.analyser.connect(this.context.destination);
    }
    if (this.context.state === "suspended") void this.context.resume().catch(() => {});
  }

  get isPlaying(): boolean {
    return this.sources.size > 0;
  }

  enqueue(chunk: ArrayBuffer): void {
    this.unlock();
    const context = this.context;
    const gain = this.gain;
    if (!context || !gain) return;

    let bytes = new Uint8Array(chunk);
    if (this.carry) {
      const merged = new Uint8Array(this.carry.length + bytes.length);
      merged.set(this.carry);
      merged.set(bytes, this.carry.length);
      bytes = merged;
      this.carry = null;
    }
    if (bytes.length % 2 === 1) {
      this.carry = bytes.slice(bytes.length - 1);
      bytes = bytes.slice(0, bytes.length - 1);
    }
    const sampleCount = bytes.length / 2;
    if (sampleCount === 0) return;

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const buffer = context.createBuffer(1, sampleCount, this.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < sampleCount; index += 1) {
      channel[index] = view.getInt16(index * 2, true) / 32_768;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    const startAt = Math.max(context.currentTime + 0.02, this.nextTime);
    source.start(startAt);
    this.nextTime = startAt + buffer.duration;
    const generation = this.generation;
    this.sources.add(source);
    source.onended = () => {
      if (generation !== this.generation) return;
      this.sources.delete(source);
      if (this.sources.size === 0) this.onDrain?.();
    };
  }

  /** Called whenever the last scheduled chunk finished playing. */
  onDrain: (() => void) | null = null;

  stop(): void {
    this.generation += 1;
    for (const source of this.sources) {
      try { source.stop(); } catch { /* already stopped */ }
      source.disconnect();
    }
    this.sources.clear();
    this.carry = null;
    this.nextTime = 0;
  }

  /** Current output loudness in the 0..1 range. */
  level(): number {
    const analyser = this.analyser;
    if (!analyser || this.sources.size === 0) return 0;
    if (!this.levelBuffer || this.levelBuffer.length !== analyser.fftSize) {
      this.levelBuffer = new Uint8Array(new ArrayBuffer(analyser.fftSize));
    }
    analyser.getByteTimeDomainData(this.levelBuffer);
    let sum = 0;
    for (let index = 0; index < this.levelBuffer.length; index += 1) {
      const sample = (this.levelBuffer[index] - 128) / 128;
      sum += sample * sample;
    }
    return Math.min(1, Math.sqrt(sum / this.levelBuffer.length) * 3);
  }

  dispose(): void {
    this.stop();
    void this.context?.close().catch(() => {});
    this.context = null;
    this.gain = null;
    this.analyser = null;
  }
}
