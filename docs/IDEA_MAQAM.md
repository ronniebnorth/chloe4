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
