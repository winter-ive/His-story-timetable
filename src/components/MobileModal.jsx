import { useMemo } from 'react';
import { yearLabel, yearShort } from '../utils.js';

function useRelatedEvents(event, events, connections) {
  return useMemo(() => {
    if (!event) return [];
    const ids = new Set();
    connections.forEach((c) => {
      if (c.from === event.id) ids.add(c.to);
      else if (c.to === event.id) ids.add(c.from);
    });
    return events.filter((e) => ids.has(e.id));
  }, [event, events, connections]);
}

export default function MobileModal({ event, open, onClose, events, connections, onChipClick }) {
  const related = useRelatedEvents(event, events, connections);
  if (!event) return null;

  return (
    <div className={`tt-modal-backdrop ${open ? 'open' : ''}`} onClick={onClose}>
      <div className="tt-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="ed-head">
          <div className="ed-headtxt">
            <div className="ed-meta">{event.type === 'span' ? '영역' : '스팟'}</div>
            <div className="ed-title">{event.title}</div>
            {event.displayYear !== false && (
              <div className="ed-yr">
                {typeof event.displayYear === 'string'
                  ? event.displayYear
                  : event.type === 'span'
                    ? `${yearLabel(event.start)} ~ ${yearLabel(event.end)}`
                    : yearLabel(event.start)}
              </div>
            )}
          </div>
          <button className="close" onClick={onClose} title="닫기">✕</button>
        </div>
        <div className="view-body modal-scroll">
          <p className="desc">{event.description || '이 사건에 대한 설명이 없습니다.'}</p>
          <div className="meta-grid">
            <div>
              <span className="k">유형</span>
              <span className="v">{event.type === 'span' ? '영역 (기간)' : '스팟 (시점)'}</span>
            </div>
            {event.displayYear !== false && (
              <div>
                <span className="k">{event.type === 'span' ? '기간' : '연도'}</span>
                <span className="v">
                  {typeof event.displayYear === 'string'
                    ? event.displayYear
                    : event.type === 'span'
                      ? `${yearLabel(event.start)} ~ ${yearLabel(event.end)}`
                      : yearLabel(event.start)}
                </span>
              </div>
            )}
          </div>
          <div className="conn-block">
            <div className="block-title">연관 사건</div>
            {related.length
              ? <div className="chips">
                  {related.map((e) => (
                    <button key={e.id} className="chip chip-link" onClick={() => onChipClick(e.id)}>
                      {e.title}
                      <span className="chip-yr">
                        {e.type === 'span' ? `${yearShort(e.start)} ~ ${yearShort(e.end)}` : yearShort(e.start)}
                      </span>
                    </button>
                  ))}
                </div>
              : <div className="conn-empty">연관 사건이 없습니다.</div>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
