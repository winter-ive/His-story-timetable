import { useRef, useState, useLayoutEffect } from 'react';
import {
  clamp, visOpacity, xOffsetAtYpx, laneIdxAtY, SKEWED_LANES, SKEW_TAN,
  yearShort,
} from '../utils.js';
import { TOTAL_H, PAD_LEFT } from '../data.js';

export default function EventsLayer({
  events, range, scale, level, onSelect, selectedId, relatedIds,
  editingId, onDragUpdate,
}) {
  const ref = useRef(null);
  const [bbox, setBbox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    if (!ref.current) return;
    const measure = () => {
      const r = ref.current?.getBoundingClientRect();
      if (r) setBbox({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(ref.current);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  const crossAxis = bbox.h || 440;
  const yScale = crossAxis / TOTAL_H;
  const laneHpx = crossAxis / 4;

  function expandYRange(y, h) {
    const top = y * yScale;
    const bot = (y + h) * yScale;
    const TOP = 0, BOT = crossAxis;
    const out = [];
    const a0 = Math.max(top, TOP);
    const a1 = Math.min(bot, BOT);
    if (a1 > a0) out.push({ y0: a0, y1: a1, isTopAnchor: top >= TOP });
    if (top < TOP) {
      const overflow = TOP - top;
      out.push({ y0: BOT - overflow, y1: BOT, isTopAnchor: false });
    }
    if (bot > BOT) {
      const overflow = bot - BOT;
      out.push({ y0: 0, y1: overflow, isTopAnchor: false });
    }
    return out;
  }

  function sliceByLane(y0, y1) {
    const segs = [];
    let cur = y0;
    while (cur < y1 - 0.001) {
      const idx = laneIdxAtY(cur, laneHpx);
      const laneBot = (idx + 1) * laneHpx;
      const segY0 = cur;
      const segY1 = Math.min(y1, laneBot);
      const skewed = SKEWED_LANES.has(idx);
      segs.push({
        laneIdx: idx,
        y0: segY0, y1: segY1,
        xOffTop: xOffsetAtYpx(segY0, laneHpx),
        xOffBot: xOffsetAtYpx(segY1, laneHpx),
        skewed,
      });
      cur = segY1;
    }
    return segs;
  }

  // Drag state (ref-based to avoid re-renders during drag)
  const dragRef = useRef(null);

  function startDrag(e, ev) {
    if (ev.id !== editingId) return;
    e.stopPropagation();
    e.preventDefault();
    const isTouch = e.touches != null;
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;
    // 증분 방식: 이전 프레임 대비 delta만 넘김 → 마우스 위치 == 사건 위치
    dragRef.current = {
      evId: ev.id,
      prevX: clientX,
      prevY: clientY,
    };

    const onMove = (me) => {
      if (!dragRef.current) return;
      const cx = me.touches ? me.touches[0].clientX : me.clientX;
      const cy = me.touches ? me.touches[0].clientY : me.clientY;
      const dx = cx - dragRef.current.prevX;
      const dy = cy - dragRef.current.prevY;
      dragRef.current.prevX = cx;
      dragRef.current.prevY = cy;
      const dYear = Math.round(dx / scale);
      const dPx = Math.round(dy / yScale);
      if (dYear !== 0 || dPx !== 0) onDragUpdate(dragRef.current.evId, dYear, dPx);
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  }

  function renderEvent(ev) {
    const op = visOpacity(ev.zoomVisibility, level);
    const isSpan = ev.type === 'span';
    const startPos = (ev.start - range.min) * scale;
    const endPos = isSpan ? (ev.end - range.min) * scale : startPos;
    const length = Math.max(2, endPos - startPos);
    const isSelected = selectedId === ev.id;
    const isRelated = !isSelected && relatedIds && relatedIds.has(ev.id);
    const isEditing = editingId === ev.id;
    const zSpan = clamp(ev.z || 3, 1, 5);
    const zSpot = 9;

    const hRaw = ev.heightPx ?? 0;
    const yEff = ev.type === 'spot' && hRaw < 0 ? ev.y + hRaw : ev.y;
    const hEff = Math.abs(hRaw);
    const ranges = expandYRange(yEff, hEff);
    const elements = [];

    ranges.forEach((rg, ri) => {
      const segs = sliceByLane(rg.y0, rg.y1);
      segs.forEach((s, si) => {
        const isTop = ri === 0 && si === 0;
        const isBot = ri === 0 && si === segs.length - 1;
        const segH = s.y1 - s.y0;
        const noTop = !isTop;
        const noBot = !isBot && si !== segs.length - 1;

        const left = isSpan
          ? startPos + s.xOffTop + PAD_LEFT
          : startPos + s.xOffTop - 6 + PAD_LEFT;
        const width = isSpan ? length : 12;
        const segStyle = {
          left: `${left}px`,
          top: `${s.y0}px`,
          width: `${width}px`,
          height: `${segH}px`,
          zIndex: isSpan ? zSpan : zSpot,
          opacity: 1,
          cursor: isEditing ? 'grab' : 'pointer',
          ...(isSpan ? { '--tl-fill': ev.fill ?? 0.15 } : {}),
        };

        const className = [
          'tt-event-seg',
          isSpan ? 'span' : 'spot',
          s.skewed ? 'skewed' : '',
          isSelected ? 'selected' : '',
          isRelated ? 'related' : '',
          noTop ? 'no-top' : '',
          noBot ? 'no-bottom' : '',
          isTop ? 'is-top' : '',
          !isSpan && hRaw < 0 ? 'flip-up' : '',
          isEditing ? 'editing' : '',
        ].filter(Boolean).join(' ');

        elements.push(
          <div
            key={`${ev.id}-r${ri}-s${si}`}
            className={className}
            style={segStyle}
            onClick={(e) => { e.stopPropagation(); onSelect(ev.id); }}
            onMouseDown={(e) => startDrag(e, ev)}
            onTouchStart={(e) => startDrag(e, ev)}
          >
            {isSpan ? (
              <div className="bar" />
            ) : (
              <>
                <div className="line" />
                <div className="dot" />
              </>
            )}
          </div>,
        );
      });
    });

    return { elements, op, startPos, length, isSpan, ev };
  }

  function renderLabel(info) {
    const { ev, op, startPos, length, isSpan } = info;
    if (op < 0.01) return null;
    const yAnchorDesign = ev.y;
    const yAnchorPx =
      clamp(
        ((yAnchorDesign % TOTAL_H) + TOTAL_H) % TOTAL_H,
        0, TOTAL_H,
      ) * yScale;
    const xOff = xOffsetAtYpx(yAnchorPx, laneHpx);
    const labelAlign = ev.labelAlign || 'right';
    const cls = `tt-label ${labelAlign}`;
    let style = { opacity: op };

    if (isSpan) {
      if (ev.labelOutside) {
        style = {
          ...style,
          left: labelAlign === 'right'
            ? `${startPos + xOff + PAD_LEFT}px`
            : `${startPos + length + xOff + PAD_LEFT}px`,
          top: `${yAnchorPx - 30}px`,
        };
      } else {
        style = {
          ...style,
          left: labelAlign === 'right'
            ? `${startPos + xOff + 8 + PAD_LEFT}px`
            : `${startPos + length + xOff - 8 + PAD_LEFT}px`,
          top: `${yAnchorPx + 6}px`,
        };
      }
    } else {
      style = {
        ...style,
        left: labelAlign === 'right'
          ? `${startPos + xOff + 6 + PAD_LEFT}px`
          : `${startPos + xOff - 6 + PAD_LEFT}px`,
        top: `${yAnchorPx + 4}px`,
      };
    }

    const dy = ev.displayYear;
    let yearNode;
    if (dy === false) {
      yearNode = null;
    } else if (typeof dy === 'string') {
      yearNode = <span className="yr">{dy}</span>;
    } else {
      yearNode = (
        <span className="yr">
          {ev.type === 'span'
            ? `${yearShort(ev.start)} ~ ${yearShort(ev.end)}`
            : yearShort(ev.start)}
        </span>
      );
    }

    return (
      <div key={`${ev.id}-lab`} className={cls} style={style}>
        {ev.title}
        {yearNode}
      </div>
    );
  }

  const allEventInfos = events.map((ev) => renderEvent(ev));
  return (
    <>
      <div className="tt-events" ref={ref}>
        {allEventInfos.flatMap((info) => info.elements)}
      </div>
      <div className="tt-labels">
        {allEventInfos.map((info) => renderLabel(info))}
      </div>
    </>
  );
}
