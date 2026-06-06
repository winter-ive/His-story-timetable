import { useMemo } from 'react';
import { genTicks, SKEW_DEG, SKEWED_LANES, laneTopOffsetPx } from '../utils.js';
import { PAD_LEFT } from '../data.js';

export default function LanePattern({ range, scale, majorStep, minorStep, laneIdx, laneHpx }) {
  const skewed = SKEWED_LANES.has(laneIdx);
  const xOff = laneTopOffsetPx(laneIdx, laneHpx);

  const minor = useMemo(
    () => genTicks(range.min - 200, range.max + 200, minorStep),
    [range.min, range.max, minorStep],
  );
  const major = useMemo(
    () => genTicks(range.min - 200, range.max + 200, majorStep),
    [range.min, range.max, majorStep],
  );

  return (
    <div className="tt-pattern" aria-hidden>
      <svg width="100%" height="100%" preserveAspectRatio="none">
        <g
          transform={`translate(${xOff + PAD_LEFT}, 0)${skewed ? ` skewX(-${SKEW_DEG})` : ''}`}
        >
          {minor.map((y) => {
            const x = (y - range.min) * scale;
            return (
              <line
                key={`mn${y}`}
                x1={x} x2={x}
                y1={-laneHpx} y2={laneHpx * 2}
                stroke="rgba(96,56,10,0.07)"
                strokeWidth="1"
              />
            );
          })}
          {major.map((y) => {
            const x = (y - range.min) * scale;
            return (
              <line
                key={`mj${y}`}
                x1={x} x2={x}
                y1={-laneHpx} y2={laneHpx * 2}
                stroke="rgba(96,56,10,0.16)"
                strokeWidth="1"
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
