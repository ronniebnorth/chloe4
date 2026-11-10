# The duduk, rebuilt: 2026-11-09

Ronnie: "we need to get back to the duduk... it doesn't sound right. A duduk
is sometimes indistinguishable from a beautiful woman's voice... that's why
it's so lovely. Levon Minassian - Bab'aziz... that's the loveliest
instrument if we can get it right, more important than sitar I think."

## Why the old one didn't sound right
Each note was its own tone: a fixed spectrum (PeriodicWave) through fixed
formant peaks, with a scoop and a vibrato on a timer. A duduk, like a singer:
- carries a phrase on **one breath**: the reed never stops, notes slide;
- changes **colour with loudness**: dark and nearly pure when soft, reedy
  partials coming in as it swells;
- is **never still**: jitter and shimmer (tiny random wobbles of pitch and
  level), a vibrato that blooms late with its rate and depth drifting;
- has **breath** pulsing with each cycle of the reed;
- **sighs** at phrase ends (level falls, pitch sinks a few cents).

## What's built
- `src/duduk.js`: `DudukVoice`, plain JS, sample by sample (node renders it
  for listening tests). Partials up to 6 kHz with a tilt from `dark` (soft)
  to `bright` (loud), odd partials strong (`even` 0.5), formants 560 / 1100 /
  2700 Hz, band-passed breath noise gated by the reed's phase, a per-phrase
  breath amount (0.6-1.4×) with slow drift, scoop on a phrase's first note
  (~70¢), legato glide (~70 ms), vibrato 5.1 Hz ±0.6 drifting, depth ~16¢
  blooming after 0.35 s and dipping through note changes, a sigh of ~30¢.
  `gain` per note is loudness only, so the volume doesn't change the colour.
- `src/duduk-worklet.js`: an AudioWorkletProcessor holding three voices
  (melody, the Desert world's harmony, a spare). Messages `on` / `off` with
  AudioContext times, applied at the exact sample. A note-on cancels its
  voice's pending note-off from just before it, so overlapping notes join into
  one breath. Imported with Vite's `?worker&url`, which bundles it with
  duduk.js into one asset (`dist/assets/duduk-worklet-*.js`, 4 kB).
- `App.jsx`: `dudukWorklet(ac)` loads it per context (as soon as Desert or
  the duduk is picked). `synthNote("duduk")` picks a voice (one still
  sounding that didn't start just now, nearest in pitch; else a free one),
  sends on + off (off at the note's end; the next note usually cancels it).
  The older synth duduk stays as the fallback until it loads.
- Level: `DUDUK_OUT = 1.55`, matched to the old duduk's average (measured
  live: before it, the new one was 3.7 dB under).
- Cost: ~1/10 of real time per voice in node.

## Listening record
- A/B 1 (two original desert-mode phrases around D4): **A** (darker,
  breathier) "for sure"; **B** (brighter, odd-heavier, less breath) "sounded
  more like a big ocarina".
- A/B 2: **A2** (even partials 0.8, higher vowel formants, vibrato 22¢,
  more air): "maybe too breathy, but sometimes there is more or less breath"
  → A's tone kept, breath now varies per phrase.
- Live Desert run, 50 s, no errors; the worklet loaded (checked via a
  temporary console line; resource timing doesn't list worklet fetches).

## Not done / next
- The **dam** drone (the second duduk holding the home note) still uses the
  old PeriodicWave sound. It could become a DudukVoice holding one note with
  circular breathing.
- Ornaments Minassian uses: quick grace notes from above, mordents, the
  "cry" (a fast upward flick then fall). Not modelled yet.
- The register: duduk in A sounds roughly G3-A5. Chloe may send notes outside
  it; a real player would fold them in.
- The Desert phrasing itself (4-9 notes, then silence) is the old one;
  with real legato, longer held notes and fewer runs may suit it better.

### Ronnie: listen for
1. Does it sing in the Desert world now?
2. Level against the daf and the dam drone.
3. Does the harmony duduk (on ~60% of phrases) blend or clash?
4. Breath: right amount and variety now?
