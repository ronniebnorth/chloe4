// Chloe4 scale core: 24 steps per octave (quarter tones).
//
// A pattern is a 24-bit number, root-first: bit i = the note i quarter tones
// above the root. A 12-note (Chloe3) scale is its 12-bit pattern with every bit
// moved to an even position, so Ionian 2741 (12-bit) becomes up12(2741).
// Semitone values handed to the sound engine are fractional for quarter tones
// (Rast's 3rd = 3.5), so `2 ** (semi / 12)` frequency maths works unchanged.

export const Q = 24;
export const FULL = (1 << Q) - 1;

// 12-bit (Chloe3) pattern → 24-bit
export const up12 = (p12) => {
  let p = 0;
  for (let i = 0; i < 12; i++) if ((p12 >> i) & 1) p |= 1 << (2 * i);
  return p;
};

// 24-bit → 12-bit, or null if the scale has a quarter tone
export const down24 = (p) => {
  if (p & 0xaaaaaa) return null;
  let r = 0;
  for (let i = 0; i < 12; i++) if ((p >> (2 * i)) & 1) r |= 1 << i;
  return r;
};

export const isMicro = (p) => (p & 0xaaaaaa) !== 0;

// Rotate by n quarter steps (the note n quarter steps up becomes the new root)
export const rot24 = (p, n) => {
  n = ((n % Q) + Q) % Q;
  return ((p >>> n) | (p << (Q - n))) & FULL;
};

export const bitCt = (p) => { let n = 0; while (p) { n += p & 1; p >>>= 1; } return n; };

// Quarter-step positions of the notes
export const toSteps = (p) => {
  const r = [];
  for (let i = 0; i < Q; i++) if ((p >> i) & 1) r.push(i);
  return r;
};

// Semitones above the root (fractional for quarter tones)
export const toSemis = (p) => toSteps(p).map(i => i / 2);

// Root-first 24-digit code
export const toBin = (p) => Array.from({ length: Q }, (_, i) => (p >> i) & 1).join("");

// Root-first 12-digit Chloe3 code, or null for quarter-tone scales
export const toBin12 = (p) => {
  const d = down24(p);
  return d == null ? null : Array.from({ length: 12 }, (_, i) => (d >> i) & 1).join("");
};

// Brightness: sum of note positions in semitones (Chloe3's numbers; halves for quarter tones)
export const bright = (p) => toSteps(p).reduce((s, i) => s + i, 0) / 2;

// Crowding: three notes inside one whole tone (4 quarter steps), circular.
// For 12-note scales this is exactly Chloe3's "3 consecutive semitones".
export const hasTriple = (p) => {
  const s = toSteps(p), n = s.length;
  for (let i = 0; i < n; i++) {
    const a = s[i], c = s[(i + 2) % n] + (i + 2 >= n ? Q : 0);
    if (n >= 3 && c - a <= 4) return true;
  }
  return false;
};

// Longest run of notes each a semitone apart (circular) — Chloe3's maxRun
export const maxRun = (p) => {
  let best = 0;
  for (let i = 0; i < Q; i += 1) {
    if (!((p >> i) & 1)) continue;
    let k = 1;
    while (k < 12 && ((p >> ((i + 2 * k) % Q)) & 1)) k++;
    if (k > best) best = k;
  }
  return best;
};

export const fromSteps = (steps) => steps.reduce((p, i) => p | (1 << (((i % Q) + Q) % Q)), 0);
export const fromSemis = (semis) => fromSteps(semis.map(s => Math.round(s * 2)));

// Note names for a semitone value (fractional allowed) above a root index 0..11.
// Quarter tones are named as the note above, half-flat: E½♭.
const CHROM = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const FLAT_NAME = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
export const noteName = (rootIdx, semi) => {
  const x = ((rootIdx + semi) % 12 + 12) % 12;
  if (Number.isInteger(x)) return CHROM[x];
  const up = Math.ceil(x) % 12;
  return FLAT_NAME[up] + "½♭";
};

/* ── Maqam catalogue (Arabic, 24-step teaching grid) ─────────────────────
   Quarter-step positions above the root, ascending form. Each entry seeds a
   family; the other modes come from rotation, and known rotations are named
   in MAQAM_NAMES. 12-note maqamat (Hijaz, Nahawand, Kurd, Ajam, Nikriz) are
   already in the 12-note families and are only named.
   Source to check against: maqamworld.com (Abu Shumays & Farraj). */
export const MAQAM_SEEDS = [
  { name: "Rast",  steps: [0, 4, 7, 10, 14, 18, 21] },
  { name: "Bayati", steps: [0, 3, 6, 10, 14, 16, 20] },
  { name: "Saba",  steps: [0, 3, 6, 8, 14, 16, 20] },
  { name: "Huzam", steps: [0, 3, 7, 9, 15, 17, 21] },
];

export const MAQAM_NAMES = {
  [fromSteps([0, 4, 7, 10, 14, 18, 21])]: "Rast",
  [fromSteps([0, 3, 7, 11, 14, 17, 21])]: "Sikah",
  [fromSteps([0, 3, 7, 10, 13, 17, 21])]: "Iraq",
  [fromSteps([0, 3, 6, 10, 14, 16, 20])]: "Bayati",
  [fromSteps([0, 3, 6, 8, 14, 16, 20])]: "Saba",
  [fromSteps([0, 3, 7, 9, 15, 17, 21])]: "Huzam",
  // 12-note maqamat, named on their existing patterns
  [fromSteps([0, 2, 8, 10, 14, 16, 20])]: "Hijaz",
  [fromSteps([0, 4, 6, 10, 14, 16, 22])]: "Nahawand",
  [fromSteps([0, 2, 6, 10, 14, 16, 20])]: "Kurd",
  [fromSteps([0, 4, 8, 10, 14, 18, 22])]: "Ajam",
  [fromSteps([0, 4, 6, 12, 14, 18, 20])]: "Nikriz",
};
