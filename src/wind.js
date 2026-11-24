// Wind: a journey played by the real wind where you are, like a wind chime.
// Open-Meteo (free, no key) gives the current wind speed, gusts and direction,
// updated about every 15 minutes. Between updates the music moves around the real
// speed by as much as the real gusts allow; the gust timing itself is Chloe's, and
// the page says so. Location is rounded to 0.1° (about 10 km) before any request
// and kept only in this browser.

const clamp01 = x => Math.min(1, Math.max(0, x));
const lerp = (a, b, x) => a + (b - a) * x;
const round1 = x => Math.round(x * 10) / 10;

// The live state the journey reads (like drawn.js's line): set by the page
export const wind = { speed: null, gust: null, dir: null, time: null, place: null, lat: null, lon: null, invert: false, error: "" };

export const WIND_REFRESH_MS = 10 * 60000;   // Open-Meteo's current values change every 15 min
export const WIND_HISTORY = 120;             // stage line: one point every 5 s = the last 10 minutes
const history = [];

// Speed to 0..1: square root, so light breezes are heard and a gale isn't needed to reach the top
const level = (kmh) => clamp01(Math.sqrt(Math.max(0, kmh) / 50));
const gustiness = () => wind.speed === null ? 0.2 : clamp01((wind.gust - wind.speed) / 25);

// Smooth wobble in -1..1 from overlapping waves 4 to 23 s long: gusts, lulls
const wobble = (ms) => (Math.sin(2 * Math.PI * ms / 9000) + 0.6 * Math.sin(2 * Math.PI * ms / 23000 + 1.3) + 0.4 * Math.sin(2 * Math.PI * ms / 4100 + 2.1)) / 2;

// The wind right now, 0..1, including the gust motion
export const windInst = (ms) => {
  const base = level(wind.speed ?? 8);           // no reading yet: a gentle breeze
  return clamp01(base + gustiness() * 0.35 * wobble(ms));
};

// Journey values from the wind: more wind = brighter (or darker, inverted), faster,
// drier, shorter notes; gusty wind adds orchestra energy and a little tension.
export const windVals = (ms) => {
  const x = windInst(ms), g = gustiness();
  return {
    b: wind.invert ? lerp(0.72, 0.3, x) : lerp(0.3, 0.72, x),
    t: lerp(0.75, 1.25, x),
    rv: lerp(0.88, 0.45, x),
    su: lerp(1.6, 0.8, x),
    e: clamp01(g * x),
    tn: clamp01(g * 0.7),
  };
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
    Object.assign(wind, { speed: c.wind_speed_10m, gust: Math.max(c.wind_gusts_10m, c.wind_speed_10m), dir: c.wind_direction_10m, time: c.time, error: "" });
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
  Object.assign(wind, { lat: round1(lat), lon: round1(lon), place, speed: null, gust: null, dir: null, time: null });
  try { localStorage.setItem("chloe-wind-place", JSON.stringify({ lat: wind.lat, lon: wind.lon, place })); } catch {}
};

export const loadPlace = () => {
  try {
    const p = JSON.parse(localStorage.getItem("chloe-wind-place") || "null");
    if (p && typeof p.lat === "number") Object.assign(wind, { lat: p.lat, lon: p.lon, place: p.place });
    wind.invert = localStorage.getItem("chloe-wind-invert") === "1";
  } catch {}
};
loadPlace();
