# Instrument audit: 2026-11-09 (late night)

Ronnie listened to every instrument, one at a time: the same phrase (A minor
pentatonic, 220-392 Hz, up and down, last note held), through a little
reverb, in headless Chrome via synthNote, played aloud. His verdict after each.
The duduk was skipped (rebuilt the same night, see IDEA_DUDUK.md; he thinks it
"might be good enough").

## Bad: rebuild
| Instrument | His words | Why (from the code) | Likely fix |
|---|---|---|---|
| **piano** | "sounds like an 80s keyboard... casio or something" | 3 detuned triangle waves + 2 sine partials, one fixed decay | a real piano model: inharmonic partials (stretched), each partial decaying at its own rate (highs fast), hammer noise, two-stage decay, unison strings beating, brighter when louder |
| **guitar** | "sounds almost like steel drums" | a noise burst through ONE narrow band-pass (Q 18) + a triangle: rings like a struck pan, not a string | the sitar's string model (`renderString` in src/sitar.js) with no jawari: Karplus-Strong + pick position + body resonance |
| **fiddle** | "sounds like an 80s keyboard as well" (it's also the kamancheh in Persia) | a fixed waveform, no bow | the duduk's approach: a continuous voice, bow noise, level-dependent brightness, vibrato that blooms, legato |

## OK (not a priority)
- **dx7**: "ok, but not familiar with that instrument"
- **kalimba**: "sounds like a steel drum (hang, or hapi drum)"
- **felt** piano (needed three listens)
- **pan**, **whistle**, **chant**

## Good
xylo, space, lute, whale, hang, shaku, glass, dulcimer, synlead, choir,
oohs, gong, tamtam, opera, saron, sitar (the new synth one).

## Order suggested
1. piano: Auto picks it most (twice in the middle pool, also SOFT).
2. guitar: also twice in the middle pool; quick, since the string model exists.
3. fiddle: Persia's kamancheh and the Steppe's lead.
