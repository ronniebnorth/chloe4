// Tone of voice in a video: how lively the talking is, from the sound alone (any
// language). While someone talks, every ~1 s is scored on three things measured
// against that video's own talking, so a deep voice isn't "calm" just for being deep:
//   - pitch: how high the voice sits (cents above the speaker's median)
//   - movement: how much the pitch moves (spread, in cents)
//   - loudness: how loud (dB above the talking's median)
// They make one "liveliness" score, 0 (calm, low, flat, soft) to 1 (excited, high,
// moving, loud). It reads energy, not mood: happy and angry both come out lively.
// Pitch uses YIN, as the Tone Translator's tone_probe.py does (looser here, 0.35,
// since video sound is often noisy), and readings more than an octave from the
// speaker's median are dropped (hum, octave slips).
const SR = 16000, FRAME = 480, HOP = 320;          // 30 ms frames every 20 ms
const TMIN = Math.floor(SR / 400), TMAX = Math.ceil(SR / 70);   // voices 70-400 Hz
export const TONE_STEP = 0.5;                      // one score every half second

function yinFrame(x, i0) {
  const d = new Float32Array(TMAX + 1);
  for (let tau = 1; tau <= TMAX; tau++) {
    let s = 0;
    for (let j = 0; j < FRAME; j++) { const v = x[i0 + j] - x[i0 + j + tau]; s += v * v; }
    d[tau] = s;
  }
  let cs = 0, best = -1;
  const c = new Float32Array(TMAX + 1); c[0] = 1;
  for (let tau = 1; tau <= TMAX; tau++) { cs += d[tau]; c[tau] = cs > 0 ? d[tau] * tau / cs : 1; }
  for (let tau = TMIN; tau < TMAX; tau++) if (c[tau] < 0.35) { best = tau; break; }   // 0.35: video sound is often noisy
  if (best < 0) return 0;
  while (best + 1 < TMAX && c[best + 1] < c[best]) best++;
  if (best <= TMIN + 1 || best >= TMAX - 1) return 0;   // pinned at the edge: breath, not voice
  const a = c[best - 1], b = c[best], e = c[best + 1], den = a - 2 * b + e;
  return SR / (best + (Math.abs(den) > 1e-12 ? 0.5 * (a - e) / den : 0));
}

const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const clamp01 = x => Math.min(1, Math.max(0, x));

// pcm: 16 kHz mono; talk: [[start, end] s]. Returns { at: Float32Array (NaN where no
// talking, else 0..1 per TONE_STEP), pitchHz: the speaker's median pitch }
export function voiceTone(pcm, talk) {
  const frames = [];   // { t, f0 (0 = unvoiced), db }
  for (const [a, b] of talk) {
    for (let i0 = Math.floor(a * SR); i0 + FRAME + TMAX < Math.min(pcm.length, b * SR); i0 += HOP) {
      let e = 0; for (let j = 0; j < FRAME; j++) e += pcm[i0 + j] * pcm[i0 + j];
      frames.push({ t: i0 / SR, f0: yinFrame(pcm, i0), db: 10 * Math.log10(e / FRAME + 1e-12) });
    }
  }
  const n = Math.ceil(pcm.length / SR / TONE_STEP), at = new Float32Array(n).fill(NaN);
  const voiced = frames.filter(f => f.f0 > 0);
  if (voiced.length < 20) return { at, pitchHz: 0 };
  const refHz = median(voiced.map(f => f.f0)), refDb = median(frames.map(f => f.db));
  for (const f of frames) if (f.f0 && Math.abs(Math.log2(f.f0 / refHz)) > 0.9) f.f0 = 0;   // an octave off: not the voice
  const cents = f => 1200 * Math.log2(f / refHz);
  // Per window: 1 s of talking centred on each half-second step
  const raw = [];
  for (let k = 0; k < n; k++) {
    const t = k * TONE_STEP, win = frames.filter(f => f.t >= t - 0.5 && f.t < t + 0.5);
    const v = win.filter(f => f.f0 > 0).map(f => cents(f.f0));
    if (win.length < 15 || v.length < 5) continue;
    const s = [...v].sort((x, y) => x - y), spread = s[Math.floor(s.length * 0.9)] - s[Math.floor(s.length * 0.1)];
    raw.push({ k, pitch: median(v), spread, loud: median(win.map(f => f.db)) - refDb });
  }
  const refSpread = median(raw.map(r => r.spread));
  for (const r of raw) {
    // +400 cents, +300 cents of extra movement, or +8 dB each push fully lively
    at[r.k] = clamp01(0.5 + 0.45 * (r.pitch / 400) + 0.3 * ((r.spread - refSpread) / 300) + 0.3 * (r.loud / 8));
  }
  // Smooth across neighbouring windows so it moves like a mood, not every syllable
  const out = new Float32Array(n).fill(NaN);
  for (let k = 0; k < n; k++) {
    if (isNaN(at[k])) continue;
    let s = 0, c = 0;
    for (let j = k - 2; j <= k + 2; j++) if (j >= 0 && j < n && !isNaN(at[j])) { s += at[j]; c++; }
    out[k] = s / c;
  }
  return { at: out, pitchHz: refHz };
}
