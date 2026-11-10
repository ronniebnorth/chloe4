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

**To verify before building, not from memory:** per-raga intonation.
Two cases are known to differ. Todi's komal Re and Ga sit *lower* than the
table (ati-komal), and Darbari's komal Ga and Dha are sung with andolan, a
slow swing around a low pitch. Sources to look up: Levy 1982, *Intonation in
North Indian Music*; Jairazbhoy & Stone 1963, "Intonation in present-day
North Indian classical music". Use measured cents where they exist, as was
done with Shur and gamelan.

### First ragas (one per time of day)

Notes, times and vadi/samvadi below are the common textbook versions and
still need checking against a source. Pakad phrases are not filled in yet.

| Raga | Time | Aroh (up) | Avroh (down) | Vadi / samvadi | Special |
|---|---|---|---|---|---|
| Bhairav | dawn | S r G m P d N S' | S' N d P m G r S | d / r | andolan on r and d |
| Todi (Miyan ki) | late morning | S r g M d N S' | S' N d P M g r S | d / g | ati-komal r, g; Pa weak |
| Bilawal | morning | S R G m P D N S' | S' N D P m G R S | D / G | the "major scale" raga |
| Bhimpalasi | afternoon | n S g m P n S' | S' n D P m g R S | m / S | pentatonic up, full down |
| Yaman | evening | N R G M D N S' | S' N D P M G R S | G / N | Sa and Pa skipped going up |
| Bageshri | night | S g m D n S' | S' n D m g R S | m / S | |
| Darbari Kanada | late night | S R g m P d n S' | S' d n P m P g m R S | R / P | andolan on g and d; slow, low |
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

1. Raga data in `src/scale24.js` (cents per raga, aroh/avroh, vadi/samvadi,
   time), after verifying intonation from the sources above.
2. The India world with the GM sitar, tanpura and tabla, playable in Studio
   on any raga.
3. Aroh/avroh and vadi weighting in the line generator.
4. The `raga` journey: the curve above, the raga picked by clock, `ra=`.
5. Meend and andolan on the lead.
6. The synth sitar (jawari + taraf).
7. The `day` journey through the ragas.

Ronnie listens and judges after steps 2, 4 and 5.
