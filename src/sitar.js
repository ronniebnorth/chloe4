/* Synth sitar: plain JS, no Web Audio, so it can be rendered and tested
   anywhere (node or the browser). Each note is computed into a Float32Array.

   The three things that make a sitar a sitar (and that a sample can't do):
   1. The jawari bridge. The main string rests on a wide, gently curved
      bridge and brushes it as it vibrates. Modelled the way Välimäki et al.
      do: the string's loop length is shortened a little whenever the string
      swings toward the bridge, at audio rate, which spreads energy into the
      upper partials: the buzzing shimmer that sweeps as the note dies. The
      slow average of that shortening is taken back out, so the note stays
      in tune.
   2. The taraf: 11-13 sympathetic strings under the main ones, tuned to the
      raga's notes, never plucked. They ring when the played note's partials
      match theirs (tarafCoupling), swelling in a little after the pluck and
      ringing on long after it.
   3. Moving pitch: done by the player (playbackRate on the rendered note),
      not here.

   The string itself is Karplus-Strong: a delay line one period long, read
   with 4-point Lagrange interpolation so any pitch lands exactly, a gentle
   low-pass in the loop, and a loop gain set from the ring time. */

// Small seeded random, so tests can repeat a note exactly
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/* One string, plucked. f in Hz, secs long.
   amp:    pluck strength (0..1); a harder pluck also buzzes more
   bright: 0..1, the loop filter (1 = the mizrab's bright wire attack rings on)
   pick:   pluck position as a fraction of the string (notches those partials)
   jaw:    jawari, 0..0.9: how far into its own swing the bridge reaches (0 = a plain string)
   buzz:   0..1, the bridge's buzz band (its centre sweeps down after the pluck)
   t60:    seconds for the low partials to fall 60 dB
   soft:   0..1, rounds off the pluck (sympathetic strings are set going softly) */
export function renderString(sr, f, secs, { amp = 0.5, bright = 0.9, pick = 0.12, jaw = 0.35, buzz = 0.5, t60 = 4, soft = 0, seed = 1 } = {}) {
  const n = Math.max(1, Math.floor(secs * sr)), out = new Float32Array(n);
  const P = sr / f;                                  // period in samples
  const s = 0.5 - 0.35 * Math.max(0, Math.min(1, bright));   // loop filter: y = (1-s)x + s·x₋₁, delay s
  const D0 = P - s;                                  // delay-line read distance for exact pitch
  const g = Math.pow(10, -3 / (t60 * f));            // loop gain per period
  let M = 1; while (M < P + 8) M <<= 1;
  const H = new Float32Array(M), mask = M - 1;       // history ring buffer
  // The pluck: noise, low-passed (soft or bright), notched at the pick point
  const rnd = rng(seed * 7919 + Math.round(f * 13)), L = Math.max(4, Math.round(P));
  const e = new Float32Array(L);
  let lp = 0; const a = 0.25 + 0.7 * soft;
  for (let i = 0; i < L; i++) { lp += (1 - a) * ((rnd() * 2 - 1) - lp); e[i] = lp; }
  const k = Math.max(1, Math.round(pick * L)), e2 = new Float32Array(L);
  for (let i = 0; i < L; i++) e2[i] = e[i] - e[(i - k + L) % L];
  let mean = 0, pk = 0; for (const x of e2) mean += x / L;
  for (let i = 0; i < L; i++) { e2[i] -= mean; pk = Math.max(pk, Math.abs(e2[i])); }
  for (let i = 0; i < L; i++) H[(i - L) & mask] = e2[i] * amp / (pk || 1);
  // Run the loop. The bridge: on the swing toward it, the string is held back
  // above a level that is a fraction (1 - jaw) of its own current swing, so it
  // keeps brushing the bridge however quiet it gets, as the curved jawari
  // does: energy keeps moving up into the high partials (the buzz) right to
  // the end of the note, instead of dying away as on a plain string.
  let px = 0, A = amp, dc = 0, dcIn = 0;
  const fall = Math.pow(0.001, 1 / (0.05 * sr));     // the swing tracker lets go over ~50 ms
  const kappa = 1 - Math.max(0, Math.min(0.9, jaw)), give = 0.15;
  const di = Math.floor(D0), fr = D0 - di, d = fr;
  const c0 = -d * (d - 1) * (d - 2) / 6, c1 = (d + 1) * (d - 1) * (d - 2) / 2, c2 = -(d + 1) * d * (d - 2) / 2, c3 = (d + 1) * d * (d - 1) / 6;
  // The buzz band: the part of the swing past the bridge level, through a
  // band-pass (state-variable filter) whose centre glides 3.5 kHz → 1.5 kHz
  // over the first ~0.8 s, as heard on recordings. Measured against the
  // string's own swing, so it stays in proportion as the note dies away.
  let bLow = 0, bBand = 0, F = 0;
  const bQ = 1 / 2.2, sweepT = 0.35 * sr;
  for (let t = 0; t < n; t++) {
    // 4-point Lagrange around the read point (taps at di-1, di, di+1, di+2)
    const x = c0 * H[(t - di + 1) & mask] + c1 * H[(t - di) & mask] + c2 * H[(t - di - 1) & mask] + c3 * H[(t - di - 2) & mask];
    let y = g * ((1 - s) * x + s * px);
    px = x;
    const ay = y < 0 ? -y : y;
    A = ay > A ? ay : A * fall;
    if (jaw > 0) { const b = kappa * A; if (y > b) y = b + (y - b) * give; }
    H[t & mask] = y;
    // DC blocker on the way out (the one-sided bridge adds a little offset)
    dc = y - dcIn + 0.995 * dc; dcIn = y;
    let o = dc;
    if (buzz > 0) {
      const over = y - 0.5 * A; const r = over > 0 ? over : 0;
      if ((t & 31) === 0) F = 2 * Math.sin(Math.PI * Math.min(1500 + 2000 * Math.exp(-t / sweepT), sr / 6) / sr);
      const high = r - bLow - bQ * bBand; bBand += F * high; bLow += F * bBand;
      o += buzz * 2.5 * bBand;
    }
    out[t] = o;
  }
  return out;
}

/* How strongly a sympathetic string at ft is set ringing by a played note at f:
   the overlap of their partials (within ~10 cents), 0..1. */
export function tarafCoupling(f, ft) {
  let w = 0;
  for (let h = 1; h <= 10; h++) for (let k = 1; k <= 6; k++) {
    const c = 1200 * Math.log2((f * h) / (ft * k));
    if (Math.abs(c) < 40) w += Math.exp(-((c / 10) ** 2)) / (Math.pow(h, 0.7) * k);
  }
  return Math.min(1, w);
}

// The taraf for a scale: its notes (cents above Sa) from Sa upward over two
// octaves, at most 13 strings, starting an octave above Sa as on the instrument.
export function tarafTuning(saHz, cents, count = 13) {
  const fs = [];
  for (let o = 1; fs.length < count && o <= 3; o++) for (const c of cents) { if (fs.length < count) fs.push(saHz * 2 ** (o + c / 1200)); }
  return fs;
}

/* One sympathetic string ringing, at full strength: set going softly, it
   swells in over ~60 ms and rings long. A note scales it by tarafCoupling ×
   velocity (the string behaves the same at any level, so one render serves
   every note). */
export function renderTarafString(sr, ft, secs = 5, seed = 1) {
  const y = renderString(sr, ft, secs, { amp: 1, bright: 0.8, pick: 0.27, jaw: 0.2, buzz: 0.25, t60: 6.5, soft: 0.7, seed });
  const T = 0.06 * sr;
  for (let i = 0; i < y.length && i < 8 * T; i++) y[i] *= 1 - Math.exp(-i / T);
  return y;
}
// The same, scaled for one note; null when too weakly coupled to matter
export function renderTaraf(sr, f, ft, vel, secs = 5, seed = 1) {
  const c = tarafCoupling(f, ft);
  if (c < 0.08) return null;
  const y = renderTarafString(sr, ft, secs, seed), k = 0.32 * vel * c;
  for (let i = 0; i < y.length; i++) y[i] *= k;
  return { c, y };
}
