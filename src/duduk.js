/* Duduk voice: plain JS, no Web Audio, sample by sample, so it can be
   rendered in node for listening tests and run later in an AudioWorklet.

   One voice is one player with one breath: notes don't start and stop a new
   tone, they move the same one. What makes a duduk sound like a singer:
   - Legato. Inside a phrase the reed never stops; the pitch slides from note
     to note. A phrase's first note scoops up into pitch from below.
   - Its colour follows its loudness. Soft, it's dark and nearly pure; as it
     swells, the reedy upper partials come in (the spectral tilt is tied to
     the level).
   - It's never still. Jitter and shimmer (tiny random wobbles of pitch and
     level, as in a voice), a vibrato that blooms late on long notes with its
     rate and depth drifting, a slight swell through held notes.
   - Breath. Air noise that pulses with each cycle of the reed, more of it in
     soft playing and at the onset.
   - Phrase ends sigh: the level falls and the pitch sinks a few cents.
   - Breath that varies: each phrase gets its own amount of air (0.6-1.4×),
     drifting slowly within the phrase.
   - gain (per note) is the loudness only: it doesn't darken the tone, so a
     volume control doesn't change the colour.

   Use: const v = new DudukVoice(sr, opts); v.noteOn(hz, vel, legato);
   v.noteOff(); v.render(outFloat32, start, count) adds into out. */

const TAU = Math.PI * 2;
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// RBJ biquad peaking / bandpass / lowpass, direct form 1
function biquad(type, sr, f, Q, gainDb = 0) {
  const A = 10 ** (gainDb / 40), w = TAU * f / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * Q);
  let b0, b1, b2, a0, a1, a2;
  if (type === "peak") { b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; }
  else if (type === "band") { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
  else { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
  const c = [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => { const y = c[0] * x + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}

export const DUDUK_DEFAULTS = {
  // Version "A" of the 2026-11-09 listening test (Ronnie: "A for sure"; the
  // brighter, cleaner B "sounded more like a big ocarina"; a breathier A2
  // was "maybe too breathy, but sometimes there is more or less breath")
  breath: 0.26,      // air noise level (each phrase takes its own share, see breathMul)
  dark: 2.5,         // spectral tilt when soft (higher = darker)
  bright: 1.35,      // spectral tilt when loud
  even: 0.5,         // even partials relative to odd (cylindrical bore: odd strong)
  vibRate: 5.1,      // Hz, centre of the drift
  vibDepth: 16,      // cents, typical bloom depth
  vibDelay: 0.35,    // s after a note starts before vibrato blooms
  glide: 0.07,       // s, legato slide time constant
  scoop: 70,         // cents below on a phrase's first note
  sigh: 30,          // cents the pitch sinks as a phrase ends
  formants: [[560, 1.4, 6], [1100, 2.2, 4], [2700, 3, 2]],   // Hz, Q, dB
};

export class DudukVoice {
  constructor(sr, opts = {}) {
    this.sr = sr; this.o = { ...DUDUK_DEFAULTS, ...opts };
    this.rnd = rng(opts.seed || 12345);
    this.phase = 0; this.vibPh = 0;
    this.logF = Math.log2(220); this.tgtLogF = this.logF;
    this.amp = 0; this.tgtAmp = 0; this.ampTau = 0.08;
    this.on = false; this.noteT = 0; this.vibD = 0; this.vibTgt = 0;
    this.rateDrift = 0; this.depthDrift = 1;
    this.breathMul = 1; this.breathDrift = 0; this.gain = 0; this.tgtGain = 0;
    this.jit = 0; this.shim = 0; this.onsetAir = 0; this.sighCents = 0; this.swell = 1;
    this.fTau = this.o.glide;
    this.form = this.o.formants.map(([f, q, g]) => biquad("peak", sr, f, q, g));
    this.lp = biquad("low", sr, 4200, 0.6);
    this.air = biquad("band", sr, 1900, 0.7);
    this.hp = 0; this.hpIn = 0;
  }
  // A note: hz, vel 0..1, legato = slide from the current note (the phrase goes on)
  noteOn(hz, vel = 0.7, legato = this.on, gain = 1) {
    this.tgtGain = gain;
    const L = Math.log2(hz);
    if (!legato || this.amp < 0.02) {
      this.logF = L - this.o.scoop * (0.6 + 0.8 * this.rnd()) / 1200;   // scoop up from below
      this.fTau = 0.06 + 0.05 * this.rnd();
      this.ampTau = 0.09; this.onsetAir = 1;
      this.vibD = 0;
      this.breathMul = 0.6 + 0.8 * this.rnd();   // this phrase's own amount of air
      if (this.amp < 0.02) this.gain = gain;
    } else {
      this.fTau = this.o.glide * (0.7 + 0.6 * this.rnd());
      this.ampTau = 0.15;
      this.vibD *= 0.35;   // the vibrato dips through a change of note
      this.onsetAir = Math.max(this.onsetAir, 0.25);
    }
    this.tgtLogF = L; this.sighCents = 0;
    this.tgtAmp = 0.45 + 0.55 * vel; this.swell = 0.88;
    this.on = true; this.noteT = 0;
    this.vibTgt = this.o.vibDepth * (0.7 + 0.6 * this.rnd());
  }
  // The phrase ends: the breath runs out, the pitch sinks a little
  noteOff(release = 0.25) {
    this.on = false; this.tgtAmp = 0; this.ampTau = release;
    this.sighCents = this.o.sigh * (0.5 + this.rnd());
  }
  render(out, start = 0, count = out.length - start) {
    const sr = this.sr, o = this.o, dt = 1 / sr, r = this.rnd;
    const kF = 1 - Math.exp(-dt / this.fTau), kA = 1 - Math.exp(-dt / this.ampTau);
    const kJ = 1 - Math.exp(-dt * TAU * 18), kS = 1 - Math.exp(-dt * TAU * 12), kV = 1 - Math.exp(-dt / 0.45), kD = 1 - Math.exp(-dt / 1.5);
    for (let i = start; i < start + count; i++) {
      // control (smoothed every sample; cheap enough)
      this.logF += kF * (this.tgtLogF - this.logF);
      this.amp += kA * (this.tgtAmp - this.amp);
      this.gain += 0.002 * (this.tgtGain - this.gain);
      this.noteT += dt;
      if (this.on) this.swell += (1 - this.swell) * dt / 1.2;
      // vibrato: blooms after vibDelay, rate and depth drift slowly
      this.rateDrift += kD * ((r() * 2 - 1) * 0.6 - this.rateDrift);
      this.depthDrift += kD * ((0.75 + 0.5 * r()) - this.depthDrift);
      this.breathDrift += kD * 0.5 * ((r() * 2 - 1) - this.breathDrift);
      const want = this.on && this.noteT > o.vibDelay ? this.vibTgt * this.depthDrift : this.vibD * 0.98;
      this.vibD += kV * (want - this.vibD);
      this.vibPh += TAU * (o.vibRate + this.rateDrift) * dt;
      const vib = Math.sin(this.vibPh);
      // jitter / shimmer: low-passed noise
      this.jit += kJ * ((r() * 2 - 1) - this.jit);
      this.shim += kS * ((r() * 2 - 1) - this.shim);
      const sigh = this.on ? 0 : this.sighCents * (1 - Math.min(1, this.amp / 0.3));
      const cents = this.vibD * vib + 4 * this.jit - sigh;
      const f = 2 ** (this.logF + cents / 1200);
      this.phase += f * dt; if (this.phase > 1) this.phase -= 1;
      const lvl = this.amp * this.swell * (1 + 0.04 * this.shim + 0.012 * this.vibD / 16 * vib);
      if (lvl < 1e-5 && !this.on) { continue; }
      // the reed: partials with a tilt that follows the level
      const tilt = o.dark + (o.bright - o.dark) * Math.min(1, lvl);
      const nMax = Math.min(24, Math.floor(6000 / f));
      let s = 0;
      for (let n = 1; n <= nMax; n++) s += (n & 1 ? 1 : o.even) * Math.pow(n, -tilt) * Math.sin(TAU * n * this.phase);
      // breath: noise pulsing with the reed's cycle, more when soft and at onsets
      this.onsetAir *= 1 - dt / 0.12;
      const pulse = 0.55 + 0.45 * Math.max(0, Math.sin(TAU * this.phase));
      const airAmt = o.breath * this.breathMul * (1 + 0.6 * this.breathDrift) * (0.5 + 0.7 * (1 - Math.min(1, lvl)) + 1.6 * this.onsetAir);
      const a = this.air((r() * 2 - 1)) * airAmt * pulse;
      let y = s * lvl + a * Math.sqrt(lvl);
      for (const F of this.form) y = F(y);
      y = this.lp(y);
      // DC / rumble blocker
      this.hp = y - this.hpIn + 0.995 * this.hp; this.hpIn = y;
      out[i] += this.hp * 0.3 * this.gain;
    }
  }
}
