// Chloe4 scale core. Every scale is, at bottom, a list of pitches in cents above
// its root. Two kinds of pattern number carry that:
//   • grid patterns (≤ FULL): 24 bits, one per quarter tone (below);
//   • exact patterns (> FULL): a stable ID for a list of cents stored in EXACT
//     (Turkish makam, and any tuning that isn't on the quarter-tone grid).
// Everything else (brightness, notes, names, the wheel) reads pitches through
// centsOf/toSemis, so both kinds behave the same. Exact scales also keep their
// nearest 24-step shape (approx) for comparisons that count shared notes.
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
  if (p > FULL || (p & 0xaaaaaa)) return null;
  let r = 0;
  for (let i = 0; i < 12; i++) if ((p >> (2 * i)) & 1) r |= 1 << i;
  return r;
};

export const isMicro = (p) => p > FULL || (p & 0xaaaaaa) !== 0;
export const isExact = (p) => p > FULL;

/* ── Exact-pitch scales: stored in cents ──────────────────────────────────
   fromCents(list, system) → a stable pattern ID made from the pitches
   themselves (an FNV hash of the cents, rounded to 0.01), so the same scale
   gets the same ID every session: favourites, likes and saved moments keep
   pointing at it. system says how to show it: "53" (Turkish commas) or "cents". */
const EXACT = new Map();
const hashId = (key, salt) => {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return FULL + 1 + ((h >>> 0) % (0x7fffffff - FULL - 1));
};
export const fromCents = (cents, system = "cents") => {
  const c = [...new Set(cents.map(x => Math.round((((x % 1200) + 1200) % 1200) * 100) / 100))].sort((a, b) => a - b);
  if (c[0] !== 0) c.unshift(0);
  const key = c.join(",");
  for (let salt = 0; ; salt++) {   // a hash collision (vanishingly rare) moves to the next salt
    const id = hashId(key, salt), e = EXACT.get(id);
    if (!e) { EXACT.set(id, { key, cents: c, system, approx: fromSteps(c.map(x => Math.round(x / 50))) }); return id; }
    if (e.key === key) return id;
  }
};
export const systemOf = (p) => p > FULL ? EXACT.get(p).system : (p & 0xaaaaaa) ? "24" : "12";
// Nearest 24-step shape: the pattern itself for grid scales
export const approx = (p) => p > FULL ? EXACT.get(p).approx : p;
// Notes that differ / are shared between two scales (by nearest 24-step shape)
export const noteDist = (a, b) => bitCt(approx(a) ^ approx(b));
export const sharedNotes = (a, b) => bitCt(approx(a) & approx(b));
// Rotate an exact scale: the note at index k becomes the new root
export const rotCents = (cents, k) => cents.map(x => ((x - cents[k]) % 1200 + 1200) % 1200).sort((a, b) => a - b);

// Rotate by n quarter steps (the note n quarter steps up becomes the new root)
export const rot24 = (p, n) => {
  n = ((n % Q) + Q) % Q;
  return ((p >>> n) | (p << (Q - n))) & FULL;
};

export const bitCt = (p) => { p = approx(p) & FULL; let n = 0; while (p) { n += p & 1; p >>>= 1; } return n; };

// Quarter-step positions of the notes
export const toSteps = (p) => {
  p = approx(p);
  const r = [];
  for (let i = 0; i < Q; i++) if ((p >> i) & 1) r.push(i);
  return r;
};

// Pitches above the root in cents, and in semitones (fractional off the semitone grid)
export const centsOf = (p) => p > FULL ? EXACT.get(p).cents.slice() : toSteps(p).map(i => i * 50);
export const toSemis = (p) => centsOf(p).map(c => c / 100);

// Root-first 24-digit code
export const toBin = (p) => p > FULL ? exactCode(p) : Array.from({ length: Q }, (_, i) => (p >> i) & 1).join("");
// Exact scales show the steps between notes: in commas for Turkish (9·8·5…), else in cents
const exactCode = (p) => {
  const { cents: c, system } = EXACT.get(p);
  const steps = c.map((x, i) => (c[i + 1] ?? 1200) - x);
  return steps.map(d => system === "53" ? Math.round(d * 53 / 1200) : system === "72" ? Math.round(d * 72 / 1200) : Math.round(d)).join("·");
};
// Interval labels for display: "9k" (commas), "204¢" (cents) or semitones (grid)
export const intervalLabels = (p) => {
  if (p > FULL) { const sy = EXACT.get(p).system, unit = sy === "53" ? "k" : sy === "72" ? "m" : "¢"; return exactCode(p).split("·").map(x => x + unit); }
  const s = toSemis(p); return s.slice(1).map((v, i) => v - s[i]).concat(12 - s[s.length - 1]);
};

// Root-first 12-digit Chloe3 code, or null for quarter-tone scales
export const toBin12 = (p) => {
  const d = down24(p);
  return d == null ? null : Array.from({ length: 12 }, (_, i) => (d >> i) & 1).join("");
};

// Brightness: sum of note positions in semitones (Chloe3's numbers; halves for quarter tones)
export const bright = (p) => +(centsOf(p).reduce((a, b) => a + b, 0) / 100).toFixed(1);

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
  p = approx(p);
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
// system: "53" names off-grid notes in commas (B⁻¹); "cents" in cents (E−14¢)
export const noteName = (rootIdx, semi, system = "53") => {
  const x = ((rootIdx + semi) % 12 + 12) % 12;
  if (Number.isInteger(x)) return CHROM[x];
  if (Number.isInteger(x * 2)) {
    const up = Math.ceil(x) % 12;
    if (CHROM[up].length === 1) return CHROM[up] + "½♭";
    return CHROM[Math.floor(x)] + "½♯";
  }
  // Off the quarter-tone grid: nearest semitone, then cents (E−14¢) or Turkish commas (B⁻¹)
  const n = Math.round(x);
  if (system !== "53") { const c = Math.round((x - n) * 100); return CHROM[n % 12] + (c ? (c < 0 ? "−" : "+") + Math.abs(c) + "¢" : ""); }
  const k = Math.round((x - n) * 53 / 12);
  const sup = String(Math.abs(k)).split("").map(d => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]).join("");
  return CHROM[n % 12] + (k ? (k < 0 ? "⁻" : "⁺") + sup : "");
};

/* ── Turkish makam: exact pitches, 53 commas per octave (Arel-Ezgi-Uzdilek) ──
   A whole tone is 9 commas. Interval names: B bakiye 4, S küçük mücennep 5,
   K büyük mücennep 8, T tanini 9, A artık ikili 12. These scales are stored
   as exact pitches in cents (fromCents, system "53"), not on the 24-step grid. */
export const COMMA = 12 / 53;   // in semitones (about 22.6 cents)
// Pattern for a set of comma positions above the root (0 first): stored as cents
export const turkPattern = (pos) => fromCents(pos.map(k => k * 1200 / 53), "53");
export const isTurk = (p) => p > FULL && EXACT.get(p).system === "53";
const cum = (iv) => iv.slice(0, -1).reduce((a, x) => [...a, a[a.length - 1] + x], [0]);
// Seeds as steps in commas (each sums to 53). Rotations give the other makams.
export const TURK_SEEDS = [
  { name: "Rast", iv: [9, 8, 5, 9, 9, 8, 5] },          // Rast pentachord + Rast tetrachord on Neva
  { name: "Uşşak", iv: [8, 5, 9, 9, 4, 9, 9] },         // Uşşak tetrachord + Bûselik pentachord on Neva
  { name: "Hicaz", iv: [5, 12, 5, 9, 8, 5, 9] },        // Hicaz tetrachord + Rast pentachord on Neva
  { name: "Bûselik", iv: [9, 4, 9, 9, 4, 9, 9] },       // Bûselik pentachord + Kürdî tetrachord on Hüseynî
].map(sd => ({ ...sd, pos: cum(sd.iv) }));
// Rotate in whole commas (not rounded cents), so a rotation gets exactly the same
// pitches, and so the same ID, as the makam written straight from its commas
const rotPos = (pos, k) => pos.map(x => ((x - pos[k]) % 53 + 53) % 53).sort((a, b) => a - b);
export const turkRotations = (pos) => pos.map((_, k) => turkPattern(rotPos(pos, k)));
// Named makams by their steps in commas
export const TURK_NAMES = [
  [[9, 8, 5, 9, 9, 8, 5], "Rast"],
  [[8, 5, 9, 9, 8, 5, 9], "Hüseynî"],                    // Rast's notes seen from Dügah (A)
  [[8, 5, 9, 9, 4, 9, 9], "Uşşak"],
  [[5, 12, 5, 9, 8, 5, 9], "Hicaz"],
  [[9, 4, 9, 9, 4, 9, 9], "Bûselik"],
  [[4, 9, 9, 9, 4, 9, 9], "Kürdî"],
  [[9, 8, 5, 9, 9, 4, 9], "Rast (descending)"],          // the leading tone drops 4 commas to Acem (F)
].map(([iv, name]) => [turkPattern(cum(iv)), name]);

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
  // Shur with its lowered 5th (D½♭); its rotations give Afshari (on C) for the Shur journey
  { name: "Shur (lowered 5th)", steps: [0, 3, 6, 10, 13, 16, 20] },
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
  [[0, 3, 6, 10, 13, 16, 20], "Shur (lowered 5th)"],
  [[0, 3, 6, 10, 14, 17, 20], "Afshari"],
  [[0, 2, 6, 10, 13, 16, 20], "Dashti"],
  [[0, 4, 8, 10, 14, 18, 21], "Bayat-e Tork"],
  [[0, 3, 7, 11, 13, 17, 21], "Abu Ata"],                // Shur's notes from its 2nd, A½♭ (Shur on G)
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
  { at: 0.20, name: "Homayun", steps: [0, 3, 8, 10, 14, 16, 20] },
  { at: 0.44, name: "Segah", steps: [0, 3, 7, 11, 14, 17, 21] },
  { at: 0.58, name: "Chahargah", steps: [0, 3, 8, 10, 14, 17, 22] },
  { at: 0.70, name: "Mahur", steps: [0, 4, 8, 10, 14, 18, 22] },
  { at: 0.82, name: "Homayun", steps: [0, 3, 8, 10, 14, 16, 20] },
  { at: 0.90, name: "Shur", steps: [0, 3, 6, 10, 14, 16, 20] },
];
/* ── Shur journey: inside one dastgah, the way a performance moves ──
   Shur's pitch set stays put (on G: G A½♭ B♭ C D E♭ F) and the finalis
   (home note) moves, per Encyclopaedia Iranica: Bayat-e Tork on B♭ (3rd),
   Afshari on C (4th, with D lowered to D½♭), Dashti on D (5th, with its A½♭).
   shift = semitones from Shur's tonic to the station's finalis; Chloe moves
   its key there so the notes themselves stay the same. Each station's steps
   are the pitch set seen from its own finalis. The finalis climbs G → B♭ → C
   → D, then the forud brings it home to G with Shur's lowered 5th (D½♭).
   Abu Ata (finalis A½♭, shift 1.5) comes first, as in the radif's order:
   Chloe's key sits on the quarter tone (key in cents). */
export const SHUR_PATH = [
  { at: 0.00, name: "Shur", shift: 0, steps: [0, 3, 6, 10, 14, 16, 20] },
  { at: 0.16, name: "Abu Ata", shift: 1.5, steps: [0, 3, 7, 11, 13, 17, 21] },
  { at: 0.32, name: "Bayat-e Tork", shift: 3, steps: [0, 4, 8, 10, 14, 18, 21] },
  { at: 0.48, name: "Afshari", shift: 5, steps: [0, 3, 6, 10, 14, 17, 20] },
  { at: 0.64, name: "Dashti", shift: 7, steps: [0, 2, 6, 10, 13, 16, 20] },
  { at: 0.82, name: "Shur", shift: 0, steps: [0, 3, 6, 10, 13, 16, 20] },
];

/* Moving within the dastgah. In Shur's family the 5th of Shur (D, with Shur on G)
   is a variable note (moteghayyer) that alternates with a lowered D½♭ (Iranica);
   Dashti also alternates its A½♭ with A (microtonaltheory.com, "D Eb F G (A | Ad)
   Bb C D"). Each Shur-journey station leans briefly into the other version. Shur's
   5th sits at quarter-step 14 (D) / 13 (D½♭) above Shur's tonic; seen from a
   station whose home note is `shift` semitones up, that's 14 − 2·shift (mod 24). */
const toggleStep = (steps, a, b) => {
  const m = x => ((x % 24) + 24) % 24, A = m(a), B = m(b);
  return steps.map(x => x === A ? B : x === B ? A : x).sort((u, v) => u - v);
};
const shurVariant = (st) => toggleStep(st.steps, 14 - 2 * st.shift, 13 - 2 * st.shift);
for (const st of SHUR_PATH) {
  // (not where Shur's 5th IS the home note, as in Dashti: that would move the home note itself)
  st.related = ((14 - 2 * st.shift) % 24 + 24) % 24 === 0 ? [] : [fromSteps(shurVariant(st))];
  if (st.name === "Dashti") st.related.push(fromSteps(toggleStep(st.steps, 13, 14)));   // its A½♭ ↔ A
}
// Persia tour: Shur stations alternate the same variable 5th; the others lean briefly
// toward the stop before or after them on the tour (Chloe's own touch, like the tour itself)
PERSIAN_PATH.forEach((st, i) => {
  if (st.name === "Shur") st.related = [fromSteps(toggleStep(st.steps, 14, 13))];
  else st.related = [PERSIAN_PATH[i - 1], PERSIAN_PATH[i + 1]].filter(x => x && x.name !== st.name).map(x => fromSteps(x.steps));
});

export const persianStation = (f, path = PERSIAN_PATH) => {
  let st = path[0];
  for (const s of path) if (f >= s.at) st = s;
  return { ...st, pat: st.pat ?? fromSteps(st.steps) };
};

/* ── Turkish journey (makam): a seyir-like path around Rast ──
   Rast on its tonic (G, Rast perde), then the home note moves up a whole tone to
   Dügah (A): Hüseynî (Rast's own notes seen from A), Uşşak (the 6th drops to
   F), Hicaz (the augmented second, the peak), back through Uşşak, then home to
   Rast. Chloe's key moves exactly 2 semitones (200 cents) for the A stations;
   a Turkish whole tone is 9 commas (204 cents), 4 cents wider: too small to hear.
   usul = the darbuka cycle for that section (the "makam" beat): Düyek at home,
   Sofyan, Semai, then Aksak (9/8) for the Hicaz peak, Curcuna (10/8) on the way down. */
const tp = (iv) => turkPattern(cum(iv));
// related: makams on the same home note that a section visits briefly and returns
// from, the way a taksim leans into a neighbour (one or two notes change, the key
// doesn't): Rast ↔ Rast descending (leading tone drops 4 commas to F), Hüseynî ↔
// Uşşak (the 6th), Uşşak ↔ Hüseynî / Kürdî (the 6th / the 2nd down a bakiye),
// Hicaz ↔ Uşşak.
// Dügah is 9 commas above Rast (203.8¢, not the piano's 200), and with the key
// in cents the home note moves exactly there, so Rast's own pitches stay put
const DUGAH = 9 * COMMA;
const T = {
  rast: tp([9, 8, 5, 9, 9, 8, 5]), rastDesc: tp([9, 8, 5, 9, 9, 4, 9]), huseyni: tp([8, 5, 9, 9, 8, 5, 9]),
  ussak: tp([8, 5, 9, 9, 4, 9, 9]), hicaz: tp([5, 12, 5, 9, 8, 5, 9]), kurdi: tp([4, 9, 9, 9, 4, 9, 9]),
};
export const TURK_PATH = [
  { at: 0.00, name: "Rast", shift: 0, usul: "duyek", pat: T.rast, related: [T.rastDesc] },
  { at: 0.20, name: "Hüseynî", shift: DUGAH, usul: "sofyan", pat: T.huseyni, related: [T.ussak] },
  { at: 0.38, name: "Uşşak", shift: DUGAH, usul: "semai", pat: T.ussak, related: [T.huseyni, T.kurdi] },
  { at: 0.56, name: "Hicaz", shift: DUGAH, usul: "aksak", pat: T.hicaz, related: [T.ussak] },
  { at: 0.76, name: "Uşşak", shift: DUGAH, usul: "curcuna", pat: T.ussak, related: [T.huseyni, T.kurdi] },
  { at: 0.88, name: "Rast", shift: 0, usul: "duyek", pat: T.rast, related: [T.rastDesc] },
];

/* ── Real intonation: scales that exist only in cents ─────────────────────
   Pitches from pure frequency ratios or published measurements, not from any
   grid. cents(r) = 1200·log2(r). Each seed is rotated into its modes.
   Sources: just and Pythagorean tunings and the harmonic series are exact by
   definition; Persian Shur as measured by Abdoli, quoted on
   microtonaltheory.com ("Persian Dastgahs"). */
const rc = (n, d) => 1200 * Math.log2(n / d);
const MODE_NAMES = ["Ionian", "Dorian", "Phrygian", "Lydian", "Mixolydian", "Aeolian", "Locrian"];
export const REAL_SEEDS = [
  { name: "Just major (= Ionian, tuning just)", tag: "Just", modes: MODE_NAMES,   // note for note the TUNING switch on Ionian; its modes keep C-major tuning (wolf 5ths)
    cents: [[1, 1], [9, 8], [5, 4], [4, 3], [3, 2], [5, 3], [15, 8]].map(([n, d]) => rc(n, d)) },
  { name: "Pythagorean major", tag: "Pythagorean", modes: MODE_NAMES,
    cents: [[1, 1], [9, 8], [81, 64], [4, 3], [3, 2], [27, 16], [243, 128]].map(([n, d]) => rc(n, d)) },
  { name: "Overtone scale (harmonics 8–14)", tag: "Overtone", modes: null,
    cents: [8, 9, 10, 11, 12, 13, 14].map(h => rc(h, 8)) },
  { name: "Shur, as played (Abdoli)", tag: "Shur", modes: null,
    cents: [0, 149, 300, 500, 702, 783, 985] },
  // Chinese, from a chain of pure fifths (the sanfen sunyi method): the five
  // notes gong shang jue zhi yu are 5 neighbouring fifths; the old heptatonic
  // adds bianzhi (the raised 4th) and biangong (the 7th), 7 neighbouring fifths
  { name: "Chinese pentatonic (Pythagorean, gong)", tag: "Chinese pentatonic", modes: ["gong", "shang", "jue", "zhi", "yu"],
    cents: [[1, 1], [9, 8], [81, 64], [3, 2], [27, 16]].map(([n, d]) => rc(n, d)) },
  { name: "Chinese heptatonic, old (gong with bianzhi and biangong)", tag: "Chinese heptatonic", modes: null,
    cents: [[1, 1], [9, 8], [81, 64], [729, 512], [3, 2], [27, 16], [243, 128]].map(([n, d]) => rc(n, d)) },
  // Javanese gamelan. No two gamelans are tuned alike (each set is tuned to itself),
  // so these are typical values, not a standard: slendro's five steps are near
  // equal (~240¢); pelog's seven are uneven (one gamelan's tuning, as commonly cited:
  // steps 120 150 270 130 115 165 250). Pelog is played in five-note groups
  // (pathet): bem on tones 1 2 3 5 6, barang on 2 3 5 6 7.
  { name: "Slendro (gamelan, typical)", tag: "Slendro", modes: null, cents: [0, 231, 474, 717, 955] },
  { name: "Pelog (gamelan, one typical tuning)", tag: "Pelog", modes: null, cents: [0, 120, 270, 540, 670, 785, 950] },
  { name: "Pelog bem (tones 1 2 3 5 6)", tag: "Pelog bem", modes: null, cents: [0, 120, 270, 670, 785] },
  { name: "Pelog barang (tones 2 3 5 6 7)", tag: "Pelog barang", modes: null, cents: [0, 150, 550, 665, 830] },
].map(sd => ({ ...sd, id: fromCents(sd.cents, "cents") }));
export const GAMELAN = Object.fromEntries(["Slendro", "Pelog", "Pelog bem", "Pelog barang"].map(t => [t, REAL_SEEDS.find(sd => sd.tag === t).id]));
// Names for every mode of the real-intonation seeds
export const REAL_NAMES = [];
for (const sd of REAL_SEEDS) {
  const c = centsOf(sd.id);
  c.forEach((_, k) => {
    const id = fromCents(rotCents(c, k), "cents");
    const name = k === 0 ? sd.name : sd.modes ? `${sd.tag} ${sd.modes[k]}` : null;
    if (name) REAL_NAMES.push([id, name]);
  });
}
export const CHINESE_PENTA = REAL_SEEDS.find(sd => sd.tag === "Chinese pentatonic").id;
export const CHINESE_HEPTA = REAL_SEEDS.find(sd => sd.tag === "Chinese heptatonic").id;
// A pure fifth in cents. Stacked fifths never close the octave: 12 miss by
// 23.46¢ (the Pythagorean comma), 53 by only 3.62¢ (Jing Fang, 1st century BC),
// and Qian Lezhi (5th century AD) carried the chain on to 360, one per day of
// the year, his neighbouring pitches only 1.8-3.6¢ apart.
export const FIFTH = 1200 * Math.log2(3 / 2);
export const SPIRAL_MOVES = 53, SPIRAL_MAX = 360;
// The spiral journey's station: move k (0-based), the key k pure fifths above
// home (shift in semitones, never folded, so the drift stays), the pentatonic
// on it, leaning now and then into the heptatonic with its two changing tones
export const spiralStation = (k) => ({ k, pat: CHINESE_PENTA, shift: k * FIFTH / 100, related: [CHINESE_HEPTA] });
export const realRotations = (id) => { const c = centsOf(id); return c.map((_, k) => fromCents(rotCents(c, k), "cents")); };

/* ── Resolution: how finely the octave is divided when notes are played ──
   Every pitch is rounded to the nearest of n equal steps per octave (n-EDO).
   12 = piano, 24 = quarter tones, 53 = Turkish commas (and near-pure just
   intervals), 1200 = cents, i.e. exact. Brightness and the scale list stay on
   the exact cents; only what you hear and see on the wheel is rounded. */
export const RES_MIN = 12, RES_MAX = 1200;
export const quantize = (semi, n) => n >= RES_MAX ? semi : Math.round(semi * n / 12) * 12 / n;
export const quantizeCents = (c, n) => n >= RES_MAX ? c : Math.round(c * n / 1200) * 1200 / n;
// Named stops on the slider
export const RES_STOPS = [[12, "piano"], [24, "quarter tones"], [31, "Huygens"], [41, ""], [53, "Turkish commas"], [72, "Byzantine"], [1200, "cents (exact)"]];
// Log-scaled slider position (0..1) ↔ n
export const resToPos = (n) => Math.log(n / RES_MIN) / Math.log(RES_MAX / RES_MIN);
export const posToRes = (x) => Math.round(RES_MIN * (RES_MAX / RES_MIN) ** x);

/* ── Byzantine chant: 72 moria per octave ──────────────────────────────────
   The Patriarchal Music Committee (Constantinople, 1881) divided the octave
   into 72 moria (1 morion ≈ 16.7¢). Genera as tetrachords in moria:
   diatonic 12·10·8 (confirmed in sources: "the major, minor and small
   intervals ... 12, 10 and 8 moria"); soft chromatic 8·14·8 and hard chromatic
   6·20·4 (the commonly taught Committee values; not yet checked against a
   primary source). Two tetrachords joined by a 12-moria tone fill the octave.
   Stored as exact cents (system "72"); codes and intervals show moria.
   Notes Ni Pa Vou Ga Di Ke Zo ≈ C D E F G A B. */
export const byzPattern = (pos) => fromCents(pos.map(m => m * 1200 / 72), "72");
export const isByz = (p) => p > FULL && EXACT.get(p).system === "72";
const BYZ_ROT = (pos, k) => pos.map(x => ((x - pos[k]) % 72 + 72) % 72).sort((a, b) => a - b);
export const byzRotations = (pos) => pos.map((_, k) => byzPattern(BYZ_ROT(pos, k)));
export const BYZ_SEEDS = [
  { name: "Diatonic (from Ni)", iv: [12, 10, 8, 12, 12, 10, 8] },
  { name: "Soft chromatic (from Di)", iv: [8, 14, 8, 12, 8, 14, 8] },
  { name: "Hard chromatic (from Pa)", iv: [6, 20, 4, 12, 6, 20, 4] },
  // Zo lowered 4 moria (an attraction toward Ke on the way down), for moving within the mode
  { name: "Diatonic, Zo lowered (from Ni)", iv: [12, 10, 8, 12, 12, 6, 12] },
].map(sd => ({ ...sd, pos: cum(sd.iv) }));
const bp = (iv) => byzPattern(cum(iv));
export const BYZ_NAMES = [
  [bp([12, 10, 8, 12, 12, 10, 8]), "Plagal 4th (diatonic, on Ni)"],
  [bp([10, 8, 12, 12, 10, 8, 12]), "First mode (diatonic, on Pa)"],
  [bp([8, 12, 12, 10, 8, 12, 10]), "Diatonic on Vou"],
  [bp([12, 12, 10, 8, 12, 10, 8]), "Diatonic on Ga"],
  [bp([12, 10, 8, 12, 10, 8, 12]), "Fourth mode (diatonic, on Di)"],
  [bp([8, 14, 8, 12, 8, 14, 8]), "Second mode (soft chromatic, on Di)"],
  [bp([6, 20, 4, 12, 6, 20, 4]), "Plagal 2nd (hard chromatic, on Pa)"],
  [bp([12, 10, 8, 12, 12, 6, 12]), "Plagal 4th, Zo lowered"],
  [bp([10, 8, 12, 12, 6, 12, 12]), "First mode, Zo lowered"],
];
/* Byzantine journey: around the modes of the Octoechos, the home note moving as
   the modes' bases do (shift = semitones above Ni; Pa = 12 moria = 200¢ exactly,
   Di = 42 moria = 700¢ exactly, so the key moves land on the true pitches).
   Plagal 4th on Ni → First mode on Pa → Second mode (soft chromatic) on Di →
   Plagal 2nd (hard chromatic) on Pa, the peak → First mode → home to Ni.
   Chant is a solo voice over the ison (a held drone on the base note). */
// related (moving within the mode, on the same base note): First mode ↔ Plagal 2nd
// (the hard-chromatic phthora nenano on Pa) and ↔ Zo lowered (attraction);
// Plagal 2nd → First mode; Second mode ↔ Fourth mode (both on Di); Plagal 4th ↔ Zo lowered.
const B = {
  pl4: bp([12, 10, 8, 12, 12, 10, 8]), pl4zo: bp([12, 10, 8, 12, 12, 6, 12]),
  first: bp([10, 8, 12, 12, 10, 8, 12]), firstzo: bp([10, 8, 12, 12, 6, 12, 12]),
  second: bp([8, 14, 8, 12, 8, 14, 8]), fourth: bp([12, 10, 8, 12, 10, 8, 12]), pl2: bp([6, 20, 4, 12, 6, 20, 4]),
};
export const BYZ_PATH = [
  { at: 0.00, name: "Plagal 4th", shift: 0, pat: B.pl4, related: [B.pl4zo] },
  { at: 0.18, name: "First mode", shift: 2, pat: B.first, related: [B.pl2, B.firstzo] },
  { at: 0.38, name: "Second mode", shift: 7, pat: B.second, related: [B.fourth] },
  { at: 0.58, name: "Plagal 2nd", shift: 2, pat: B.pl2, related: [B.first] },
  { at: 0.78, name: "First mode", shift: 2, pat: B.first, related: [B.pl2, B.firstzo] },
  { at: 0.90, name: "Plagal 4th", shift: 0, pat: B.pl4, related: [B.pl4zo] },
];
