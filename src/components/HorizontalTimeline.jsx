import { useRef, useState, useLayoutEffect } from 'react';
import Axis from './Axis.jsx';
import LanePattern from './LanePattern.jsx';
import ParallaxWatermark from './ParallaxWatermark.jsx';
import EventsLayer from './EventsLayer.jsx';
import ConnectorLayer from './ConnectorLayer.jsx';
import EdgeLabels from './EdgeLabels.jsx';
import { LANES, ZOOM_LEVELS, PAD_LEFT, PAD_RIGHT } from '../data.js';

export default function HorizontalTimeline({
  events, connections, range, scale, level, levelInfo,
  onSelect, selectedId, relatedIds,
  scrollLeft, viewW,
  editingId, onDragUpdate,
  canvasRef,
}) {
  const totalYears = range.max - range.min;
  const width = totalYears * scale + PAD_LEFT + PAD_RIGHT;
  const lvl = levelInfo.t < 0.5 ? ZOOM_LEVELS[levelInfo.lo - 1] : ZOOM_LEVELS[levelInfo.hi - 1];

  const lanesRef = useRef(null);
  const [laneStackHpx, setLaneStackHpx] = useState(440);
  useLayoutEffect(() => {
    if (!lanesRef.current) return;
    const measure = () => {
      const r = lanesRef.current.getBoundingClientRect();
      setLaneStackHpx(r.height);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(lanesRef.current);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  const laneHpx = laneStackHpx / 4;

  return (
    <div className="tt-canvas" ref={canvasRef} style={{ width: `${width}px` }}>
      <Axis side="top" range={range} scale={scale} levelInfo={levelInfo} laneStackHpx={laneStackHpx} />

      <div className="tt-lanes" ref={lanesRef} style={{ top: 36, bottom: 36 }}>
        {LANES.map((lane, idx) => (
          <div key={lane.id} className={`tt-lane ${idx % 2 === 1 ? 'alt' : ''}`}>
            <LanePattern
              range={range} scale={scale}
              majorStep={lvl.majorStep} minorStep={lvl.minorStep}
              laneIdx={idx} laneHpx={laneHpx}
            />
            <ParallaxWatermark
              lane={lane} scrollLeft={scrollLeft}
              viewW={viewW} canvasW={width} laneHpx={laneHpx}
            />
          </div>
        ))}

        <ConnectorLayer
          events={events} connections={connections}
          range={range} scale={scale}
          containerH={laneStackHpx}
        />
        <EventsLayer
          events={events} range={range} scale={scale} level={level}
          onSelect={onSelect} selectedId={selectedId} relatedIds={relatedIds}
          editingId={editingId} onDragUpdate={onDragUpdate}
        />
      </div>

      <Axis side="bottom" range={range} scale={scale} levelInfo={levelInfo} laneStackHpx={laneStackHpx} />
      <EdgeLabels canvasW={width} />
    </div>
  );
}
