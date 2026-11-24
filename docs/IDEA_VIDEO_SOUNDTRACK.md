# Idea: Chloe scores your video (2026-11-24)

*Suggested by Ronnie's next-door neighbor: people need soundtracks for FB reels and
TikTok shorts; Chloe could watch the video and make the music for it.*

## Why it fits

Chloe already plays a line: Draw plays a line you draw, Wind plays the wind. A
video has lines of its own: how bright each moment is, how much is moving, where the
scene cuts. Turn those into a journey line and Chloe plays the video the way it
plays the wind. It's the Sky Conductor goal again (energy into music), with the
light in a video as the energy.

Why people would use it: reels with copyrighted songs get muted or blocked. Music
Chloe makes from your own video is yours, and it follows the picture because it
came from it.

## How it works (v1, built 2026-11-24)

All in the browser; the video never leaves your computer.

1. **Video journey** in Listen: choose a video file (or drop it on the stage).
2. **Watch:** Chloe skims 60 frames, evenly spaced, into a small 64×36 canvas
   and measures, for each one:
   - **brightness** (average luma),
   - **motion** (how much the picture changed since the frame before),
   - **cuts** (a big jump in the picture).
3. **The line:** height = brightness and motion mixed (the mix slider; default
   70% light, 30% motion), stretched to fill the range so a dark video still moves,
   then lightly smoothed (cuts stay steep, like a cliff in Draw).
   Invert flips it (bright video = dark music).
4. **Play with video:** the video plays (muted) on the stage while the journey
   runs for exactly the video's length. Journey ticks every 250 ms instead of 1 s,
   because reels are short.
5. **Save with music:** records the video and Chloe's sound together with
   MediaRecorder and downloads `<name>-chloe.mp4`. H.264 video always (Chrome);
   AAC sound where Chrome can make it (Mac/Windows), Opus sound on Linux. Real
   time: a 30 s video takes 30 s to save. **Firefox** (Ronnie's default browser) has no
   video-element capture and can't record MP4: the picture is copied onto a canvas
   and saved as WebM (VP8 + Opus); tested in headless Firefox 136, 2026-11-24.
   A download link appears after saving, in case the browser holds back the
   automatic download. The music fades over the last 1.5 s so
   it ends with the picture.

Tested 2026-11-24 (headless Chrome, 12 s test clip: dark half, cut, bright busy
half): the line found the cut, the journey followed the video's own clock, and the
saved file was H.264 + Opus, 12.1 s, sound at about −25 dB average.

## Honest limits (v1)

- Short videos change less: Chloe's scale changes are slow by design, so a 15 s
  reel hears tempo, brightness and reverb move more than whole scale journeys.
- Saving is real-time, and the tab must stay in front (Chrome slows hidden tabs).
- Cuts make the line jump, but don't yet trigger a musical event (a hit, a new phrase).
- On Linux the MP4's sound is Opus, not AAC. Not yet checked that FB/TikTok accept
  it; if not, `ffmpeg -i in.mp4 -c:v copy -c:a aac out.mp4` fixes it in a second.
- No beat-sync to the video yet: the music's beats don't land on cuts or motion.

## Listening to what's said (plan, 2026-11-24)

Ronnie's thought: his `transcribe` tool (whisper.cpp, local, translates to English)
already turns a video's speech into timed words, so Chloe can follow what's said,
not just what's seen. Three layers, built in this order:

1. **Talking detection** (BUILT 2026-11-24): find where people speak in the video's
   own sound and make room: the music drops ~7 dB and gets a 6 dB dip at 1.5 kHz
   while they talk (in 80 ms, out 250 ms), then comes back between lines. Talking
   shows as blue marks under the line. The video's own sound now plays along and is
   saved with the music ("video's sound" button; "make room for talking" button).
   - **Detector: Silero VAD** (MIT, 2.2 MB, `public/models/silero_vad.onnx`) via
     `onnxruntime-web` (wasm, single thread), loaded only when a video with sound is
     chosen (~3.8 MB gzipped engine). A loudness/flicker detector was tried first and
     failed: Ronnie's guitar and voice look the same to it (missed his talking in a
     room-mic clip, marked guitar as talking 27 times in another).
   - Checked against whisper timestamps: roommictest talking 7.0-14.7 s, Silero
     6.9-14.2 s, guitar not marked; Ed's clip talking ~21-29/52-62/77-81 s, Silero
     23.6/53-58/77-81 s, none of the guitar; a Segovia guitar video and the stage
     light: nothing marked. Saved file: music down ~5 dB under the voice, whisper
     still reads the words. Works in Chrome (MP4) and Firefox (WebM).
   - Fixed on the way: the recorder now starts once the video is playing (Chrome
     gave no picture track before then, so one save had sound only).
2. **How it's said:** voice pitch, loudness and excitement steer brightness, reusing
   the Tone Translator (xpozur: speech melody → Chloe brightness). Needs only the
   sound, so any language.
3. **What's said:** load the `.srt` from `transcribe --srt` (translated to English if
   needed) alongside the video; each line's mood (sad/tense → darker, happy →
   brighter) shapes the line, and chosen words trigger moments (a "boom" strikes the
   gong). Local first (Ronnie's tool, nothing uploaded); in-browser speech recognition
   for everyone else is a tens-of-MB download, so later. A translated transcript
   means a video in any language can be scored by meaning.

## Later

- Cuts start a new phrase or strike a cymbal/tam-tam; beats line up with cuts.
- Color: warm/cool picture → scale leaning (like wind direction's brighter/darker).
- Motion → tempo directly, separate from brightness.
- Faces detected → the music leans toward whoever's on screen (later; speech is planned above).
- The video's own loudness as another line (beyond speech).
- Faster-than-real-time export (render offline).
- A "re-roll" button: same line, different seed, pick the take you like.
