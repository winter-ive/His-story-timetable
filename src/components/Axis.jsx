import { useMemo } from 'react';
import { genTicks, SKEW_TAN } from '../utils.js';
import { ZOOM_LEVELS, PAD_LEFT } from '../data.js';
import { yearShort } from '../utils.js';

export default function Axis({ side, range, scale, levelInfo, laneStackHpx }) {
  const lvl = levelInfo.t < 0.5 ? ZOOM_LEVELS[levelInfo.lo - 1] : ZOOM_LEVELS[levelInfo.hi - 1];
  const majorStep = lvl.majorStep;
  const ticks = useMemo(
    () => genTicks(range.min, range.max, majorStep),
    [range.min, range.max, majorStep],
  );

  const skewOffset = side === 'bottom' ? -2 * (laneStackHpx / 4) * SKEW_TAN : 0;

  return (
    <div className={`tt-axis ${side}`}>
      {ticks.map((y) => {
        const left = (y - range.min) * scale + skewOffset + PAD_LEFT;
        const showLabel = y <= 2000 && y > -4300;
        return (
          <div key={y} className="tick major" style={{ left: `${left}px` }}>
            {showLabel && <span className="label">{yearShort(y)}</span>}
          </div>
        );
      })}
      <div
        className="bcad-divider"
        style={{ left: `${(0 - range.min) * scale + skewOffset + PAD_LEFT}px` }}
      >
        <span className="ad-label">A.D.</span>
      </div>
    </div>
  );
}
