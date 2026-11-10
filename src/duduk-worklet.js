/* The duduk players, in the audio thread. Three DudukVoices (the melody,
   the Desert world's harmony, and a spare), driven by messages from
   synthNote: { type: "on", v, t, hz, vel, gain, legato } and
   { type: "off", v, t, rel }, t in AudioContext seconds, applied at the
   exact sample. A note-on cancels its voice's pending note-off from just
   before it, so overlapping notes join into one breath (legato). */
import { DudukVoice } from "./duduk.js";

class DudukProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.voices = [0, 1, 2].map(k => new DudukVoice(sampleRate, { seed: 777 + 101 * k }));
    this.q = [];
    this.port.onmessage = (e) => {
      const m = e.data;
      if (m.type === "on") this.q = this.q.filter(x => !(x.type === "off" && x.v === m.v && x.t >= m.t - 0.06));
      this.q.push(m);
      this.q.sort((a, b) => a.t - b.t);
    };
  }
  apply(m) {
    const v = this.voices[m.v];
    if (!v) return;
    if (m.type === "on") v.noteOn(m.hz, m.vel, m.legato && v.on, m.gain);
    else v.noteOff(m.rel ?? 0.3);
  }
  process(_inputs, outputs) {
    const out = outputs[0][0], N = out.length, t0 = currentTime;
    let pos = 0;
    while (pos < N) {
      while (this.q.length && Math.round((this.q[0].t - t0) * sampleRate) <= pos) this.apply(this.q.shift());
      const next = this.q.length ? Math.round((this.q[0].t - t0) * sampleRate) : N;
      const end = Math.min(N, Math.max(pos + 1, next));
      for (const v of this.voices) v.render(out, pos, end - pos);
      pos = end;
    }
    for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(out);
    return true;
  }
}
registerProcessor("duduk", DudukProcessor);
