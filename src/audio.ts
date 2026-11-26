export class EngineAudio {
  private context: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;

  async start(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.12;
      this.masterGain.connect(this.context.destination);
      this.oscillator = this.context.createOscillator();
      this.oscillator.type = "sawtooth";
      this.engineGain = this.context.createGain();
      this.engineGain.gain.value = 0.055;
      const filter = this.context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 420;
      this.oscillator.connect(filter).connect(this.engineGain).connect(this.masterGain);
      this.oscillator.start();
    }
    if (this.context.state === "suspended") await this.context.resume();
  }

  update(speed: number): void {
    if (!this.context || !this.oscillator || !this.engineGain) return;
    const now = this.context.currentTime;
    const intensity = Math.min(1, Math.abs(speed) / 15);
    this.oscillator.frequency.setTargetAtTime(58 + intensity * 95, now, 0.08);
    this.engineGain.gain.setTargetAtTime(0.035 + intensity * 0.045, now, 0.08);
  }

  toggle(): boolean {
    this.muted = !this.muted;
    if (this.context && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.12, this.context.currentTime, 0.04);
    }
    return this.muted;
  }

  collision(): void {
    this.tone(72, 0.16, "square", 0.24);
  }

  success(): void {
    this.tone(392, 0.16, "sine", 0.13);
    window.setTimeout(() => this.tone(523, 0.26, "sine", 0.13), 130);
  }

  private tone(frequency: number, duration: number, type: OscillatorType, volume: number): void {
    if (!this.context || !this.masterGain || this.muted) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);
    oscillator.connect(gain).connect(this.masterGain);
    oscillator.start();
    oscillator.stop(this.context.currentTime + duration);
  }
}
