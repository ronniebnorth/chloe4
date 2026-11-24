// Speech detection with Silero VAD (MIT, github.com/snakers4/silero-vad): a small
// trained model that tells talking from music and noise. It runs in the browser
// through onnxruntime-web, loaded only when a video with sound is chosen, so the
// rest of Chloe never downloads it. Nothing leaves the browser.
let ort = null, session = null;

async function load() {
  if (session) return;
  ort = await import("onnxruntime-web/wasm");
  ort.env.wasm.numThreads = 1;          // threads need special server headers GitHub Pages doesn't send
  session = await ort.InferenceSession.create(`${import.meta.env.BASE_URL}models/silero_vad.onnx`);
}

const SR = 16000, N = 512, CTX = 64;   // 32 ms chunks, each with the 4 ms before it (as Silero's own code does)
export const VAD_STEP = N / SR;

// Speech probability (0..1) for every 32 ms of 16 kHz mono sound
export async function speechProbs(pcm, onProgress) {
  await load();
  let state = new ort.Tensor("float32", new Float32Array(2 * 128), [2, 1, 128]);
  const sr = new ort.Tensor("int64", BigInt64Array.from([BigInt(SR)]), []);
  const n = Math.floor(pcm.length / N), out = new Float32Array(n);
  let ctx = new Float32Array(CTX);
  for (let i = 0; i < n; i++) {
    const x = new Float32Array(CTX + N);
    x.set(ctx); x.set(pcm.subarray(i * N, (i + 1) * N), CTX);
    const r = await session.run({ input: new ort.Tensor("float32", x, [1, CTX + N]), state, sr });
    out[i] = r.output.data[0];
    state = r.stateN;
    ctx = x.slice(N);
    if (onProgress && i % 200 === 0) onProgress(i / n);
  }
  return out;
}

// Probabilities to stretches of talking: on above 0.5, off below 0.35, pauses under
// 0.6 s bridged (so the music doesn't bob up between words), bits under 0.25 s dropped, a little padding either side
export function talkSegments(p) {
  const segs = [];
  let on = false, a = 0, lastOn = 0;
  for (let i = 0; i < p.length; i++) {
    const t = i * VAD_STEP;
    if (!on && p[i] > 0.5) {
      on = true;
      if (segs.length && t - segs.at(-1)[1] < 0.6) a = segs.pop()[0]; else a = t;
    } else if (on && p[i] < 0.35) { on = false; segs.push([a, t]); }
    if (on) lastOn = t;
  }
  if (on) segs.push([a, lastOn + VAD_STEP]);
  return segs.filter(([s, e]) => e - s >= 0.25).map(([s, e]) => [Math.max(0, s - 0.1), e + 0.15]);
}
