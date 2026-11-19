class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private tone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  public playGold(): void {
    this.tone(980, 1480, 0.08, 'sine', 0.06);
    this.tone(1320, 1980, 0.1, 'triangle', 0.05, 0.05);
  }

  public playPlace(): void {
    this.tone(240, 440, 0.12, 'triangle', 0.09);
    this.tone(440, 660, 0.12, 'sine', 0.07, 0.06);
  }

  public playUpgrade(isAghanims = false): void {
    if (isAghanims) {
      this.tone(330, 440, 0.15, 'triangle', 0.11, 0);
      this.tone(440, 554, 0.15, 'triangle', 0.11, 0.09);
      this.tone(554, 659, 0.18, 'sine', 0.12, 0.18);
      this.tone(659, 880, 0.35, 'sine', 0.12, 0.28);
    } else {
      this.tone(360, 540, 0.12, 'triangle', 0.09, 0);
      this.tone(540, 720, 0.18, 'sine', 0.09, 0.08);
    }
  }

  public playSell(): void {
    this.tone(600, 320, 0.12, 'triangle', 0.08);
  }

  public playSniper(): void {
    this.tone(520, 110, 0.07, 'sawtooth', 0.045);
  }

  public playAssassinate(): void {
    this.tone(860, 90, 0.24, 'sawtooth', 0.11);
    this.tone(180, 55, 0.28, 'square', 0.08, 0.03);
  }

  public playFrost(): void {
    this.tone(720, 1100, 0.14, 'sine', 0.055);
  }

  public playCleave(): void {
    this.tone(220, 95, 0.09, 'sawtooth', 0.05);
  }

  public playPoison(): void {
    this.tone(300, 220, 0.1, 'sine', 0.045);
  }

  public playLaguna(): void {
    this.tone(1200, 220, 0.26, 'sawtooth', 0.11);
    this.tone(900, 140, 0.3, 'square', 0.08, 0.04);
  }

  public playEchoSlam(): void {
    this.tone(140, 36, 0.35, 'sawtooth', 0.13);
    this.tone(95, 30, 0.4, 'triangle', 0.12, 0.05);
  }

  public playRoshanRoar(): void {
    this.tone(130, 55, 0.55, 'sawtooth', 0.14);
    this.tone(92, 40, 0.65, 'square', 0.11, 0.08);
  }

  public playAncientHit(): void {
    this.tone(180, 70, 0.22, 'sawtooth', 0.12);
  }

  public playVictory(): void {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => this.tone(n, n, 0.25, 'triangle', 0.11, i * 0.13));
  }

  public playDefeat(): void {
    const notes = [392, 349, 311, 261];
    notes.forEach((n, i) => this.tone(n, n * 0.92, 0.28, 'sawtooth', 0.09, i * 0.16));
  }
}

export const sound = new SoundEngine();
