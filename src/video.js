// Video: Chloe watches a video and plays it like a drawn journey. 60 frames,
// evenly spaced, are read into a tiny canvas; each gives a brightness (average
// light) and a motion (how much changed since the frame before). The line is a
// mix of the two, stretched to fill the range. The video never leaves the browser.
// See docs/IDEA_VIDEO_SOUNDTRACK.md.
import { DRAW_POINTS, smoothLine, defaultLine } from "./drawn.js";

const clamp01 = x => Math.min(1, Math.max(0, x));

export const video = {
  url: null, name: "", duration: 0,
  light: null, motion: null, cuts: [],   // raw, 0..1 per point
  mix: 0.7, invert: false,               // mix: 1 = all light, 0 = all motion
  line: defaultLine(),
  rec: null,                             // the save-with-music recorder while it runs
  saved: null,                           // the last saved file: { url, name, size }
};

const W = 64, H = 36;
const seek = (el, t) => new Promise((res, rej) => {
  const done = () => { el.removeEventListener("seeked", done); el.removeEventListener("error", bad); res(); };
  const bad = () => { el.removeEventListener("seeked", done); el.removeEventListener("error", bad); rej(new Error("seek failed")); };
  el.addEventListener("seeked", done); el.addEventListener("error", bad);
  el.currentTime = t;
});

// Read a file: returns true when the line is ready. onProgress(0..1) while it watches.
export async function watchVideo(file, onProgress) {
  if (video.url) URL.revokeObjectURL(video.url);
  const url = URL.createObjectURL(file);
  const el = document.createElement("video");
  el.muted = true; el.preload = "auto"; el.playsInline = true; el.src = url;
  await new Promise((res, rej) => { el.onloadeddata = res; el.onerror = () => rej(new Error("this browser can't open that video")); });
  const dur = el.duration;
  if (!isFinite(dur) || dur <= 0) throw new Error("couldn't tell how long that video is");
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const light = [], motion = [];
  let prev = null;
  for (let i = 0; i < DRAW_POINTS; i++) {
    await seek(el, Math.min(dur - 0.05, (i + 0.5) / DRAW_POINTS * dur));
    cx.drawImage(el, 0, 0, W, H);
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
  // A cut: the picture changes far more than usual
  const sorted = [...motion].sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)];
  const cuts = motion.map((m, i) => (m > Math.max(0.12, med * 4) ? i : -1)).filter(i => i > 0);
  Object.assign(video, { url, name: file.name, duration: dur, light, motion, cuts });
  makeLine();
  return true;
}

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
  if (!mime || !el.captureStream) throw new Error("this browser can't save video (try Chrome)");
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
  const vs = el.captureStream();
  const stream = new MediaStream([...vs.getVideoTracks(), ...out.stream.getAudioTracks()]);
  const mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6e6, audioBitsPerSecond: 192000 });
  const chunks = [];
  mr.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  mr.start(500);
  return {
    mime, attach,
    stop: () => new Promise(res => {
      mr.onstop = () => {
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
