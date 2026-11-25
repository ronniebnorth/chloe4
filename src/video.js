// Video: Chloe watches a video and plays it like a drawn journey. 60 frames,
// evenly spaced, are read into a tiny canvas; each gives a brightness (average
// light) and a motion (how much changed since the frame before). The line is a
// mix of the two, stretched to fill the range. The video never leaves the browser.
// See docs/IDEA_VIDEO_SOUNDTRACK.md.
import { DRAW_POINTS, smoothLine, defaultLine } from "./drawn.js";

const clamp01 = x => Math.min(1, Math.max(0, x));

export const video = {
  url: null, name: "", duration: 0,
  light: null, motion: null, cuts: [],   // raw, 0..1 per point; cuts = point indexes
  cutTimes: [],                          // [{ t: seconds, s: 0..1 strength }], pinned to within a frame or two
  cutHits: true,                         // a hit on every cut (the biggest gets the gong)
  mix: 0.7, invert: false,               // mix: 1 = all light, 0 = all motion
  line: defaultLine(),
  rec: null,                             // the save-with-music recorder while it runs
  saved: null,                           // the last saved file: { url, name, size }
  // Its own sound: decoded once, played in step with the picture, saved with the music
  sound: null,                           // AudioBuffer, or null (no sound track)
  talk: [],                              // [[start, end], ...] seconds where someone speaks
  talkErr: "",                           // set when the talking detector couldn't load
  tone: null,                            // { at: Float32Array per 0.5 s, NaN = no talking; 0 calm .. 1 lively }
  toneOn: true,                          // let the tone of voice steer the music
  soundOn: true, duck: true,             // play the video's sound; make room while they talk
  // Timeline: every play since this video was loaded, logged against the computer's
  // clock so it can be lined up with biofeedback logs (nerve/docs/IN_AND_OUT.md)
  runs: [],                              // [{ start, end, settings, samples: [[ms, t, b, tone, talk, duck, paused]], hits: [[ms, t, s, gong]] }]
};

window.__chloeVideo = video;   // console / tests
try { video.cutHits = localStorage.getItem("chloe-video-cuthits") !== "0"; video.toneOn = localStorage.getItem("chloe-video-tone") !== "0"; } catch {}

const W = 64, H = 36;
// One seek, giving up after 4 s (a frame the browser can't decode kills the element,
// and later seeks would wait forever)
const seekOnce = (el, t) => new Promise((res, rej) => {
  let timer;
  const end = (ok) => { clearTimeout(timer); el.removeEventListener("seeked", done); el.removeEventListener("error", bad); ok ? res() : rej(new Error("seek failed")); };
  const done = () => end(true), bad = () => end(false);
  el.addEventListener("seeked", done); el.addEventListener("error", bad);
  timer = setTimeout(() => end(false), 4000);
  el.currentTime = t;
});
const openEl = async (url) => {
  const el = document.createElement("video");
  el.muted = true; el.preload = "auto"; el.playsInline = true; el.src = url;
  await new Promise((res, rej) => { el.onloadeddata = res; el.onerror = () => rej(new Error("this browser can't open that video")); });
  return el;
};
// A reader that survives a damaged frame: it reopens the video and steps a little
// past the bad spot. Returns false when that moment can't be read at all.
const reader = async (url) => {
  const r = { el: await openEl(url) };
  r.seek = async (t) => {
    for (const dt of [0, 0.12, 0.3]) {
      try {
        if (r.el.error) r.el = await openEl(url);
        await seekOnce(r.el, Math.min(r.el.duration - 0.05, t + dt));
        return true;
      } catch { try { r.el = await openEl(url); } catch { return false; } }
    }
    return false;
  };
  return r;
};

// Read a file: returns true when the line is ready. onProgress(0..1) while it watches.
export async function watchVideo(file, onProgress) {
  if (video.url) URL.revokeObjectURL(video.url);
  const url = URL.createObjectURL(file);
  const rd = await reader(url);
  const dur = rd.el.duration;
  if (!isFinite(dur) || dur <= 0) throw new Error("couldn't tell how long that video is");
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const light = [], motion = [];
  let prev = null;
  let bad = 0;
  for (let i = 0; i < DRAW_POINTS; i++) {
    if (!(await rd.seek(Math.min(dur - 0.05, (i + 0.5) / DRAW_POINTS * dur))) && prev) {
      // That moment can't be read: carry the last one forward
      bad++; light.push(light.at(-1)); motion.push(0); onProgress?.((i + 1) / DRAW_POINTS); continue;
    }
    if (bad > 30) throw new Error("this browser can't read that video's pictures");
    cx.drawImage(rd.el, 0, 0, W, H);
    const px = cx.getImageData(0, 0, W, H).data, g = new Float32Array(W * H);
    let sum = 0;
    for (let p = 0; p < W * H; p++) { g[p] = (0.2126 * px[p * 4] + 0.7152 * px[p * 4 + 1] + 0.0722 * px[p * 4 + 2]) / 255; sum += g[p]; }
    light.push(sum / (W * H));
    let d = 0;
    if (prev) for (let p = 0; p < W * H; p++) d += Math.abs(g[p] - prev[p]);
    motion.push(prev ? d / (W * H) : 0);
    prev = g;
    onProgress?.((i + 1) / DRAW_POINTS);
  }
  motion[0] = motion[1] ?? 0;
  const cutTimes = await findCuts(rd, dur, cx, p => onProgress?.(p, "cuts"));
  // The line's cut points: which of the 60 moments each cut falls in
  const cuts = [...new Set(cutTimes.map(c => Math.min(DRAW_POINTS - 1, Math.floor(c.t / dur * DRAW_POINTS))))];
  // Then listen, before the page sees any of it (so it never shows "no sound" while still listening)
  onProgress?.(1, "listening");
  let heard = { sound: null, talk: [], talkErr: "" };
  try { heard = await listenVideo(file, p => onProgress?.(p, "listening")); } catch {}   // no sound track is fine
  Object.assign(video, { url, name: file.name, duration: dur, light, motion, cuts, cutTimes, runs: [], ...heard });
  makeLine();
  return true;
}

// ── Cuts ──
// Look 4 times a second (fewer on long videos). Each look keeps a small gray
// picture and a color mix (8 levels each of red, green, blue). A camera pan
// changes the pixels but keeps the colors; a cut changes both. A cut = a jump far
// above the jumps around it. Each is then pinned down by halving the gap.
const look = (rd, cx) => {
  cx.drawImage(rd.el, 0, 0, W, H);
  const px = cx.getImageData(0, 0, W, H).data, g = new Float32Array(W * H), h = new Float32Array(24);
  for (let p = 0; p < W * H; p++) {
    const r = px[p * 4], gr = px[p * 4 + 1], b = px[p * 4 + 2];
    g[p] = (0.2126 * r + 0.7152 * gr + 0.0722 * b) / 255;
    h[r >> 5]++; h[8 + (gr >> 5)]++; h[16 + (b >> 5)]++;
  }
  for (let k = 0; k < 24; k++) h[k] /= 3 * W * H;
  return { g, h };
};
const jump = (a, b) => {
  let d = 0, e = 0;
  for (let p = 0; p < a.g.length; p++) d += Math.abs(a.g[p] - b.g[p]);
  for (let k = 0; k < 24; k++) e += Math.abs(a.h[k] - b.h[k]);
  return { pix: d / a.g.length, col: e / 2 };   // both 0..1
};
async function findCuts(rd, dur, cx, onProgress) {
  const step = Math.max(0.25, dur / 240), n = Math.floor(dur / step);
  const looks = [], times = [];
  for (let i = 0; i <= n; i++) {
    const t = Math.min(dur - 0.05, i * step);
    if (!(await rd.seek(t))) { looks.push(looks.at(-1) ?? null); times.push(t); continue; }
    looks.push(look(rd, cx)); times.push(t);
    if (i % 10 === 0) onProgress?.(i / n);
  }
  const score = looks.map((l, i) => {
    if (!i || !l || !looks[i - 1] || l === looks[i - 1]) return 0;
    const j = jump(looks[i - 1], l);
    return j.col * 0.6 + j.pix * 0.4;
  });
  window.__chloeCutScores = score.map((x, i) => [+times[i].toFixed(2), +x.toFixed(3)]);   // tests
  const found = [];
  for (let i = 1; i < score.length; i++) {
    const near = score.slice(Math.max(1, i - 6), i).concat(score.slice(i + 1, i + 7)).sort((a, b) => a - b);
    const med = near[Math.floor(near.length / 2)] ?? 0;
    if (score[i] > 0.12 && score[i] > 3 * med + 0.03 && score[i] >= (score[i - 1] ?? 0) && score[i] >= (score[i + 1] ?? 0)) found.push(i);
  }
  const biggest = Math.max(...found.map(i => score[i]), 1e-9), out = [];
  for (const i of found) {
    let lo = times[i - 1], hi = times[i];
    const A = looks[i - 1], B = looks[i];
    for (let k = 0; k < 6; k++) {
      const mid = (lo + hi) / 2;
      if (!(await rd.seek(mid))) break;
      const m = look(rd, cx), a = jump(m, A), b = jump(m, B);
      if (a.col + a.pix < b.col + b.pix) lo = mid; else hi = mid;
    }
    out.push({ t: hi, s: score[i] / biggest });
  }
  return out;
}

// ── Its sound: where people talk ──
// The sound is decoded, mixed to 16 kHz mono, and Silero VAD (vad.js) marks the
// stretches of talking. If the detector can't load, the sound still plays; there's
// just no making room.
const SR = 16000;
export async function listenVideo(file, onProgress) {
  const raw = await file.arrayBuffer();
  const dec = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(raw);   // throws when there's no sound track
  let talk = [], talkErr = "", tone = null;
  const pcm = await mono16k(dec);
  try {
    const { speechProbs, talkSegments } = await import("./vad.js");
    talk = talkSegments(await speechProbs(pcm, onProgress));
  } catch (e) { talkErr = "couldn't load the talking detector"; console.warn("vad:", e); }
  if (talk.length) {
    const { voiceTone } = await import("./voicetone.js");
    tone = voiceTone(pcm, talk);
  }
  return { sound: dec, talk, talkErr, tone };
}

async function mono16k(buf) {
  const oc = new OfflineAudioContext(1, Math.ceil(buf.duration * SR), SR), src = oc.createBufferSource();
  src.buffer = buf; src.connect(oc.destination); src.start();
  return (await oc.startRendering()).getChannelData(0);
}

// Liveliness of the voice at t (0 calm .. 1 lively), or null when nobody's talking
export const toneAt = (t) => {
  const a = video.tone?.at, k = Math.round(t / 0.5);
  return a && k >= 0 && k < a.length && !isNaN(a[k]) ? a[k] : null;
};
export const toneWord = (v) => v === null ? "" : v > 0.65 ? "lively" : v < 0.35 ? "calm" : "even";
export const talkingAt = (t) => video.talk.some(([a, b]) => t >= a && t <= b);
export const talkSeconds = () => video.talk.reduce((s, [a, b]) => s + b - a, 0);

// Playing the sound in step with the picture, in a context of its own (Chloe swaps
// hers every few minutes). The recorder taps the same output.
let sctx = null, sOut = null, sNode = null;
const soundCtx = () => {
  if (!sctx || sctx.state === "closed") { sctx = new AudioContext(); sOut = sctx.createGain(); sOut.connect(sctx.destination); }
  if (sctx.state === "suspended") sctx.resume();
  return sctx;
};
export function soundPlay(t) {
  soundStop();
  if (!video.sound || !video.soundOn) return;
  const ac = soundCtx();
  sNode = ac.createBufferSource(); sNode.buffer = video.sound; sNode.connect(sOut);
  sNode.start(ac.currentTime + 0.02, Math.max(0, t));
}
export function soundStop() { if (sNode) { try { sNode.stop(); } catch {} sNode.disconnect(); sNode = null; } }

// Stretch to 0..1; a nearly flat signal stays nearly flat (around the middle)
const stretch = (a, minSpan) => {
  const lo = Math.min(...a), hi = Math.max(...a), span = Math.max(minSpan, hi - lo), mid = (lo + hi) / 2;
  return a.map(v => clamp01(0.5 + (v - mid) / span));
};

export function makeLine() {
  if (!video.light) return video.line;
  const L = stretch(video.light, 0.12), M = stretch(video.motion, 0.04);
  let line = L.map((l, i) => video.mix * l + (1 - video.mix) * M[i]);
  if (video.invert) line = line.map(v => 1 - v);
  line = smoothLine(line.map(v => 0.1 + 0.8 * v));
  video.line = line;
  return line;
}

// Recording the video with Chloe's sound. Chloe's playback context can be
// swapped mid-take, so (like the WAV recorder) the sound is bridged into a
// context of our own and each playback context attaches to it.
// H.264 in MP4 first (what reels want); AAC sound where Chrome can make it
// (Mac/Windows), else Opus. Plain "video/mp4" is left out: Chrome fills it with VP9.
const MIMES = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1.42E01E,opus", "video/mp4;codecs=avc1,opus", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
export const saveType = () => MIMES.find(m => window.MediaRecorder?.isTypeSupported?.(m)) ?? null;

export function startVideoRec(el, ac, masterOut) {
  const mime = saveType();
  if (!mime) throw new Error("this browser can't record video (try Chrome or Firefox)");
  const rc = new AudioContext({ sampleRate: ac.sampleRate });
  const out = rc.createMediaStreamDestination();
  const taps = [];
  const attach = (pac) => {
    masterOut(pac);
    const d = pac.createMediaStreamDestination();
    pac.__masterTap.connect(d);
    const s = rc.createMediaStreamSource(d.stream); s.connect(out);
    taps.push({ pac, d, s });
  };
  attach(ac);
  // The video's own sound, when it's playing
  let sTap = null;
  if (video.sound && video.soundOn) {
    const sa = soundCtx(), d = sa.createMediaStreamDestination();
    sOut.connect(d);
    const s = rc.createMediaStreamSource(d.stream); s.connect(out);
    sTap = { d, s };
  }
  // The picture: Chrome can capture the video element itself; elsewhere (Firefox)
  // it's copied frame by frame onto a canvas, which every browser can capture
  let vs = el.captureStream?.(), stopDraw = () => {};
  if (!vs || !vs.getVideoTracks().length) {
    const cv = document.createElement("canvas");
    cv.width = el.videoWidth || 1280; cv.height = el.videoHeight || 720;
    const cx = cv.getContext("2d");
    let on = true;
    const draw = () => { if (!on) return; cx.drawImage(el, 0, 0, cv.width, cv.height); requestAnimationFrame(draw); };
    draw();
    stopDraw = () => { on = false; };
    vs = cv.captureStream(30);
  }
  const stream = new MediaStream([...vs.getVideoTracks(), ...out.stream.getAudioTracks()]);
  const mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6e6, audioBitsPerSecond: 192000 });
  const chunks = [];
  mr.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  mr.start(500);
  return {
    mime, attach,
    stop: () => new Promise(res => {
      mr.onstop = () => {
        stopDraw();
        if (sTap) { try { sOut.disconnect(sTap.d); } catch {} sTap.s.disconnect(); }
        taps.forEach(t => { try { t.pac.__masterTap.disconnect(t.d); } catch {} t.s.disconnect(); });
        rc.close();
        res(new Blob(chunks, { type: mime.split(";")[0] }));
      };
      mr.stop();
    }),
  };
}

// Starts the download, and keeps the file in video.saved so the page can show a
// link to it too (Chrome sometimes holds back a download the page starts itself)
export const download = (blob, name) => {
  if (video.saved) URL.revokeObjectURL(video.saved.url);
  const url = URL.createObjectURL(blob);
  video.saved = { url, name, size: blob.size };
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
};

// The timeline file: what the video holds (the analysis, by video time) and what
// happened on each play (by clock time, ms since 1970 UTC, plus the video time at
// that moment), so EEG, GSR or any other log with clock times lines up with it.
const r3 = x => Math.round(x * 1000) / 1000;
export function timeline() {
  const d = video.duration, at = (i) => r3((i + 0.5) / video.light.length * d);
  return {
    what: "Chloe video timeline", version: 1,
    video: video.name, duration: r3(d),
    exported: new Date().toISOString(), tzOffsetMin: -new Date().getTimezoneOffset(),
    analysis: {
      // light, motion: 0..1 at evenly spaced moments; line: the brightness Chloe follows (after mix/invert)
      frames: video.light.map((l, i) => ({ t: at(i), light: r3(l), motion: r3(video.motion[i]) })),
      line: video.line.map(r3),
      cuts: video.cutTimes.map(c => ({ t: r3(c.t), s: r3(c.s) })),
      talk: video.talk.map(([a, b]) => [r3(a), r3(b)]),
      tone: video.tone ? { step: 0.5, pitchHz: Math.round(video.tone.pitchHz), at: Array.from(video.tone.at, v => isNaN(v) ? null : r3(v)) } : null,
    },
    runsFormat: { samples: ["clockMs", "videoT", "brightness", "voiceTone|null", "talking", "musicDucked", "paused"], hits: ["clockMs", "cutT", "strength", "gong"] },
    runs: video.runs,
  };
}
export function saveTimeline() {
  const blob = new Blob([JSON.stringify(timeline())], { type: "application/json" });
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = `${(video.name || "video").replace(/\.[^.]+$/, "")}-timeline.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
