// Web Audio API generator for alarm beeps and fire crackles in renderer lab

class WebAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private alarmOsc: OscillatorNode | null = null;
  private alarmGain: GainNode | null = null;
  private crackleNode: AudioBufferSourceNode | null = null;
  private crackleGain: GainNode | null = null;

  private initCtx() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
  }

  public playAlarm() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") {
        this.ctx.resume();
      }

      if (this.alarmOsc) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(880, this.ctx.currentTime); // A5 note

      // Pulsing alarm gain
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();

      this.alarmOsc = osc;
      this.alarmGain = gain;
    } catch {
      // Audio autoplay restrictions or headless environment
    }
  }

  public playCrackle() {
    try {
      this.initCtx();
      if (!this.ctx) return;

      if (this.crackleNode) return;

      // Generate 2 seconds of pink/white noise crackle
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Crackle bursts
        const burst = Math.random() > 0.98 ? Math.random() * 0.8 : 0;
        data[i] = white * 0.02 + burst;
      }

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);

      source.connect(gain);
      gain.connect(this.ctx.destination);
      source.start();

      this.crackleNode = source;
      this.crackleGain = gain;
    } catch {
      // Audio autoplay restrictions
    }
  }

  public setDoorOpenSound(doorOpen: boolean) {
    if (this.crackleGain && this.ctx) {
      this.crackleGain.gain.setValueAtTime(doorOpen ? 0.25 : 0.05, this.ctx.currentTime);
    }
  }

  public stopAll() {
    try {
      if (this.alarmOsc) {
        this.alarmOsc.stop();
        this.alarmOsc.disconnect();
        this.alarmOsc = null;
      }
      if (this.crackleNode) {
        this.crackleNode.stop();
        this.crackleNode.disconnect();
        this.crackleNode = null;
      }
    } catch {
      // ignore cleanup errors
    }
  }
}

export const audioSynth = new WebAudioSynthesizer();
