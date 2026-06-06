import { TOTAL_H, PAD_LEFT } from '../data.js';
import { xOffsetAtYpx, clamp } from '../utils.js';

// A-1: renders horizontal connector lines between spot events
export default function ConnectorLayer({ events, connections, range, scale, containerH }) {
  const crossAxis = containerH || 440;
  const yScale = crossAxis / TOTAL_H;
  const laneHpx = crossAxis / 4;

  const evMap = new Map(events.map((e) => [e.id, e]));

  const lines = [];
  connections.forEach((conn, i) => {
    const from = evMap.get(conn.from);
    const to = evMap.get(conn.to);
    if (!from || !to) return;
    if (from.type !== 'spot' || to.type !== 'spot') return;

    const past = from.start <= to.start ? from : to;
    const future = past === from ? to : from;

    const yAnchorPx = clamp(
      ((past.y % TOTAL_H) + TOTAL_H) % TOTAL_H, 0, TOTAL_H,
    ) * yScale;
    const xOff = xOffsetAtYpx(yAnchorPx, laneHpx);

    const x1 = (past.start - range.min) * scale + xOff + PAD_LEFT;
    const x2 = (future.start - range.min) * scale + xOffsetAtYpx(yAnchorPx, laneHpx) + PAD_LEFT;
    const y = yAnchorPx;

    lines.push({ key: `conn-${i}`, x1, x2, y });
  });

  if (!lines.length) return null;

  return (
    <svg
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 8, overflow: 'visible',
      }}
    >
      {lines.map((l) => (
        <line
          key={l.key}
          x1={l.x1} y1={l.y}
          x2={l.x2} y2={l.y}
          stroke="var(--tl-accent)"
          strokeWidth="1"
          strokeDasharray="4 3"
          opacity="0.55"
        />
      ))}
    </svg>
  );
}
