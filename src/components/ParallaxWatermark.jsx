import { useState, useRef } from 'react';
import { clamp } from '../utils.js';

export default function ParallaxWatermark({ lane, scrollLeft, viewW, canvasW, laneHpx }) {
  const ref = useRef(null);
  const [textW, setTextW] = useState(0);

  // measure text width
  if (ref.current && textW === 0) {
    const w = ref.current.getBoundingClientRect().width;
    if (w > 0) setTextW(w);
  }

  const travel = Math.max(1, canvasW - viewW);
  const t = clamp(scrollLeft / travel, 0, 1);
  const moveRange = Math.max(0, viewW - textW - 48);
  const xLocal = 24 + moveRange * t;
  let x = scrollLeft + xLocal;
  const maxX = Math.max(0, canvasW - textW - 24);
  if (x > maxX) x = maxX;

  const fontSize = Math.max(20, Math.min(149, laneHpx * 0.66));

  return (
    <span
      ref={ref}
      className="watermark"
      style={{ left: `${x}px`, fontSize: `${fontSize}px` }}
    >
      {lane.watermark}
    </span>
  );
}
