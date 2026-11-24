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
   time: a 30 s video takes 30 s to save. The music fades over the last 1.5 s so
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

## Later

- Cuts start a new phrase or strike a cymbal/tam-tam; beats line up with cuts.
- Color: warm/cool picture → scale leaning (like wind direction's brighter/darker).
- Motion → tempo directly, separate from brightness.
- Faces or speech detected → duck the music under talking.
- Use the video's own sound (volume, speech) as another line.
- Faster-than-real-time export (render offline).
- A "re-roll" button: same line, different seed, pick the take you like.
