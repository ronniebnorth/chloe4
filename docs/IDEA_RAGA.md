# Idea: an India world and a raga journey — 2026-11-09

Ronnie, after the Chloe 4 Facebook post: "Are we missing an India journey?
… yes we need to do that." It's the biggest gap left in the world scales.
Chloe4 covers Persia, Turkey, Byzantium, China and Java, and India is the
largest microtonal tradition still missing.

## Already built

- `tanpura` drone (root, P5, oct, 2oct, each string pulsing), `src/App.jsx` ~606.
- `tabla` beat (`bt=tabla`): teental theka, dayan tuned to Sa, tabla tarang
  bars. See `docs/IDEA_TABLA.md`, which already lists "an India world
  (sitar/sarangi lead + tanpura drone + tabla)" as not done.
- The cents engine: any just-intonation scale can be a `REAL_SEEDS` entry
  (`fromCents`), and journeys can set the key in cents (`keyCents`).
- Journey paths with stations (`SHUR_PATH`, `TURK_PATH`), each with its own
  home note, shift and related scales.

## The design

Indian music already thinks in journeys, in two ways:

1. **The shape of one performance.** alap (no beat: the lead opens the raga
   slowly, a few notes at a time, starting low) → jor (a steady pulse, still
   no drums) → gat (the tabla comes in, the tempo rises from slow to fast) →
   jhala (fast, bright, the peak) → a tihai (a phrase played three times that
   lands on beat 1) → Sa.
2. **The day's ragas.** Each raga belongs to a time of day.

**Recommendation: build (1) first as the `raga` journey.** That's what a
concert is, and it needs only one raga's data at a time. The tension and
tempo curve maps straight onto it. **The raga is picked by the listener's
own clock** (Bhairav at dawn, Yaman in the evening, Malkauns late at night),
or set with `ra=` in the link. The stage shows "Raga Yaman · evening".

Then (2) as a `day` journey: a path through the ragas, dawn to night, built
on the same data.

### Journey curve (fractions of the journey length)

| Part | at | Beat | Lead | Notes |
|---|---|---|---|---|
| alap | 0.00–0.30 | off | free time, long notes, meend (glides) | the range opens a step at a time from Sa (vistar): low → middle → high |
| jor | 0.30–0.50 | off | steady pulse, plucked | the tempo rises a little |
| gat | 0.50–0.85 | tabla teental | composed-feeling phrases on the cycle | vilambit → madhya → drut (slow → medium → fast) |
| jhala | 0.85–0.97 | tabla, fast | fast strokes alternating with the drone string (chikari) | the peak; a tam-tam style accent at the end of the tihai? (ask Ronnie: is it too Chinese?) |
| end | 0.97–1.00 | off | back to low Sa, tanpura rings on | |

## Tuning and raga data

Sa moves with `keyCents`. Sitar players often tune Sa around C♯.
Starting points are 5-limit just intonation:

| Note | Ratio | Cents |
|---|---|---|
| Sa | 1/1 | 0 |
| komal Re (r) | 16/15 | 112 |
| Re (R) | 9/8 | 204 |
| komal Ga (g) | 6/5 | 316 |
| Ga (G) | 5/4 | 386 |
| Ma (m) | 4/3 | 498 |
| tivra Ma (M) | 45/32 | 590 |
| Pa (P) | 3/2 | 702 |
| komal Dha (d) | 8/5 | 814 |
| Dha (D) | 5/3 | 884 |
| komal Ni (n) | 9/5 / 16/9 | 1018 / 996 |
| Ni (N) | 15/8 | 1088 |

This table is only the starting point. The measured values and note shapes
in "Tuning research" below override it.

### Tuning research (2026-11-09)

**The main finding changes the plan:** in raga music a special note is a
*shape*, not a fixed pitch. Van der Meer & Rao measured komal Dha in five
ragas sung one after another by the same singer. The averages were nearly
the same, all near 810¢, but each raga was easy to recognise from how the
note was approached, how it swung and how it left. They conclude that shruti
is "a melodic contour", a *toneme*, and that pitch as a fixed point is ruled
out. So Chloe needs **a shape per raga-note**, and a cents table alone won't
sound right. The ornaments (meend and andolan) move up the build order (below).

**Measured values found so far:**

| Raga | Note | Cents | Source |
|---|---|---|---|
| Todi | komal Re | 95 (Kishori Amonkar 96, Asad Ali Khan 99) | Bel, Melodic Movement Analyser averages |
| Todi | komal Ga | 294 (Amonkar 288, Khan 290) | same |
| Todi | tivra Ma | 606 avg (Amonkar 594, Khan 593) | same |
| Todi | Pa | 702 | same |
| Todi | komal Dha | **792 in the upper octave, 806 in the lower**: it depends on the octave | same |
| Todi | Ni | 1107 (Amonkar 1110) | same |
| Bhairav | komal Dha | avg 809, range 796–828 | van der Meer & Rao |
| Darbari | komal Dha | avg 811, range 801–826 | same |
| Bhairavi | komal Dha | avg 810, range 805–823 | same |
| Jaunpuri | komal Dha | avg 819 | same |
| Puriya Dhanashri | komal Dha | avg 804, range 793–811 | same |

So Todi's Re and Ga really are low (ati-komal: 95 and 294 against 112 and
316 in the table above), and its Ni is high (1107 against 1088). But
**Bhairav's and Darbari's komal Dha are *not* ati-komal.** They sit near
the Pythagorean 814¢, against the textbook claim. What makes them sound
special is the movement.

**Shapes described in the sources (to build as note shapes):**
- **Bhairav Dha:** attacked from above, falls fast then slows down ("opens
  its parachute"), bounces up slightly and settles, then makes a small hump
  up before moving on to Pa. The widest spread of the five ragas.
- **Darbari Dha:** either creeps up from Pa and swings gently 2–3 times, or
  falls from above (S' N\D N\P).
- **Darbari Ga:** no single pitch can be measured. In Uday Bhawalkar's
  rendering it swings very slowly about five times, each swing a little
  higher (as cited from "Gandhara in Darbari Kanada, the Mother of All
  Shrutis"; numbers not found yet). It is reached from Ma above. Its
  centre will have to be set by ear: Ronnie's call.
- **Bhairavi and Puriya Dhanashri Dha:** straight. The neighbouring notes
  tell them apart (Bhairavi: komal Ni and Pa; Puriya: Ni and tivra Ma).
- Van der Meer's guess: when nothing pulls a note one way or the other, it
  drifts to a middle position, so not every note is "just".

**Still missing:** measured values for Yaman, Bhimpalasi, Bageshri and
Malkauns. Neither study covers them. Start those from the just table and
let the shapes and Ronnie's ear do the rest. Two sources weren't readable
here: Jairazbhoy & Stone 1963 (paywalled, BSOAS 26/1:119–132) and the ITC
SRA report *Experimental Analysis of Shrutis from the Performances in
Hindustani Music* (27 singers, Bhairav and Darbari aalap). The arXiv paper
that cites the ITC report gives only per-singer average errors (~9–10¢), not
per-note values.

Sources:
- Bel, "Raga intonation", bolprocessor.org/raga-intonation
- van der Meer & Rao, "Microtonality in Indian music: myth or reality?"
  (archive.org researchpapers_201305)
- "Gandhara in Darbari Kanada, The Mother of All Shrutis" (academia.edu 11187267)
- arXiv 1502.03679 (shruti distributions; cites the ITC SRA data)

### First ragas (one per time of day)

Notes, times and vadi/samvadi below are the common textbook versions and
still need checking against a source. Pakad phrases are not filled in yet.

| Raga | Time | Aroh (up) | Avroh (down) | Vadi / samvadi | Special |
|---|---|---|---|---|---|
| Bhairav | dawn | S r G m P d N S' | S' N d P m G r S | d / r | andolan on r and d (d ~809¢, shaped; see below) |
| Todi (Miyan ki) | late morning | S r g M d N S' | S' N d P M g r S | d / g | measured: r 95, g 294, N 1107; Pa weak |
| Bilawal | morning | S R G m P D N S' | S' N D P m G R S | D / G | the "major scale" raga |
| Bhimpalasi | afternoon | n S g m P n S' | S' n D P m g R S | m / S | pentatonic up, full down |
| Yaman | evening | N R G M D N S' | S' N D P M G R S | G / N | Sa and Pa skipped going up |
| Bageshri | night | S g m D n S' | S' n D m g R S | m / S | |
| Darbari Kanada | late night | S R g m P d n S' | S' d n P m P g m R S | R / P | slow swing on g (no fixed pitch) and d (~811¢, not ati-komal); slow, low |
| Malkauns | midnight | S g m d n S' | S' n d m g S | m / S | pentatonic; no Pa → tanpura on Ma |

## New engine work (in order of risk)

1. **Aroh/avroh.** The melody needs a different note set going up than going
   down, plus vakra (zig-zag) moves for Darbari. Nothing in Chloe does this
   yet. Store `aroh` / `avroh` per raga, and have the line generator pick
   from the set for its current direction.
2. **Ornaments on the lead.** Meend (a glide into a note), andolan (a slow
   swing on named notes) and kan (a grace note). These are per-note pitch
   automation on the lead voice.
3. **Vadi / samvadi weighting.** The line rests on these notes more often.
4. **Lead voice.** Start with the **GM sitar sample** (program 105), loaded
   the way `choir`/`oohs` are. Watch for the IDEA_MAQAM warning that sample
   voices tuned to semitones must play in cents. Later, a synth sitar:
   Karplus-Strong plus the jawari bridge buzz, plus sympathetic strings
   (taraf) as a resonator bank tuned to the raga's notes. That buzz and
   shimmer is most of the sound. Bansuri can use the existing `flute`.
   Sarangi is a later addition.
5. **Tanpura tuning per raga.** Pa by default, Ma for ragas with no Pa
   (Malkauns), and Ni for Marwa-type ragas later. Check the current
   `tanpura` drone can take a different second string.
6. **Tabla per section.** Off in alap and jor, teental in gat, tempo rising
   through the gat. Ektaal and jhaptal can come later. Add a tihai that
   ends each gat cycle at the end.
7. **India world** (`wo=india`): sitar lead, tanpura, tabla, and maybe faint
   evening ambience (no stock "temple bells").

## Build order

Revised after the tuning research: shapes come before the journey.

1. **DONE 2026-11-09:** `RAGAS` in `src/scale24.js` (details under "Step 1 as built"). Raga data in `src/scale24.js`: cents per raga (the measured Todi values,
   ~810 for komal Dha, just intonation elsewhere), octave-dependent pitch
   where measured (Todi Dha), aroh/avroh, vadi/samvadi, time of day, and a
   **shape per special note** (straight / from above + settle + hump /
   creep up + 2–3 swings / slow rising swings).
2. **DONE 2026-11-09 (waiting for Ronnie's ear):** the India world with the GM sitar, tanpura and tabla, playable in Studio
   on any raga. See "Step 2 as built".
3. Note shapes on the lead (meend, andolan, approach direction), driven by
   step 1's shape data.
4. Aroh/avroh and vadi weighting in the line generator.
5. The `raga` journey: the curve above, the raga picked by clock, `ra=`.
6. The synth sitar (jawari + taraf).
7. The `day` journey through the ragas.

Ronnie listens and judges after steps 2, 3 (Darbari Ga's centre is his
call) and 5.

## Step 1 as built (2026-11-09)

- `RAGAS` in `src/scale24.js`: the eight ragas above, each with `notes`
  (sargam → cents), `aroh`/`avroh` parsed into `up`/`down` (note, octave,
  cents), `vadi`/`samvadi`, `time`/`hours`, `drone` (P, or m for Bageshri and
  Malkauns), `shapes` and `id`. Helpers: `ragaByKey`, `ragaForHour(h)`,
  `ragaCents(r, note, octave)` (applies Todi's upper-octave Dha, 792).
- **Tuning choices:** Todi measured (r 95, g 294, M 606, P 702, d 806 / 792
  from upper Sa, N 1107). komal Dha 809 in Bhairav and 811 in Darbari (van der
  Meer & Rao). Malkauns' d is just 8/5 (814). komal Ni is **16/9 (996)**, a
  pure 4th above Ma, because the Ma-centred ragas lean on it. Everything else
  is 5-limit just, with Pa an exact 3/2. **Darbari Ga starts at just 6/5
  (316), waiting for Ronnie's ear.**
- **Shapes** are keyframes `[t, cents offset]` over a note's length, keyed by
  approach (`up` / `down` / `any`): Bhairav r andolan; Bhairav d parachute
  from above, andolan from below; Darbari d creeping swing from Pa and a
  fall-and-settle from above; Darbari g with five slow swings, each higher.
  Depths and timings are first guesses from the descriptions.
- The ragas joined `REAL_SEEDS` (appended, so the `rel-1…10` family IDs are
  unchanged), and they show in Studio under REAL INTONATION as
  "Raga Yaman (evening)" etc. **Bilawal = Just major** note for note, so it
  isn't a separate scale: Just major's name gains "· Raga Bilawal (morning)".
- The 24-grid stand-ins (`approx`) are all clean 7-note (or 5/6-note) sets;
  no two notes land on the same quarter tone.
- The tanpura drone takes `opts.first` (a ratio) for its first string:
  4/3 gives Ma. The default is unchanged (1.498).
- Hours: Malkauns 1–4, Bhairav 4–7, Bilawal 7–10, Todi 10–13,
  Bhimpalasi 13–18, Yaman 18–21, Bageshri 21–23, Darbari 23–1.

## Step 2 as built (2026-11-09)

- **`sitar` instrument:** the MusyngKite GM sitar (program 105) through
  `voiceSf`, the same loader as choir/oohs, but with no loop (plucked; it
  rings for up to 3 beats, max 4 s). Each note is a whole MIDI note plus
  detune in cents, so raga pitches are exact. Until the samples load (~1 s),
  the lute plucks in its place. The samples start loading as soon as the
  India world or the sitar is picked. Level: `SOUND_GAIN.sitar = 0.6`
  (measured live: at gain 1 its peak was piano's, −8.8 vs −7.6 dB, but its
  average over 1.2 s ran 8 dB hotter because it keeps ringing, so it's set
  4.4 dB down; Ronnie to judge).
- **India world** (`wo=india`): sitar lead, `tabla` beat, `tanpura` drone,
  tempo pulled toward 72. **Auto holds the raga of the hour**
  (`clockRaga()`) instead of picking a new scale every ~15 s (the first
  test changed raga at every pick, which is wrong for a raga), and doesn't
  restart the line when the pick is the raga already playing. Wander includes
  India (sleep 0.5, otherwise 0.7, less when tense).
- **Tanpura per raga:** whenever the scale is a raga with `drone: "m"`
  (Malkauns, Bageshri), the tanpura's first string glides to 4/3 (Ma), and
  back to 1.498 for anything else (`voice.setFirst`). This only applies to
  raga scales; other scales keep the old tanpura.
- Headless test (2026-11-09, 22:20): no errors; the samples came from
  gleitz MusyngKite `sitar-ogg.js`; it picked Bageshri, which is correct
  for 22:20.
- **Not done yet, and known:** the sitar is a sample, so it can't bend
  within a note. Step 3's shapes (meend, andolan) need either per-note detune
  automation through smplr (check whether its voices expose `detune` as an
  AudioParam) or the synth sitar (step 6) moved earlier. Rhythm, chord and
  direction are still Auto's usual random picks (chords and waltz have no place in
  a raga); step 4's line generator fixes that.

### Ronnie: listen for
1. Does the GM sitar sound like a sitar, or too much like a cheap keyboard
   patch? (If it's too cheap, the synth sitar moves up.)
2. Sitar level against the tabla and the tanpura.
3. The tanpura on Ma (Malkauns after 1 am, Bageshri 21–23): does the
   switch sound right?
4. Todi's low Re/Ga and high Ni, and Darbari's Ga (just 316¢ for now): out of
   tune, or the right flavour?
