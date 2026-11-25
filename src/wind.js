// Wind: a journey played by the real wind where you are, like a wind chime.
// Open-Meteo (free, no key) gives the current wind speed, gusts and direction,
// updated about every 15 minutes. By default the music follows only those real
// readings, gliding from one to the next. The "gusts" switch (off by default) adds
// gusts and lulls around the real speed, as big as the real gusts allow; their
// timing is Chloe's invention, and the page says so. A wind chime (on by default)
// rings tubes tuned to the scale, struck as often as the real wind would. Location is rounded to 0.1° (about 10 km) before any request
// and kept only in this browser.

const clamp01 = x => Math.min(1, Math.max(0, x));
const lerp = (a, b, x) => a + (b - a) * x;
const round1 = x => Math.round(x * 10) / 10;

// The live state the journey reads (like drawn.js's line): set by the page
export const wind = { speed: null, gust: null, dir: null, time: null, interval: 900, fetched: null, place: null, lat: null, lon: null, invert: false, gusts: false, useDir: true, chimes: true, chimeCount: 0, error: "", from: null, glideStart: 0 };
if (typeof window !== "undefined") window.__chloeWind = wind;   // console / tests
const GLIDE_MS = 10 * 60000;   // a new reading takes 10 minutes to blow in

export const WIND_REFRESH_MS = 5 * 60000;    // Open-Meteo's current values change every 15 min; check every 5
export const WIND_HISTORY = 120;             // stage line: one point every 5 s = the last 10 minutes
const history = [];

// Speed to 0..1: square root, so light breezes are heard and a gale isn't needed to reach the top
const level = (kmh) => clamp01(Math.sqrt(Math.max(0, kmh) / 50));
const gustiness = () => wind.speed === null ? 0.2 : clamp01((wind.gust - wind.speed) / 25);

// Smooth wobble in -1..1 from overlapping waves 4 to 23 s long: gusts, lulls
const wobble = (ms) => (Math.sin(2 * Math.PI * ms / 9000) + 0.6 * Math.sin(2 * Math.PI * ms / 23000 + 1.3) + 0.4 * Math.sin(2 * Math.PI * ms / 4100 + 2.1)) / 2;

// The real speed now: gliding from the last reading to the newest
const speedNow = () => {
  if (wind.speed === null) return 8;             // no reading yet: a gentle breeze (the page says it's waiting)
  if (wind.from === null) return wind.speed;
  const x = clamp01((Date.now() - wind.glideStart) / GLIDE_MS);
  return lerp(wind.from, wind.speed, (1 - Math.cos(Math.PI * x)) / 2);
};

// The wind right now, 0..1; Chloe's gusts only when the switch is on
export const windInst = (ms) => {
  const base = level(speedNow());
  return wind.gusts ? clamp01(base + gustiness() * 0.35 * wobble(ms)) : base;
};

// Journey values from the wind: more wind = brighter (or darker, inverted), faster,
// drier, shorter notes; gusty wind adds orchestra energy and a little tension.
export const windVals = (ms) => {
  const x = windInst(ms), g = gustiness();
  return {
    b: clamp01((wind.invert ? lerp(0.72, 0.3, x) : lerp(0.3, 0.72, x)) + dirShade()),
    t: lerp(0.75, 1.25, x),
    rv: lerp(0.88, 0.45, x),
    su: lerp(1.6, 0.8, x),
    e: clamp01(g * x),
    tn: clamp01(g * 0.7),
  };
};

// The wind chime: which tubes the wind strikes in the next dt seconds. How often
// follows the real wind (calm: one now and then; a strong wind: a steady ringing),
// and gusts set off bursts where several tubes ring together; the bigger the real
// gusts over the steady speed, the more often and fuller. Exactly when each strike
// lands is chance, as with a real chime. Returns [{ at: s from now, tube: 0..n-1, v: 0..1 }].
let burstAt = 0;
export const windChimes = (dt, tubes = 5) => {
  const ms = Date.now(), x = windInst(ms), g = gustiness(), out = [];
  const calm = wind.speed !== null && wind.speed < 1;
  const rate = calm ? 0.02 : 0.04 + 1.8 * x * x;          // strikes a second: ~1 in 9 s at 2 km/h, ~2/s at 50
  let last = -1;
  const strike = (at, v) => {
    let tube = Math.floor(Math.random() * tubes);
    if (tube === last) tube = (tube + 1 + Math.floor(Math.random() * (tubes - 1))) % tubes;   // the clapper swings on
    last = tube;
    out.push({ at, tube, v: Math.min(1, v) });
  };
  for (let t = -Math.log(1 - Math.random()) / rate; t < dt; t += -Math.log(1 - Math.random()) / rate)
    strike(t, (0.35 + 0.5 * Math.random()) * (0.6 + 0.4 * x));
  // Gust bursts: a run of strikes over 1-2.5 s, louder
  if (!calm) {
    const burstRate = (0.01 + 0.05 * g) * (0.3 + x);        // one every ~25-100 s, more when it's gusty
    if (!burstAt) burstAt = ms + 1000 * -Math.log(1 - Math.random()) / burstRate;
    if (burstAt <= ms + dt * 1000) {
      const at0 = Math.max(0, (burstAt - ms) / 1000), n = 3 + Math.round(3 * x + 5 * g * Math.random()), span = 1 + 1.5 * Math.random();
      for (let k = 0; k < n; k++) strike(at0 + span * Math.pow(Math.random(), 1.6), (0.55 + 0.45 * Math.random()) * (0.7 + 0.3 * x));
      burstAt = ms + 1000 * (dt + -Math.log(1 - Math.random()) / burstRate);
    }
  }
  wind.chimeCount += out.length;
  return out.sort((a, b) => a.at - b.at);
};

// Direction (where the wind comes FROM), as if facing north on a map:
// west wind leans the mix left, east right (up to 0.35); north wind a little
// darker, south a little brighter (up to 0.07 of brightness). Off = how much only.
const dirOn = () => wind.useDir && wind.dir !== null && wind.speed !== null;
const rad = () => wind.dir * Math.PI / 180;
export const windPanNow = () => dirOn() ? 0.35 * Math.sin(rad()) * clamp01(level(wind.speed) * 2) : 0;   // calm air barely leans
const dirShade = () => dirOn() ? -0.07 * Math.cos(rad()) * clamp01(level(wind.speed) * 2) : 0;
export const windDirWords = () => {
  if (!dirOn()) return "";
  const p = windPanNow(), d = dirShade(), out = [];
  if (Math.abs(p) > 0.05) out.push(p < 0 ? "leaning left" : "leaning right");
  if (Math.abs(d) > 0.01) out.push(d < 0 ? "a little darker" : "a little brighter");
  return out.join(", ");
};

// The stage line: what the wind has played recently (oldest left, now at the right)
export const pushWindHistory = (b) => { history.push(b); while (history.length > WIND_HISTORY) history.shift(); };
export const windHistoryAt = (f) => {
  if (!history.length) return windVals(f * 600000).b;   // before it plays: a preview of gusts
  const pad = WIND_HISTORY - history.length, i = Math.round(clamp01(f) * (WIND_HISTORY - 1)) - pad;
  return history[Math.max(0, i)];
};

export const compass = (deg) => deg === null ? "" : ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"][Math.round(deg / 45) % 8];

export async function fetchWind() {
  if (wind.lat === null) return false;
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${round1(wind.lat)}&longitude=${round1(wind.lon)}&current=wind_speed_10m,wind_gusts_10m,wind_direction_10m&wind_speed_unit=kmh&timezone=auto`;
  try {
    const r = await fetch(u);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const c = (await r.json()).current;
    if (wind.speed !== null && c.time !== wind.time) { wind.from = speedNow(); wind.glideStart = Date.now(); }
    Object.assign(wind, { speed: c.wind_speed_10m, gust: Math.max(c.wind_gusts_10m, c.wind_speed_10m), dir: c.wind_direction_10m, time: c.time, interval: c.interval || 900, fetched: Date.now(), error: "" });
    return true;
  } catch (e) {
    wind.error = "couldn't reach the weather service; trying again in 10 minutes";
    return false;
  }
}

// A zip code (any country Open-Meteo knows) or a place name
export async function findPlace(q) {
  q = q.trim();
  if (q.length < 2) return null;
  const zipUS = /^\d{5}$/.test(q);
  const u = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1${zipUS ? "&countryCode=US" : ""}`;
  const r = await fetch(u);
  if (!r.ok) return null;
  const hit = (await r.json()).results?.[0];
  if (!hit) return null;
  return { lat: round1(hit.latitude), lon: round1(hit.longitude), place: [hit.name, hit.admin1].filter(Boolean).join(", ") };
}

export const setPlace = ({ lat, lon, place }) => {
  Object.assign(wind, { lat: round1(lat), lon: round1(lon), place, speed: null, gust: null, dir: null, time: null, from: null });
  try { localStorage.setItem("chloe-wind-place", JSON.stringify({ lat: wind.lat, lon: wind.lon, place })); } catch {}
};

export const loadPlace = () => {
  try {
    const p = JSON.parse(localStorage.getItem("chloe-wind-place") || "null");
    if (p && typeof p.lat === "number") Object.assign(wind, { lat: p.lat, lon: p.lon, place: p.place });
    wind.invert = localStorage.getItem("chloe-wind-invert") === "1";
    wind.gusts = localStorage.getItem("chloe-wind-gusts") === "1";
    wind.useDir = localStorage.getItem("chloe-wind-dir") !== "0";
    wind.chimes = localStorage.getItem("chloe-wind-chimes") !== "0";
  } catch {}
};
loadPlace();

// "11:15", and when the next reading is due ("11:30"), in the place's local time
export const windTimes = () => {
  if (!wind.time) return null;
  const hm = wind.time.slice(11, 16), [h, m] = hm.split(":").map(Number), n = h * 60 + m + Math.round(wind.interval / 60);
  return { last: hm, next: `${String(Math.floor(n / 60) % 24).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}` };
};
