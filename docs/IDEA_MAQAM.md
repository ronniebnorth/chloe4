# Idea: maqam / quarter tones (maybe Chloe4) — 2026-11-08

Ronnie's idea, from a question about whether people in the Middle East would
type Chloe's binary right to left (they wouldn't: digits run left to right even
in Arabic, Hebrew and Persian text). The real barrier is the **number of
notes**, and Ronnie wants to build it now, possibly as Chloe4.

## Why Chloe3 can't do it

Chloe3's codes are 12 bits, one per Western semitone. Arabic maqam, Turkish
makam and Persian dastgah use pitches **between** the semitones. Maqam Rast's
3rd sits between major and minor; Bayati's 2nd sits between ♭2 and 2. Those
scales can't be written in 12 bits in either direction. The few that can
(Hijaz ≈ Phrygian dominant, Double Harmonic) are semitone approximations.

## The core change: 24 steps per octave

Each step is a quarter tone (50 cents). A scale becomes a 24-bit code, written
root-first as in Chloe3, so bit *i* is the note *i* quarter tones above the root.
Every Chloe3 scale still fits: double each position (a semitone = 2 quarter
steps).

## Brightness carries over, and the ladder fills in

Brightness is computed the same way: add each note's distance above the root,
counted in quarter steps, then halve it to stay on Chloe3's scale. Checked with
a script on the church modes plus four maqamat:

| Scale | Quarter-step positions | Brightness |
|---|---|---|
| Lydian | 0 4 8 12 14 18 22 | 39 |
| Ionian | 0 4 8 10 14 18 22 | 38 |
| Mixolydian | 0 4 8 10 14 18 20 | 37 |
| **Rast** | 0 4 7 10 14 18 21 | **37** |
| Dorian | 0 4 6 10 14 18 20 | 36 |
| Aeolian | 0 4 6 10 14 16 20 | 35 |
| **Hijaz** | 0 2 8 10 14 16 20 | **35** |
| **Bayati** | 0 3 6 10 14 16 20 | **34.5** |
| Phrygian | 0 2 6 10 14 16 20 | 34 |
| **Saba** | 0 3 6 8 14 16 20 | **33.5** |
| Locrian | 0 2 6 10 12 16 20 | 33 |

Rast ties Mixolydian and Hijaz ties Aeolian, so ties need a tie-break rule.
Bayati falls between Aeolian and Phrygian and Saba between Phrygian and
Locrian, so the EEG-driven brightness
movement gets half-steps on the ladder. (Rast here uses the half-flat 7th it
has going up; going down it's often a flat 7th, which gives 36.5.)

## The hard parts

1. **Enumeration blows up.** Chloe3 loops over all 4096 codes. A 24-bit rooted
   code has 2^23 ≈ 8.4 million possibilities, nearly all of them unmusical.
   Chloe4 should be built from a **catalogue**, not brute force: maqamat as
   stacks of *ajnas* (3–5 note fragments: Rast, Bayati, Hijaz, Saba, Sikah,
   Nahawand, Kurd, Ajam…). Most maqam theory works this way already.
2. **Quarter tones are an approximation too.** Real intonation varies by
   region and player. Bayati's 2nd is lower in Turkish practice, and Turkish
   theory uses 53 steps per octave. 24 steps is the standard Arabic teaching
   grid and a good first version. If needed later, store cents instead of
   bits.
3. **Maqam is more than a scale.** It has a starting jins, a characteristic
   path (sayr), notes that change going up versus down, and modulation
   between maqamat. That's a natural fit for Chloe's journeys, since
   wandering between related maqamat is how the music works anyway.
4. **Sound engine.** Web Audio can detune freely, so playback is the easy
   part. Every voice needs to accept fractional pitches (cents), not MIDI
   note numbers. Any tabla or sample voice tuned to semitones needs checking.
5. **The "no 3 consecutive semitones" rule** has to be restated for quarter
   steps (two adjacent quarter steps is common in maqam, e.g. Saba's 2-3).

## Open questions for Ronnie

- **Chloe4 or a mode in Chloe3?** A new app avoids touching a 9,200-line
  `App.jsx` that works. A mode reuses journeys, EEG brightness and the
  recorder. A middle path: start Chloe4 as a copy of Chloe3 and swap the scale
  core.
- **Which tradition first?** Arabic (24-step, ajnas) is the simplest and best
  documented starting point.
- **Sources** to check before building: maqamworld.com (Sami Abu Shumays &
  Johnny Farraj, *Inside Arabic Music*, 2019) for the ajnas/maqam catalogue
  and sayr.

## Decision — 2026-11-08: Chloe4 = full 24-step

Considered first: a smaller "12-bit skeleton + quarter-tone flags" version
for Chloe4 with the 24-step rewrite deferred to Chloe5. Ronnie's final call
the same evening: **do the full 24-step version as Chloe4**, since it's the
right design and has to be done anyway. Chloe4 lives in `~/rbn-projects/chloe4`
(a local copy of Chloe3; no GitHub repo yet).

Scope: Chloe3's 12-note assumption runs through ~260 places (playback,
just-intonation tables, colour wheel, search, Claude's catalogue, saved
favourites, helper modules `brightness.js`, `suspended.js`, `wait.js`).

### Design
- Every pattern is a 24-bit number, root-first: bit *i* = the note *i*
  quarter tones above the root. A 12-note scale is its Chloe3 pattern with
  each bit moved to an even position (`up12`).
- `toSemis` returns semitones, fractional for quarter tones (Rast's 3rd =
  3.5), so `2 ** (semi / 12)` frequency maths works unchanged.
- Brightness = sum of quarter-step positions ÷ 2, which keeps Chloe3's
  numbers (Ionian 38, Lydian 39).
- Families: 12-note families from the existing generator (lifted to 24 bits),
  plus maqam families built from a catalogue and rotated over 24 steps.
  No brute force over 2^23.
- Display shows the 24-digit code; search accepts 24-digit or Chloe3-style
  12-digit patterns.
- Pitch-class-indexed spots (just-intonation table, clash table, colour
  wheel, note names) get quarter-tone handling: equal temperament for
  half-steps, neighbour averaging, "E𝄳"-style (half-flat) labels.
- Saved favourites / localStorage: new key namespace, with a one-time
  migration of Chloe3 12-bit values.

### Build steps
1. Core helpers + catalogue, tested against the brightness table above.
2. Convert `App.jsx` scale core, families, and every pattern consumer.
3. Helper modules (`brightness.js`, `suspended.js`, `wait.js`).
4. Pitch-class-indexed spots, display, search, Claude prompt catalogue,
   storage migration.
5. Regression: every Chloe3 scale sounds and sorts the same. Then a listen
   test of Rast, Bayati, Hijaz and Saba.

## Status — 2026-11-08 (first pass done)

Done and checked:
- `src/scale24.js`: the 24-step core. Matches Chloe3 exactly on all 4,095
  12-note patterns (brightness, crowding rule, longest run, rotation, 12-digit
  code). Maqam catalogue: Rast (modes include Sikah, Iraq), Bayati, Saba,
  Huzam; 12-note maqamat named on existing scales ("Phrygian · Kurd",
  Hijaz, Nahawand, Ajam, Nikriz).
- `App.jsx`: families lifted to 24 steps, new MAQAM · QUARTER TONES sidebar
  group, journey homes and scene scale tables lifted, half-flat note names,
  quarter tones play in equal temperament inside just-intonation tunings,
  clash/tension treats a quarter tone as its rougher neighbour, search takes
  24-digit or 12-digit patterns and "maqam", in-app help updated.
- `brightness.js`, `suspended.js`, `wait.js` converted.
- Own port (5174) and base `/chloe4/`, so Chloe3's saved data never mixes in.
- Headless browser: loads with no console errors; Rast shows
  C D E½♭ F G A B½♭, intervals 2-1.5-1.5-2-2-1.5-1.5; plays 6 s with no
  errors (muted, so not yet listened to).

Still to do:
1. **Listen test** (Ronnie): Rast, Bayati, Saba, Huzam, Sikah.
2. The 12-cell note strip and the chromatic colour wheel only show semitones;
   quarter-tone notes don't light up yet.
3. Interval search with halves ("2-1.5-1.5") untested.
4. Claude prompt still describes the catalogue in 12-note terms.
5. Brightness/EEG picks can now land on maqam scales; check that this feels
   right in a journey before deciding whether maqam should be opt-in.
6. ~~Sampled instruments~~ fixed in f71cc32: smplr matches samples on whole
   MIDI notes, so notes are floored and the extra 50 cents rides on detune.
   The synth voices use frequencies directly and need no change. Listen to
   confirm.

## Idea — 2026-11-08: Persian and Turkish journeys

Ronnie's idea: *a journey for Persian and Turkish would be cool.* Both
traditions are already shaped like journeys, which fits Chloe's journey engine:

- **Persian dastgah.** A performance follows the *radif*: it opens on the
  *darāmad* (home), moves through *gushe*s (short melodic stations) that climb
  in register and shift notes, then comes back down to the home with a
  *forud* (return). Seven dastgahs (Shur, Homayun, Segah, Chahargah, Mahur,
  Rast-Panjgah, Nava) plus derived *āvāz*es (Abu Ata, Dashti, Bayat-e Tork,
  Afshari, Bayat-e Esfahan). Altered notes: *koron* (lowered) and *sori*
  (raised).
  **24 steps fits:** Ali-Naqi Vaziri proposed a 24-quarter-tone system for
  Persian music in the 1920s, so Chloe4's grid has real precedent here. Real
  koron intervals vary by player, but quarter tones are the standard
  teaching approximation.
- **Turkish makam.** A *seyir* (melodic path: ascending, descending, or
  both) plus *taksim* improvisation that visits related makams and returns.
  **24 steps is a poor fit:** Turkish theory (Arel-Ezgi-Uzdilek) divides the
  whole tone into 9 commas (53 per octave). Turkish Rast's 3rd is about one
  comma flat of a natural E, not a quarter tone, and Uşşak's 2nd sits lower
  than Arabic Bayati's. Quarter tones would make Turkish makams sound
  Arabic. Doing Turkish right needs pitches in cents (or 53 steps), which
  is the Chloe5 direction.

Suggested order: **Persian journey first** (works on the current 24-step
grid: add the dastgah scales as catalogue seeds, then a journey that starts
on the darāmad, climbs through gushes and does a forud home). Turkish after
Chloe gains finer pitch, or as an openly labelled 24-step approximation.

## Persian journey — built 2026-11-08

- Dastgah scales added (24-step, Vaziri-style; koron = half-flat):
  Chahargah, Homayun and Afshari are new families in the MAQAM · DASTGAH
  group; Shur is named on Bayati's pattern, Segah on Sikah's, Mahur on
  Ionian's. Names with several labels show all of them ("Bayati · Shur").
- Journey **persia** (`JOURNEYS.persia`, path in `PERSIAN_PATH` in
  `scale24.js`): Shur (darāmad, home) → Afshari → Homayun → Segah →
  Chahargah → Mahur (owj, the peak, ~70%) → Homayun → Shur (forud) from 90%.
  Scales come from the path, not brightness; the journey curve only draws
  the climb. 72 BPM, tempo lifts a little toward the peak, reverb dries a
  little. Santur (dulcimer) and kamancheh (fiddle) take turns every 24–48
  notes. No automatic key changes (one tonic, as in a performance); no
  outside scales.
- Honest framing: touring several dastgahs is Chloe's own shape. A real
  performance stays inside one dastgah and moves through its gushes. A
  single-dastgah journey (e.g. Shur with its āvāzes Dashti, Abu Ata,
  Bayat-e Tork) is a possible next version once those gushes' notes are
  checked against a source.
- Checked headless: the journey starts on Shur, plays, no console errors.
  Not yet listened to.

## Shur journey — built 2026-11-08

- Journey **shur** (`JOURNEYS.shur`, path `SHUR_PATH` in `scale24.js`): one
  dastgah, the way a performance moves. Shur's notes stay the same and the
  finalis (home note) climbs, with Chloe's key following it: Shur on the
  tonic → Bayat-e Tork on the 3rd (20%) → Afshari on the 4th, with the 5th
  lowered (40%) → Dashti on the 5th (60%) → forud home to Shur with the
  lowered 5th (82%). 66 BPM, santur/kamancheh, no outside scales, no random
  key changes.
- Sources: Encyclopaedia Iranica via microtonaltheory.com (Shur pitch set
  G A½♭ B♭ C D E♭ F, finalis per avaz); fis-iran.org (avaz spellings, D(p)
  in Afshari/Dashti). Sources disagree on some finales (Abu Ata, Tork);
  Iranica's were used.
- **Abu Ata left out:** its finalis is A½♭, and Chloe's key can't sit on a
  quarter tone. Adding a quarter-tone key offset would allow it.
- Fix to the persia tour: its "Afshari" station (Shur with a lowered 5th on
  the same tonic) was mislabelled, since Afshari's home is the 4th. Removed from the
  tour; that pattern is now named "Shur (lowered 5th)".
- Checked headless with the clock fast-forwarded (Shur on C): C D½♭ E♭ F G
  A♭ B♭ → key E♭ Bayat-e Tork → key F Afshari (G½♭) → key G Dashti → key C
  Shur with G½♭. Same notes throughout, as intended. No console errors. Not yet
  listened to.

## Backlog — ideas parked 2026-11-08 (come back to these)

Gathered from the session that built Chloe4. Nothing here is started.

**First**
- **Listen test** of both journeys (live: `?view=listen&jo=persia`,
  `?view=listen&jo=shur`). Main question: do the half-flats sound like real
  Persian/Arabic music, or just out of tune?

**Pitch / engine**
- **Quarter-tone key offset.** Let Chloe's key sit on a quarter tone. This
  unlocks Abu Ata in the Shur journey (finalis A½♭) and Segah/Sikah on their
  own koron tonic. Touches the drone, `noteFreq`, the root-note buttons and
  the wheel labels.
- **Turkish makam.** Needs finer pitch than quarter tones (53 steps per
  octave, or pitches stored in cents); in 24 steps it sounds Arabic. Either
  that engine change (the old "Chloe5" direction) or an openly labelled
  24-step approximation.
- **Brightness tie-break.** Rast ties Mixolydian (37), Hijaz ties Aeolian
  (35); pick a rule for equal brightness.
- **Should brightness/EEG picks land on maqam scales?** Currently they can.
  Try it in a normal journey and decide whether maqam should be opt-in.

**Display / search**
- The 12-cell note strip and the piano still show semitones only;
  quarter-tone notes don't light up (the wheel does).
- Interval search with halves ("2-1.5-1.5") is untested.
- Search options from the Chloe3 discussion: short binary fragments that only
  match from the root, and a full pattern that shows just that mode, not
  the whole family.

**Claude / docs**
- The Claude prompt still describes the catalogue in 12-note terms (no
  mention of maqam, quarter tones, or the 24-step codes).
- README and `package.json` still say Chloe3; give the Chloe4 repo its own
  README intro and link.
- Chloe3's copy of this doc (`chloe3/docs/IDEA_MAQAM.md`, commit ca2e389) is
  committed but never pushed, and is now older than this one.

**More music**
- **More maqamat:** Kurd/Nahawand variants, Sikah Baladi, Jiharkah,
  Mustaar, Rahat al-Arwah. Check each against maqamworld.com.
- **More dastgah:** Nava, Rast-Panjgah, Bayat-e Esfahan (under Homayun),
  Bayat-e Kord. Check against Iranica / fis-iran.org.
- **More single-dastgah journeys** like Shur: Homayun → Bayat-e Esfahan,
  and journeys inside Segah and Chahargah through their gushes.
- **An Arabic maqam journey** following a *sayr* (e.g. Bayati opening, a
  turn through Saba or Hijaz, back to Bayati), built the same way.
- **Instruments/percussion for these journeys:** a tar/setar voice, ney
  (closest now: shaku), tombak or daf patterns for the beat engine.
- Optional Arabic/Persian note naming (e.g. koron/sori signs) alongside
  E½♭-style names.

**Bends — Ronnie's idea, 2026-11-08:** *"we will be able to play even
western 12 tone music, with slight bends... like guitar players do."*
- **Blue-note scales (easy, uses the 24-step grid as it is).** Blues players
  bend the ♭3 about a quarter tone up (the blue 3rd, between minor and
  major), and treat ♭7 and ♭5 the same way. Add scales such as C E½♭ F G B½♭
  (blues pentatonic with blue 3rd and 7th) and a blues hexatonic with a
  blue ♭5. Note: close to Rast's notes, which is part of why blues and
  Arabic music can sound related.
- **Bends as articulation (new playing feature).** A real bend is a pitch
  glide, not a fixed note. A "bend" setting where Chloe sometimes: curls the
  blue 3rd or ♭7 up a quarter tone at the end of the note; bends up into a
  note from a half step below; adds a small shimmer at the end of long
  notes. Works on plain 12-note scales too, so Western music sounds played
  by a guitarist. Machinery exists: steppe strings already slide into
  notes (`exponentialRampToValueAtTime` on synth voices); sampled
  instruments can bend through a detune ramp. Needs: a per-note bend
  envelope in the note player, a probability/amount control (log curve),
  and rules for which degrees bend (blue 3rd, ♭7, 4th → 5th).

## Where Chloe's resolution is headed — Ronnie, 2026-11-08

*"I'm making Chloe higher resolution."* Each step up reaches more of the
world's music, and the core idea (a scale = a root-first string of notes;
brightness = sum of note positions) carries over unchanged:

- **12 per octave** (Chloe1–3): Western music, anything on a piano.
- **24** (Chloe4): Arabic maqam, Persian dastgah (Vaziri's grid), blues
  blue notes.
- **53** (Turkish makam theory, Arel-Ezgi-Uzdilek: 9 commas per whole tone).
- **Cents** (any pitch): guitar bends, real players' intonation, any tuning.
  Chloe4's Turkish makams (below) are the first step toward that: their
  notes are stored as exact pitches, not grid positions.

## Turkish makam — built 2026-11-08

- **Exact pitches, not the 24 grid.** Turkish makams are stored as positions
  in commas (53 per octave, Arel-Ezgi-Uzdilek; whole tone = 9 commas). A
  Turkish pattern number = a tag in the high bits (`turkN << 24`) plus the
  nearest 24-step shape (used for the wheel grid, crowding and comparisons);
  `toSemis` and `bright` read the exact pitches from the `TURK` table in
  `scale24.js`. This is the first step toward pitch in cents.
- Families (sidebar group TURKISH MAKAM · 53 COMMAS), from seeds in commas:
  Rast 9·8·5·9·9·8·5 (modes incl. Hüseynî), Uşşak 8·5·9·9·4·9·9 (= Rast
  descending's notes), Hicaz 5·12·5·9·8·5·9, Bûselik 9·4·9·9·4·9·9 (modes
  incl. Kürdî). Codes shown as steps in commas; intervals as "9k - 8k …";
  notes named with comma marks (B⁻¹ = B one comma flat; segah perde).
- Journey **makam**: Rast (tonic) → Hüseynî (home moves to Dügah, +2) →
  Uşşak → Hicaz (peak) → Uşşak → Rast. 70 BPM; oud (lute) and ney (shaku)
  take turns; key holds except for the station moves.
- Sources: Wikipedia "Turkish makam" (comma sizes of B/S/K/T/A; Rast = Rast
  pentachord + Rast tetrachord on Neva; Uşşak = Uşşak tetrachord + Bûselik
  pentachord on Neva; Rast descending drops the leading tone 4 commas to
  Acem; Bûselik = Bûselik pentachord + Kürdî tetrachord). Hicaz tetrachord
  taken as S·A·S = 5·12·5 (the AEU textbook form; the Wikipedia note table
  suggests performers vary).
- Checked headless with the clock fast-forwarded (Rast on C): C D E⁻¹ F G A
  B⁻¹ → D Hüseynî (same notes) → D Uşşak (6th drops) → D Hicaz → C Rast.
  Wheel draws the comma notes at their exact angles. No console errors. Not
  yet listened to.
- Not yet: Saba, Segah, Hüzzam, Nihavend, Karcığar, Suzinak (check each
  against a source); seyir direction (ascending vs descending makams);
  makam-specific çeşni (flavour) phrases.

## Makam beat (darbuka + usul) — built 2026-11-08

- Beat style **makam**: a synthesized darbuka (`darb-dum` ~92 Hz open
  centre stroke, `darb-tek` bright rim, `darb-ka` softer other-hand rim) plus
  the daf (`frame`) on each cycle's one. One 16th per step.
- Usuls (positions in 16ths): Sofyan 4/4 (Düm – Te-ke), Düyek 8/8 (Düm tek –
  tek düm – tek –), Semai 3/4, **Aksak 9/8 (2+2+2+3)**, **Curcuna 10/8
  (3+2+2+3)**. Tension fills gaps with ka strokes, calm thins to düm/tek,
  every 4th cycle ends in a roll.
- In the makam journey each section has its usul (`usul` in `TURK_PATH`):
  Rast Düyek → Hüseynî Sofyan → Uşşak Semai → Hicaz Aksak → Uşşak Curcuna →
  Rast Düyek; the journey turns the beat on if drums are off. Elsewhere the
  usul rotates every 8 cycles. Also in the beat-wander mix.
- Usul strokes are simplified common darbuka renderings, not the full
  classical (kudüm) forms; check against a source and Ronnie's ear. Ideas:
  more usuls (Ağır Aksak, Devr-i Hindî 7/8, Türk Aksağı 5/8, Çiftetelli),
  a kudüm voice for classical pieces, a davul for folk.
- Checked headless (played aloud): the journey switches the beat on, reaches
  Hicaz/Aksak, no console errors.

## Draw journey: scale toggle — built 2026-11-08

On the Listen page, with **draw** chosen, a "scales" row picks which scales
the drawn journey may use: **all scales** (default), **western** (12-note,
plus the outside scales when that toggle is on), **maqam · dastgah**
(24-step), **turkish** (53-comma). Filters the one catalogue every pick path
reads (brightness walk, big jumps, likes, worlds, EEG). Saved in
localStorage (`chloe-draw-pool`) and in the copied link (`dp=`). Only the
draw journey uses it; other journeys still use all scales (the open
"should brightness picks land on maqam?" question stands for them).
Checked headless: with "turkish", picks stay on Turkish scales; no errors.

## Pitch stored in cents — built 2026-11-08

"Store in cents and get it done right." Every scale is now, at bottom, a
list of pitches in cents above its root (`centsOf(p)` in `scale24.js`):

- **Grid patterns** (≤ 2^24−1) are unchanged: 24 bits, one per quarter tone;
  their cents are derived (bit i = i × 50 ¢). All 4,095 Chloe3 scales verified
  identical (brightness, codes, crowding, rotation).
- **Exact patterns** (> 2^24−1): `fromCents(list, system)` stores any pitch
  list and returns a **stable ID** made from the pitches themselves (FNV hash
  of cents rounded to 0.01, salted on the vanishingly rare collision). Same
  scale, same ID every session, so favourites, likes and saved moments stay
  attached. (The first Turkish version used load-order IDs that could
  have shifted.)
- `system` says how to show it: `"53"` → steps in commas (9·8·5…), notes
  with comma marks (B⁻¹); `"cents"` → steps in cents (204·182·112…), notes
  with cent offsets (E−14¢).
- Exact scales keep their nearest 24-step shape (`approx`) for the few
  things that count shared/different notes: `noteDist`, `sharedNotes`,
  `bitCt`, suspended-scale checks, the Wait. Pitches, brightness, names,
  intervals and the wheel all read exact cents.
- Turkish makams are now `fromCents(commas × 1200/53, "53")`.
- Checked: makam journey (Rast → Hicaz) headless, no console errors; a just-
  intonation major (0 204 386 498 702 884 1088) round-trips with cents labels.

Unlocked next (backlog):
- **Real intonations** as cents scales: measured Arabic Bayati/Rast (the
  Bayati 2nd varies by region), Persian koron as players tune it (Sanati's
  thesis measured Shur/Dashti intervals), just intonation, Partch's 43.
- **Key in cents**: let the root sit anywhere (Abu Ata on A½♭, Segah on its
  koron tonic).
- The wheel labels cents scales with comma marks; pass the scale's system to
  it as the note list does.

## Real intonation scales + draw option — built 2026-11-09

- New sidebar group **REAL INTONATION · CENTS**: scales that exist only in
  cents (`REAL_SEEDS` in `scale24.js`), each rotated into its modes:
  - **Just major (= Ionian, tuning just)** (renamed 2026-11-09; identical to Ionian with the TUNING switch on just, which tunes any scale from its own root, while these modes keep one fixed C-major tuning): 1/1 9/8 5/4 4/3 3/2 5/3 15/8 (0 204 386 498 702
    884 1088); modes named Just Dorian… Just Locrian. Some modes carry the
    syntonic-comma "wolf" (Just Dorian's D–A fifth is 680¢), which is how
    just intonation really behaves.
  - **Pythagorean major**: 1/1 9/8 81/64 4/3 3/2 27/16 243/128; modes named.
  - **Overtone scale**: harmonics 8–14 (0 204 386 551 702 841 969).
  - **Shur, as played (Abdoli)**: 0 149 300 500 702 783 985, measured
    performance values quoted on microtonaltheory.com.
- Draw journey scales toggle gains **real intonation**.
- Notes and wheel labels show cent offsets (E−14¢); exact notes light their
  nearest wheel dot; long labels shrink to fit.
- Arabic measured intonation left out: the sources found (2026-11-09) were
  descriptive ("near 350¢, regional variation") without usable per-degree
  figures. Candidates to read: the 1932 Cairo Congress open dataset
  (arxiv 2506.14503, cents histograms for Egyptian bayati/rast), and Abu
  Shumays' "The Fuzzy Boundaries of Intonation in Maqam" (2009).
- Checked headless: draw + real intonation picks Just, Pythagorean and
  overtone modes; no console errors.

## Resolution slider — built 2026-11-09

Ronnie: a slider "from 12 to 1200" for how finely Chloe divides the octave.
- Studio, under TUNING: **RESOLUTION**, log-scaled 12–1200, with buttons for
  12, 24, 31, 41, 53, 72, 1200. Every played pitch is rounded to the nearest
  of n equal steps (n-EDO) inside `tunedRatio`, so all instruments and the
  orchestra follow (some percussion tuned straight from scale degrees does
  not). 1200 = exact. Brightness, scale list and journeys stay exact.
- Note names and the wheel follow what you hear; the wheel's inner ring gets a
  tick per step (a fine ring past 150). Saved (`chloe-edo`), share links
  carry `edo=`.
- Checked: maqam Rast at 12 → C D E F G A B, at 24 → E½♭ B½♭; Turkish Rast
  at 24 rounds to major (its 385¢ 3rd is nearer 400 than 350, which is why
  Turkish Rast sounds brighter than Arabic), at 53 exact; Just major at 53
  within 1¢. Headless: plays at 31 with no console errors.

## Notes-per-scale range — built 2026-11-09

- Sidebar **NOTES** from–to sliders (3–12) replace the 3–8 chips. They
  filter the list and limit Auto and journey picks (Persia/Shur/Makam paths
  keep their own scales; if nothing regular fits, the limit is ignored for
  regular picks). Saved (`chloe-note-range`), share links carry `nr=`.
- **9–12 note scales generated** as outside families (Nonatonic 9,
  Decatonic 10, Hendecatonic 11, Chromatic 12; ids `x-non-…` etc.): 8 is the
  most notes Chloe's no-3-semitones rule allows, so every denser scale has a
  cluster. With a range of only 9+ notes and outside on, Auto picks outside
  scales every time instead of one pick in three.
- World scales (maqam, Turkish, real intonation) are curated 7-note lists;
  the range just includes or excludes them.
- Checked headless: 9–12 shows the four new groups; Auto at 5–5 picks only
  5-note scales; no console errors.

## Felt brightness (A/B) — built 2026-11-09

Ronnie: brightness of a move should depend on what was just heard, held notes
weighing more, not only on the root.
- **Note memory** (`NOTE_MEM` in App.jsx): every played note adds
  min(4 s, duration) × velocity to its absolute pitch class (quarter-tone
  resolution), decaying with τ = 3 s. The drone counts as a held root
  (weight 1.5).
- **`feltShift(a, b)`**: for each note of the current scale that moves, its
  shift in semitones × its memory weight, over the total weight held. Unheard
  moves count for nothing. Checked: Ionian→Mixolydian with a held B = −0.67
  (felt darker); Ionian→Lydian with F unheard = 0 (hidden), with F held = +0.4.
- **Journey walk**: in felt mode the score adds 0.3·|f| near the target
  (prefer hidden moves) or −0.3·f·sign(gap) further off (prefer moves felt in
  the right direction). Static brightness still sets the targets and sorting.
- **A/B**: Studio BRIGHT FEEL root / felt (held notes); Listen chip "felt".
  Saved (`chloe-bright-feel`), links carry `bf=felt`. In felt mode the wheel
  glows on held notes.
- To tune by ear: τ (3 s), drone weight (1.5), the 0.3 factor, the 0.05
  "near target" threshold. Ideas: let SMOOTH use hidden moves; let EEG/override
  picks use felt too (now only the journey walk does).
- 2026-11-09 (later): A/B toggle replaced by a **slider** root 0% → felt 100%
  (the felt term is scaled by the amount; the wheel glow too) and a **random**
  switch that sets a new amount every 30–90 s (20% chance each of exactly 0 or
  1). Listen page: "felt" (on/off) and "felt ~" (random). Saved
  (`chloe-felt-amt`, `chloe-felt-random`); links carry `bf=<amount>`, `bfr=1`.
- Then: **random → wander** (Ronnie): the amount now drifts smoothly on two
  overlapping slow sine waves (4.1 and 1.7 min, random phase), updated every
  2 s, reaching both ends now and then, instead of jumping every 30–90 s.
  Button labelled "wander" (Listen: "felt ~"); same storage/link keys.
- Then: **WANDER SPEED** (¼×–4×, log; 1× ≈ a 4-minute sweep) and **WANDER
  RANGE** (5–100%; 100% = full root↔felt sweep, less = drift around where
  the slider was when wander started) sliders, shown while wander is on.
  Wave phases accumulate, so changing either mid-wander never jumps. Saved
  (`chloe-felt-wspeed`, `chloe-felt-wrange`); links carry `bfs=`, `bfw=`.
  Checked headless: 4×, 30% around 0.3 drifted 20–28% with no jumps.

## Mood: chill ↔ epic, with wander — built 2026-11-09

One slider, −1 (chill) … +1 (epic), 0 = no change (`MOOD` in App.jsx), leaning
what Auto and journeys do:
- tempo ×(1 + 0.18·m) at the melody, orchestra and beat clocks (the BPM
  shown stays the user's);
- note length ×(1 − 0.25·m);
- energy target + 0.35·m (drum fills, doubled hats, marches, orchestra);
- Auto's reverb picks − 0.15·m (journey) / − 0.2·m (free);
- Auto's sound pool: soft (space, sine, piano, triangle, duduk, felt,
  glass, kalimba) below −0.3, bold (guitar, saw, square, xylo, synlead,
  fiddle) above +0.3;
- journey walk prefers scale tension near 0.375 + 0.225·m, weighted by |m|.
Wander like bright feel (waves 4.7 / 1.9 min at 1×, speed ¼–4×, range
5–100% around the start point). Studio: MOOD row under BRIGHT FEEL
(double-click = neutral). Listen: chill / epic / mood ~. Saved; links carry
`mood=`, `mw=`, `mws=`, `mwr=`. Checked headless: labels, wander drift, Rise
journey with wander, no console errors. To tune by ear: the 0.18 tempo and
0.35 energy factors.

## Studio matches the journeys — 2026-11-09

- Instrument row: the sound actually playing (`leadNow`, from playNote) gets
  a dashed accent outline when a journey or world overrides your choice
  (Makam oud/ney, Persia santur/kamancheh, worlds); your own choice stays solid.
- Journeys raise RESOLUTION on start if it's too coarse: Makam ≥ 53,
  Persia/Shur ≥ 24 (never lowered), with a note beside the slider for 10 s.
- Checked headless: resolution 12 → Makam start → 53 with the note; lute
  dashed while the journey plays.
- 2026-11-09: the two NOTES sliders were confusing (no sign which was "fewest"
  and which "most"), so they became **number buttons 3–12 + all**: click one
  = only that size, click a second = the span between, click the single one
  again or "all" = every size. 9–12 are dimmed while outside is off.
  Checked headless: 5 → [5]; then 7 → [5 6 7]; 9 → [9]; 9 again → all.

## World scales share slider — built 2026-11-09

Natural share of non-12 scales in Auto's picks was ~1 in 10 (105 of 665
regular scales; cents scales 28 → ~1 in 35), so Ronnie hadn't seen a ± cents
note yet. **WORLD SCALES** (Studio, under MOOD): natural (default, no change)
or 0–100% of picks from the world groups; world picks choose maqam ·
dastgah / Turkish / real intonation in equal turns; a world pick skips the
outside chance. Applies to free Auto and brightness-picking journeys (not
Persia/Shur/Makam or a limited draw pool). Saved (`chloe-world-share`); links
carry `ws=`. Checked headless at 100%: Just Dorian, Just Mixolydian, a Shur-as-
played mode, a Turkish makam, Chahargah; no errors.
- Then: **world scales wander** (waves 5.3 / 2.1 min at 1×, speed ¼–4×,
  range 5–100%; full range sweeps Western-only ↔ world-only). Saved
  (`chloe-world-wander`, `-wspeed`, `-wrange`); links carry `wsw=`, `wss=`,
  `wsr=`. Checked headless: share drifted 0 → 6 → 11% at 4×.

## Orchestra wander — 2026-11-09

Ronnie: "symphonic should have a wander, so it comes and goes." Studio
SYMPHONIC row gains **wander** (the off/orchestra button for the current state
goes dashed); Listen gains "orchestra ~" (shows in / out). In for 90–240 s ×
(1 + 0.5·MOOD), out for 60–180 s × (1 − 0.4·MOOD), min 30 s. Off = no new
chords, sounding ones ring out; on = strings swell in. Saved
(`chloe-sym-wander`); links carry `syw=1`. Checked headless: link turns it on,
Listen shows "orchestra ~ out", no errors. Not yet checked: how the in/out
transitions sound (fade lengths) by ear.

## Makam journey moves within each makam + rotation ID fix — 2026-11-09

- Each section briefly visits a related makam on the same home note
  (`related` in `TURK_PATH`): about once a minute (first after 40–70 s, then
  every 40–80 s after returning), for 15–30 s. Rast ↔ Rast descending,
  Hüseynî ↔ Uşşak, Uşşak ↔ Hüseynî/Kürdî, Hicaz ↔ Uşşak. Key never moves.
- **Bug fixed:** since the cents change, Turkish family rotations were made by
  subtracting rounded cents, so some came out 0.01¢ off the same makam written
  from commas → different IDs. Hüseynî, Kürdî and Rast (descending) lost their
  sidebar names, and the makam journey's Hüseynî section fell back to random
  scales. Rotations now happen in whole commas (`rotPos`). Verified: every
  journey makam and every named makam is in a family; real-intonation names
  all match too. Headless: Rast → Rast (descending) → Rast → Hüseynî.
- Persia and Shur move within too (same visit timing). Shur journey: each
  station alternates Shur's variable 5th (moteghayyer D ↔ D½♭, Iranica), except
  Dashti whose home note it is; Dashti alternates its A½♭ ↔ A (microtonaltheory
  .com). Persia: Shur stations the same variable 5th; Homayun, Segah, Chahargah,
  Mahur lean toward the previous/next stop (Chloe's own touch, no sourced variants).
  All visit scales verified to exist in a family. Headless: Shur → Shur (lowered
  5th) → Shur → Dashti, no errors.

## Byzantine journey, 72 moria — built 2026-11-09

- Scales (`BYZ_SEEDS` in `scale24.js`, system "72", exact cents, rotated in
  whole moria): diatonic 12·10·8 (+12) per tetrachord, **confirmed** ("the
  major, minor and small intervals of the diatonic scale ... 12, 10 and 8
  moria", search 2026-11-09); soft chromatic 8·14·8 and hard chromatic 6·20·4,
  the **commonly taught Patriarchal Committee (1881) values, not yet checked
  against a primary source**. Lead: Guray & Aydın, "The soft and hard chroma of
  Chrysanthos and the Patriarchal Committee: a psychoacoustic approach".
- Named modes: Plagal 4th (Ni), First mode (Pa), Fourth mode (Di), Second mode
  (soft chromatic, Di), Plagal 2nd (hard chromatic, Pa), diatonic on Vou/Ga.
  Sidebar group BYZANTINE · 72 MORIA; intervals "12m"; draw pool "byzantine";
  part of WORLD SCALES.
- Journey **byzantine**: Plagal 4th (Ni) → First mode (Pa, +2) → Second mode
  (Di, +7) → Plagal 2nd (Pa) peak → First mode → Plagal 4th. Pa = 12 moria =
  200¢ and Di = 42 moria = 700¢ exactly, so key moves land on true pitches.
  60 BPM, duduk (voice-like) over the ison (drone on), raises RESOLUTION to ≥ 72.
- Not yet: the enharmonic genus (third mode, grave mode), attractions (notes
  bending toward their neighbours, a real feature of chant), moving within
  each mode. Checked headless: 53 → 72, all four modes, drone on, duduk.
- Byzantine moves within each mode too (same visit timing, same base note):
  First mode ↔ Plagal 2nd (hard-chromatic phthora nenano on Pa, mentioned on
  Wikipedia "Neobyzantine Octoechos") and ↔ Zo lowered; Plagal 2nd → First mode;
  Second mode ↔ Fourth mode (both on Di); Plagal 4th ↔ Zo lowered. Zo lowered by
  4 moria = commonly taught attraction, not verified here (new seed "Diatonic,
  Zo lowered"). Headless: Plagal 4th → Zo lowered → back → First mode → Zo lowered.

## 2026-11-09: voices, key in cents, and the spiral journey

- **Voices.** choir (sampled GM choir_aahs) and oohs (voice_oohs) are loaded on
  first use, and chant stands in until they arrive. chant is a formant synth. The
  ison drone is four low men breathing at different times. Byzantine sings chant ↔
  choir over the ison, and the orchestra adds the choir toward epic MOOD.
- **Key in cents** (done). `keyCents` is folded into the effective concert
  pitch (`aRef = aRefRaw · 2^(keyCents/1200)`), so every voice, drone, sample
  and tuned drum follows with no per-voice changes. Path stations' `shift` may be
  fractional (semitones), and journeys set the key; stopping a journey resets it.
  It's used by:
  - Abu Ata in the Shur journey (finalis A½♭ for Shur on G = shift 1.5; order
    Shur → Abu Ata → Bayat-e Tork → Afshari → Dashti → Shur);
  - the makam journey's Dügah stations, now exactly 9 commas (203.8¢) above Rast
    rather than 200¢;
  - the spiral journey.
  Segah on its own koron tonic is still to do (Persia tour has no key moves).
- **Spiral journey (Qian Lezhi / Jing Fang).** The Chinese pentatonic in pure
  fifths (1, 9/8, 81/64, 3/2, 27/16) has its gong moving up a pure fifth per move
  (xuangong). That's 53 moves over the journey's length (Jing Fang's near-closure,
  3.62¢), then on along Qian Lezhi's chain to 360 until stopped. The key drifts
  (12 moves = +23.46¢, the Pythagorean comma). Brief visits go to the old
  heptatonic with bianzhi and biangong (1, 9/8, 81/64, 729/512, 3/2, 27/16,
  243/128). Gaps in Qian's 360-chain: 1.77, 1.84 and 3.62¢, too close to hear as
  separate notes, which is why the journey walks the chain instead of playing it
  as a scale. Historical figures (Jing Fang 60, Qian Lezhi 360) are from
  general sources (Needham-era histories via Wikipedia), not checked against a
  primary text. Possible next: Jing Fang's 60 as an option.

## 2026-11-09: gongs

Ronnie asked for gongs. Order agreed: tuned gong → tam-tam accents → opera gong
on the spiral → gamelan world (slendro/pelog as cents scales, a gong cycle).
- **Tuned gong** (done). A synthesised bossed gong: 7 partials (1, 2.02, 2.76,
  3.52, 4.41, 5.33, 6.62) as detuned pairs for slow beating, the high ones
  decaying first, a 1.6–6 s ring, landing 7¢ sharp and settling over 0.35 s, with a
  padded mallet thump. Level measured offline: 0.69. Not yet heard by Ronnie.
- **Tam-tam** (done as an instrument, `tamtam`). Ronnie: "a real gong, the kind
  that have endless harmonics and ring out". Built from 129 partials in an
  OfflineAudioContext, rendered once per base pitch (65/130/260 Hz; 20/15/11 s;
  about 2.5 s to render all three, off the main thread). The partials are a hum
  pair, 22 low modes, 45 mid (bloom attacks of 0.25–1.15 s) and 60 high (bloom
  0.7–2.1 s, the shortest decays). A fixed seed means the same gong every time.
  Notes play the nearest base via playbackRate, with more than 4 rings damping
  the oldest. Level 0.62 (matched to the gong on sparse strikes). Next: tam-tam as an accent
  (journey peaks, orchestra resolutions, Storm/Rise, temple), then the opera gong
  on the spiral.
- **Gongs in the spiral** (done). The lead rotates dulcimer → flute → tuned gong
  (yunluo-like), 24–48 notes each. Each key move is marked by the tam-tam on the
  new home note, an octave under the line, struck once the key has arrived. Moves
  happen at Auto's picks, so the strikes come at each key change, not every
  53rd of the journey. Headless check: strikes at D+4¢ (147.2 Hz) and E+8¢
  (165.6 Hz). The opera gong may replace the tam-tam here later.

