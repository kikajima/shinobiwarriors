// ============================================================
// Shinobi Online — SFX retrô via WebAudio (osciladores)
// ============================================================

'use client'

type SfxName = 'hit' | 'skill' | 'crit' | 'lvl' | 'death' | 'pot' | 'ui' | 'monster' | 'coin'

class AudioEngine {
  ctx: AudioContext | null = null
  muted = false

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {})
      return
    }
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {})
    } catch {
      // sem áudio
    }
  }

  private beep(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0) {
    if (!this.ctx || this.muted) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur)
    gain.gain.setValueAtTime(vol, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
    osc.connect(gain)
    gain.connect(this.ctx.destination)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  play(name: SfxName) {
    if (!this.ctx || this.muted) return
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {})
    switch (name) {
      case 'hit':
        this.beep(220, 0.08, 'square', 0.06, -80)
        break
      case 'crit':
        this.beep(340, 0.12, 'square', 0.08, -120)
        this.beep(170, 0.1, 'sawtooth', 0.05, -60)
        break
      case 'skill':
        this.beep(520, 0.14, 'sawtooth', 0.05, -200)
        break
      case 'lvl':
        this.beep(523, 0.1, 'square', 0.07)
        setTimeout(() => this.beep(659, 0.1, 'square', 0.07), 90)
        setTimeout(() => this.beep(784, 0.16, 'square', 0.07), 180)
        break
      case 'death':
        this.beep(180, 0.3, 'sawtooth', 0.06, -140)
        break
      case 'pot':
        this.beep(600, 0.09, 'sine', 0.07, 200)
        break
      case 'ui':
        this.beep(440, 0.05, 'square', 0.04)
        break
      case 'monster':
        this.beep(110, 0.12, 'sawtooth', 0.05, -40)
        break
      case 'coin':
        this.beep(880, 0.06, 'square', 0.05)
        setTimeout(() => this.beep(1320, 0.08, 'square', 0.05), 60)
        break
    }
  }
}

export const audio = new AudioEngine()
