// Tempest: a Tempest weather station owner's own station, live, driving the Wind journey.
// The owner pastes a personal access token (tempestwx.com: Settings -> Data
// Authorizations -> Create Token). It stays in this browser (localStorage) and goes
// only to WeatherFlow. Tempest's rules allow reading your OWN station this way,
// for personal non-commercial use; other people's stations need WeatherFlow's
// permission, so there is no "nearest station" here.
//
// What comes in, over one websocket (wss://ws.weatherflow.com/swd/data):
//   rapid_wind  every 3 s: [epoch s, speed m/s, direction deg]
//   obs_st      every minute: lull/avg/gust m/s at [1..3], direction [4], precip type [13] (0 none, 1 rain, 2 hail),
//               lightning avg distance km [14], strike count [15]
//   evt_strike  each lightning strike: [epoch s, distance km, energy]
//   evt_precip  rain has started
// The station list comes from GET https://swd.weatherflow.com/swd/rest/stations?token=…
// (CORS allowed). A test page can point both at a fake server (localStorage chloe-tempest-test).

const KMH = 3.6;
const clampAge = 30000;   // a reading older than 30 s doesn't count as live

export const tempest = {
  token: "", deviceId: null, stationName: "", status: "off",   // off | connecting | live | error
  error: "", speed: null, dir: null, rapidAt: 0, smooth: null,  // km/h, deg; smooth = ~30 s average for the music
  gust: null, lull: null, avg: null, precip: 0, rainAt: 0, strikes: [],   // strikes: [{ at ms, km, energy }]
  lightning: true, rain: true,
  onStrike: null, onRain: null, onChange: null,                 // set by the page
};
if (typeof window !== "undefined") window.__chloeTempest = tempest;

let ws = null, retry = null, wanted = false;
const base = () => {
  try { const t = localStorage.getItem("chloe-tempest-test"); if (t) return JSON.parse(t); } catch {}
  return { rest: "https://swd.weatherflow.com/swd/rest", ws: "wss://ws.weatherflow.com/swd/data" };
};
const changed = () => tempest.onChange?.();

try {
  tempest.token = localStorage.getItem("chloe-tempest-token") || "";
  const d = localStorage.getItem("chloe-tempest-device"); tempest.deviceId = d ? +d : null;
  tempest.stationName = localStorage.getItem("chloe-tempest-name") || "";
  tempest.lightning = localStorage.getItem("chloe-tempest-lightning") !== "0";
  tempest.rain = localStorage.getItem("chloe-tempest-rain") !== "0";
} catch {}

// Live = connected and a 3-second reading arrived recently
export const tempestLive = () => tempest.status === "live" && Date.now() - tempest.rapidAt < clampAge;

// Find the owner's Tempest (device type ST; an older Sky, SK, also sends wind)
async function findDevice(token) {
  const r = await fetch(`${base().rest}/stations?token=${encodeURIComponent(token)}`);
  if (r.status === 401) throw new Error("Tempest didn't accept that token. Check it at tempestwx.com (Settings → Data Authorizations).");
  if (!r.ok) throw new Error(`Tempest's server answered ${r.status}; trying again soon`);
  const j = await r.json();
  for (const s of j.stations || []) {
    const d = (s.devices || []).find(x => x.device_type === "ST") || (s.devices || []).find(x => x.device_type === "SK");
    if (d) return { deviceId: d.device_id, name: s.public_name || s.name || "your station" };
  }
  throw new Error("No Tempest found on that account.");
}

export async function tempestConnect(token) {
  if (token !== undefined) {
    tempest.token = token.trim();
    tempest.deviceId = null;
    try { localStorage.setItem("chloe-tempest-token", tempest.token); } catch {}
  }
  if (!tempest.token) return;
  wanted = true;
  clearTimeout(retry);
  tempest.status = "connecting"; tempest.error = ""; changed();
  try {
    if (!tempest.deviceId) {
      const d = await findDevice(tempest.token);
      Object.assign(tempest, { deviceId: d.deviceId, stationName: d.name });
      try { localStorage.setItem("chloe-tempest-device", String(d.deviceId)); localStorage.setItem("chloe-tempest-name", d.name); } catch {}
    }
  } catch (e) {
    tempest.status = "error"; tempest.error = e.message; changed();
    if (!/token|No Tempest/.test(e.message)) retry = setTimeout(() => wanted && tempestConnect(), 30000);
    return;
  }
  open();
}

function open() {
  try { ws?.close(); } catch {}
  const sock = new WebSocket(`${base().ws}?token=${encodeURIComponent(tempest.token)}`);
  ws = sock;
  sock.onopen = () => {
    const id = () => String(Math.floor(Math.random() * 1e9));
    sock.send(JSON.stringify({ type: "listen_start", device_id: tempest.deviceId, id: id() }));
    sock.send(JSON.stringify({ type: "listen_rapid_start", device_id: tempest.deviceId, id: id() }));
  };
  sock.onmessage = (m) => {
    let d; try { d = JSON.parse(m.data); } catch { return; }
    const now = Date.now();
    if (d.type === "rapid_wind" && Array.isArray(d.ob)) {
      const [, ms, dir] = d.ob;
      tempest.speed = ms * KMH; tempest.dir = dir; tempest.rapidAt = now;
      tempest.smooth = tempest.smooth === null ? tempest.speed : tempest.smooth + 0.1 * (tempest.speed - tempest.smooth);   // ~30 s at 3 s steps
      if (tempest.status !== "live") { tempest.status = "live"; tempest.error = ""; changed(); }
    } else if (d.type === "obs_st" && Array.isArray(d.obs) && d.obs.length) {
      const o = d.obs.at(-1);
      tempest.lull = o.at(1) * KMH; tempest.avg = o.at(2) * KMH; tempest.gust = o.at(3) * KMH;
      const p = o.at(13) || 0;
      if (p && !tempest.precip) { tempest.rainAt = now; tempest.onRain?.(true); }
      if (!p && tempest.precip) tempest.onRain?.(false);
      tempest.precip = p;
      changed();
    } else if (d.type === "evt_strike" && Array.isArray(d.evt)) {
      const s = { at: now, km: d.evt.at(1), energy: d.evt.at(2) };
      tempest.strikes = [...tempest.strikes.filter(x => now - x.at < 3600000), s];
      if (tempest.lightning) tempest.onStrike?.(s);
      changed();
    } else if (d.type === "evt_precip") {
      if (!tempest.precip) { tempest.precip = 1; tempest.rainAt = now; tempest.onRain?.(true); changed(); }
    }
  };
  sock.onclose = () => {
    if (ws !== sock) return;
    ws = null;
    if (!wanted) return;
    tempest.status = "connecting"; changed();
    retry = setTimeout(() => wanted && open(), 5000);
  };
  sock.onerror = () => { tempest.error = "lost the connection to Tempest; reconnecting"; changed(); };
}

export function tempestDisconnect(forget = false) {
  wanted = false; clearTimeout(retry);
  try { ws?.close(); } catch {}
  ws = null;
  if (tempest.precip) tempest.onRain?.(false);
  Object.assign(tempest, { status: "off", error: "", speed: null, smooth: null, rapidAt: 0, precip: 0 });
  if (forget) {
    Object.assign(tempest, { token: "", deviceId: null, stationName: "" });
    try { ["chloe-tempest-token", "chloe-tempest-device", "chloe-tempest-name"].forEach(k => localStorage.removeItem(k)); } catch {}
  }
  changed();
}

// Reconnect on page load if a token is saved
if (typeof window !== "undefined" && tempest.token) setTimeout(() => tempestConnect(), 500);
