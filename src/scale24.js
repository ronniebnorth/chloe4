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
// Quarter tones: half-flat of the note above when that's a natural (E½♭, B½♭),
// otherwise half-sharp of the natural below (C½♯, F½♯).
const CHROM = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
export const noteName = (rootIdx, semi) => {
  const x = ((rootIdx + semi) % 12 + 12) % 12;
  if (Number.isInteger(x)) return CHROM[x];
  const up = Math.ceil(x) % 12;
  if (CHROM[up].length === 1) return CHROM[up] + "½♭";
  return CHROM[Math.floor(x)] + "½♯";
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
  // Persian dastgah (Vaziri's 24-quarter-tone approximation; koron = half-flat).
  // Shur shares Bayati's notes, Segah = Sikah, Mahur = Ionian: those are named, not seeded.
  { name: "Chahargah", steps: [0, 3, 8, 10, 14, 17, 22] },
  { name: "Homayun", steps: [0, 3, 8, 10, 14, 16, 20] },
  { name: "Afshari", steps: [0, 3, 6, 10, 13, 16, 20] },
];

// Test scale: notes a quarter tone apart, to hear how they rub (C, C½♯, D, G).
// Lives in the outside group; auto mode never picks it.
export const QUARTER_TEST = fromSteps([0, 1, 4, 14]);

// Names by pattern. A pattern with more than one name (Bayati = Shur) gets them
// all, joined with " · ", so each one searches.
const NAME_LIST = [
  [QUARTER_TEST, "Quarter-tone test"],
  [[0, 4, 7, 10, 14, 18, 21], "Rast"],
  [[0, 3, 7, 11, 14, 17, 21], "Sikah"],
  [[0, 3, 7, 11, 14, 17, 21], "Segah"],
  [[0, 3, 7, 10, 13, 17, 21], "Iraq"],
  [[0, 3, 6, 10, 14, 16, 20], "Bayati"],
  [[0, 3, 6, 10, 14, 16, 20], "Shur"],
  [[0, 3, 6, 8, 14, 16, 20], "Saba"],
  [[0, 3, 7, 9, 15, 17, 21], "Huzam"],
  [[0, 3, 8, 10, 14, 17, 22], "Chahargah"],
  [[0, 3, 8, 10, 14, 16, 20], "Homayun"],
  [[0, 3, 6, 10, 13, 16, 20], "Afshari"],
  // 12-note maqamat and dastgah, named on their existing patterns
  [[0, 2, 8, 10, 14, 16, 20], "Hijaz"],
  [[0, 4, 6, 10, 14, 16, 22], "Nahawand"],
  [[0, 2, 6, 10, 14, 16, 20], "Kurd"],
  [[0, 4, 8, 10, 14, 18, 22], "Ajam"],
  [[0, 4, 8, 10, 14, 18, 22], "Mahur"],
  [[0, 4, 6, 12, 14, 18, 20], "Nikriz"],
];
export const MAQAM_NAMES = {};
for (const [st, name] of NAME_LIST) {
  const k = typeof st === "number" ? st : fromSteps(st);
  MAQAM_NAMES[k] = MAQAM_NAMES[k] ? `${MAQAM_NAMES[k]} · ${name}` : name;
}

/* ── Persian journey: a tour of the dastgahs, shaped like a radif performance ──
   Opens on Shur (the darāmad, home), climbs through dastgahs that sit
   brighter and higher, peaks on Mahur (the owj, the high point), then comes
   back down to Shur (the forud, the return). A tour of several dastgahs is
   Chloe's own shape; a real performance stays inside one dastgah and moves
   through its gushes. Stations by journey fraction. */
export const PERSIAN_PATH = [
  { at: 0.00, name: "Shur", steps: [0, 3, 6, 10, 14, 16, 20] },
  { at: 0.16, name: "Afshari", steps: [0, 3, 6, 10, 13, 16, 20] },
  { at: 0.30, name: "Homayun", steps: [0, 3, 8, 10, 14, 16, 20] },
  { at: 0.44, name: "Segah", steps: [0, 3, 7, 11, 14, 17, 21] },
  { at: 0.58, name: "Chahargah", steps: [0, 3, 8, 10, 14, 17, 22] },
  { at: 0.70, name: "Mahur", steps: [0, 4, 8, 10, 14, 18, 22] },
  { at: 0.82, name: "Homayun", steps: [0, 3, 8, 10, 14, 16, 20] },
  { at: 0.90, name: "Shur", steps: [0, 3, 6, 10, 14, 16, 20] },
];
export const persianStation = (f) => {
  let st = PERSIAN_PATH[0];
  for (const s of PERSIAN_PATH) if (f >= s.at) st = s;
  return { ...st, pat: fromSteps(st.steps) };
};
