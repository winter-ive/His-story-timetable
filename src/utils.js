import { ZOOM_LEVELS, LANE_H, TOTAL_H, PAD_LEFT } from './data.js';

export const yearLabel = (y) =>
  y === 0
    ? '0'
    : y < 0
      ? `B.C. ${Math.abs(y).toLocaleString()}`
      : `A.D. ${y.toLocaleString()}`;

export const yearShort = (y) =>
  y === 0 ? '0' : y < 0 ? `BC ${Math.abs(y)}` : `AD ${y}`;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

export function interpZoom(level, zooms = ZOOM_LEVELS) {
  const lo = Math.floor(clamp(level, 1, zooms.length));
  const hi = Math.min(lo + 1, zooms.length);
  const t = clamp(level - lo, 0, 1);
  const a = zooms[lo - 1], b = zooms[hi - 1];
  const scale = Math.exp(lerp(Math.log(a.scale), Math.log(b.scale), t));
  return { scale, label: t < 0.5 ? a.label : b.label, lo, hi, t };
}

export function genTicks(min, max, step) {
  const out = [];
  const start = Math.ceil(min / step) * step;
  for (let y = start; y <= max; y += step) out.push(y);
  return out;
}

export function visOpacity(visArr, level) {
  if (!visArr) return 1;
  const lo = clamp(Math.floor(level), 1, 5);
  const hi = Math.min(lo + 1, 5);
  const a = visArr[lo - 1] ? 1 : 0;
  const b = visArr[hi - 1] ? 1 : 0;
  const t = clamp(level - lo, 0, 1);
  return lerp(a, b, t);
}

// Skew geometry (12°)
export const SKEW_DEG = 12;
export const SKEW_TAN = Math.tan((SKEW_DEG * Math.PI) / 180);
export const SKEWED_LANES = new Set([1, 3]);

export function laneIdxAtY(yPx, laneHpx) {
  return clamp(Math.floor(yPx / laneHpx), 0, 3);
}

export function laneTopOffsetPx(laneIdx, laneHpx) {
  if (laneIdx <= 0) return 0;
  if (laneIdx === 1) return 0;
  if (laneIdx === 2) return -laneHpx * SKEW_TAN;
  if (laneIdx === 3) return -laneHpx * SKEW_TAN;
  return -2 * laneHpx * SKEW_TAN;
}

export function xOffsetAtYpx(yPx, laneHpx) {
  const idx = laneIdxAtY(yPx, laneHpx);
  const yWithinLane = yPx - idx * laneHpx;
  const topOff = laneTopOffsetPx(idx, laneHpx);
  if (SKEWED_LANES.has(idx)) {
    return topOff - yWithinLane * SKEW_TAN;
  }
  return topOff;
}

// Viewport center year (reverse coordinate transform)
export function viewCenterYear(scrollLeft, viewWidth, scale, rangeMin) {
  const centerX = scrollLeft + viewWidth / 2;
  return Math.round((centerX - PAD_LEFT) / scale + rangeMin);
}

// localStorage persistence helpers
const STORAGE_KEY_EVENTS = 'tt-events';
const STORAGE_KEY_CONNECTIONS = 'tt-connections';

export function loadPersistedEvents(fallback) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EVENTS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return fallback;
}

export function loadPersistedConnections(fallback) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONNECTIONS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return fallback;
}

let saveTimer = null;
export function saveEventsThrottled(events) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events)); } catch {}
  }, 500);
}

export function saveConnections(connections) {
  try { localStorage.setItem(STORAGE_KEY_CONNECTIONS, JSON.stringify(connections)); } catch {}
}
