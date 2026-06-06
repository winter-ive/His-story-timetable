import { useState, useEffect, useMemo, useCallback } from 'react';
import { yearLabel, yearShort, clamp } from '../utils.js';
import { TOTAL_H, LANE_H } from '../data.js';

// ---- helpers ----
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

function RelatedChips({ list, onChipClick }) {
  if (!list.length) return <div className="conn-empty">연관 사건이 없습니다.</div>;
  return (
    <div className="chips">
      {list.map((e) => (
        <button key={e.id} className="chip chip-link" onClick={() => onChipClick(e.id)}>
          {e.title}
          <span className="chip-yr">
            {e.type === 'span' ? `${yearShort(e.start)} ~ ${yearShort(e.end)}` : yearShort(e.start)}
          </span>
        </button>
      ))}
    </div>
  );
}

// L-2 fix: clamp numeric inputs to prevent 800+ freeze
// + step buttons (±1) for 1px precision editing
function NumberField({ value, onCommit, allowNegative = true, min, max, suffix, className, step = 1 }) {
  const [str, setStr] = useState(String(value ?? ''));
  useEffect(() => {
    setStr(String(value ?? ''));
  }, [value]);

  const clampAndCommit = (n) => {
    if (!allowNegative) n = Math.max(0, n);
    if (typeof min === 'number') n = Math.max(min, n);
    if (typeof max === 'number') n = Math.min(max, n);
    setStr(String(n));
    onCommit(n);
  };

  const commit = () => {
    if (str === '' || str === '-') { setStr(String(value ?? '')); return; }
    const n = parseFloat(str);
    if (Number.isNaN(n)) { setStr(String(value ?? '')); return; }
    clampAndCommit(n);
  };

  const stepBy = (dir) => {
    const cur = parseFloat(str);
    clampAndCommit((Number.isNaN(cur) ? (value ?? 0) : cur) + dir * step);
  };

  return (
    <div className={`field number-field ${className || ''}`}>
      <button className="step-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => stepBy(-1)}>−</button>
      <input
        type="text"
        inputMode={allowNegative ? 'text' : 'numeric'}
        value={str}
        onChange={(e) => setStr(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'ArrowUp') { e.preventDefault(); stepBy(1); }
          if (e.key === 'ArrowDown') { e.preventDefault(); stepBy(-1); }
        }}
      />
      {suffix && <span className="field-sub">{suffix}</span>}
      <button className="step-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => stepBy(1)}>＋</button>
    </div>
  );
}

function DisplayYearControl({ event, set }) {
  const dy = event.displayYear;
  const mode = dy === false ? 'hide' : typeof dy === 'string' ? 'override' : 'auto';
  const [text, setText] = useState(typeof dy === 'string' ? dy : '');
  useEffect(() => {
    if (typeof dy === 'string') setText(dy);
  }, [dy]);
  return (
    <>
      <div className="row">
        <label>연도 표시</label>
        <div className="seg">
          <button className={mode === 'auto' ? 'on' : ''} onClick={() => set({ displayYear: true })}>기본</button>
          <button className={mode === 'hide' ? 'on' : ''} onClick={() => set({ displayYear: false })}>숨김</button>
          <button className={mode === 'override' ? 'on' : ''} onClick={() => set({ displayYear: text || '~' })}>Override</button>
        </div>
      </div>
      {mode === 'override' && (
        <div className="row">
          <label />
          <div className="field">
            <input
              value={text}
              placeholder="예: ~, 약 B.C. 1500"
              onChange={(e) => { setText(e.target.value); set({ displayYear: e.target.value }); }}
            />
          </div>
        </div>
      )}
    </>
  );
}

function ConnectionEditor({ event, events, related, onConnAdd, onConnRemove }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    const relIds = new Set(related.map((r) => r.id));
    return events
      .filter((e) => e.id !== event.id && !relIds.has(e.id))
      .filter((e) => !q || e.title.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, events, event.id, related]);

  return (
    <div className="group">
      <div className="group-title">연관 사건</div>
      <div className="conn-list">
        {related.map((r) => (
          <div key={r.id} className="conn-item">
            <span>{r.title}</span>
            <span className="y">
              <span>
                {r.type === 'span' ? `${yearShort(r.start)} ~ ${yearShort(r.end)}` : yearShort(r.start)}
              </span>
              <button className="conn-remove" title="제거" onClick={() => onConnRemove(event.id, r.id)}>✕</button>
            </span>
          </div>
        ))}
        {!related.length && <div className="conn-empty-inline">아직 연결된 사건이 없어요.</div>}
      </div>
      <div className="conn-search">
        <div className="field">
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="사건명으로 검색해서 추가"
          />
        </div>
        {open && candidates.length > 0 && (
          <div className="conn-dropdown">
            {candidates.map((c) => (
              <button
                key={c.id}
                className="conn-cand"
                onClick={() => { onConnAdd(event.id, c.id); setQuery(''); setOpen(false); }}
              >
                <span className="cand-title">{c.title}</span>
                <span className="cand-yr">
                  {c.type === 'span' ? `${yearShort(c.start)} ~ ${yearShort(c.end)}` : yearShort(c.start)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EditFields({ event, set, events, related, onConnAdd, onConnRemove, onDelete }) {
  return (
    <div className="edit-body">
      <div className="group">
        <div className="group-title">기본 정보</div>
        <div className="row">
          <label>사건명</label>
          <div className="field">
            <input value={event.title} onChange={(e) => set({ title: e.target.value })} />
          </div>
        </div>
        <div className="row">
          <label>유형</label>
          <div className="seg">
            <button className={event.type === 'spot' ? 'on' : ''} onClick={() => set({ type: 'spot' })}>스팟</button>
            <button className={event.type === 'span' ? 'on' : ''} onClick={() => set({ type: 'span' })}>영역</button>
          </div>
        </div>
        <div className="row">
          <label>시작 연도</label>
          <NumberField value={event.start} onCommit={(v) => set({ start: v })} />
        </div>
        {event.type === 'span' && (
          <div className="row">
            <label>종료 연도</label>
            <NumberField value={event.end ?? 0} onCommit={(v) => set({ end: v })} />
          </div>
        )}
        <DisplayYearControl event={event} set={set} />
        <div className="row">
          <label>설명</label>
          <div className="field field-textarea">
            <textarea rows="3" value={event.description || ''} onChange={(e) => set({ description: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="group">
        <div className="group-title">위치 / 크기</div>
        <div className="row">
          <label>Y 좌표</label>
          {/* L-2 fix: max clamped to TOTAL_H */}
          <NumberField value={event.y} onCommit={(v) => set({ y: v })} max={TOTAL_H} suffix="px" />
        </div>
        <div className="row range-row">
          <label>0 ~ {TOTAL_H}</label>
          <input
            type="range"
            min={-LANE_H}
            max={TOTAL_H}
            value={event.y}
            onChange={(e) => set({ y: +e.target.value })}
          />
        </div>
        <div className="row">
          <label>{event.type === 'span' ? '높이' : '세로 길이'}</label>
          {/* L-2 fix: max clamped to TOTAL_H */}
          <NumberField value={event.heightPx} onCommit={(v) => set({ heightPx: v })} max={TOTAL_H} suffix="px" />
        </div>
        {event.type === 'span' && (
          <>
            <div className="row">
              <label>투명도</label>
              <div className="field">
                <input
                  type="number" min="0" max="100" step="5"
                  value={Math.round((event.fill ?? 0.15) * 100)}
                  onChange={(e) => set({ fill: clamp(+e.target.value, 0, 100) / 100 })}
                />
                <span className="field-sub">%</span>
              </div>
            </div>
            <div className="row">
              <label>z-순위</label>
              <div className="seg">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} className={event.z === n ? 'on' : ''} onClick={() => set({ z: n })}>{n}</button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="group">
        <div className="group-title">레이블</div>
        <div
          className="toggle"
          onClick={() => set({ labelAlign: event.labelAlign === 'left' ? 'right' : 'left' })}
        >
          <span className={`check ${event.labelAlign === 'left' ? 'on' : ''}`}>
            {event.labelAlign === 'left' ? '✓' : ''}
          </span>
          좌측 표기 (체크 해제 = 우측)
        </div>
        {event.type === 'span' && (
          <div className="toggle" onClick={() => set({ labelOutside: !event.labelOutside })}>
            <span className={`check ${event.labelOutside ? 'on' : ''}`}>
              {event.labelOutside ? '✓' : ''}
            </span>
            영역 외부 좌측 상단에 표기
          </div>
        )}
      </div>

      <div className="group">
        <div className="group-title">줌 레벨별 텍스트 표시</div>
        <div className="vis-row">
          {[0, 1, 2, 3, 4].map((i) => {
            const visArr = event.zoomVisibility || [true, true, true, true, true];
            const on = visArr[i];
            return (
              <div
                key={i}
                className={`vis-cell ${on ? 'on' : ''}`}
                onClick={() => {
                  const next = [...visArr];
                  next[i] = !next[i];
                  set({ zoomVisibility: next });
                }}
              >
                L{i + 1}
              </div>
            );
          })}
        </div>
      </div>

      <ConnectionEditor
        event={event} events={events} related={related}
        onConnAdd={onConnAdd} onConnRemove={onConnRemove}
      />

      {/* F-2: Delete event */}
      <div className="group" style={{ marginTop: 16 }}>
        <button
          className="tt-btn"
          style={{ width: '100%', justifyContent: 'center', color: '#ff9999', borderColor: 'rgba(255,100,100,0.35)' }}
          onClick={onDelete}
        >
          사건 삭제
        </button>
      </div>
    </div>
  );
}

export default function SidePanel({
  event, mode, onClose, onModeChange, onUpdate, onDelete,
  events, connections, onTitleClick, onChipClick,
  onConnAdd, onConnRemove, isAuthed, onRequestAuth,
}) {
  if (!event) return <aside className="tt-side" />;
  const set = (patch) => onUpdate({ ...event, ...patch });
  const related = useRelatedEvents(event, events, connections);

  const handleModeChange = (next) => {
    if (next === 'edit' && !isAuthed) {
      onRequestAuth(() => onModeChange('edit'));
      return;
    }
    onModeChange(next);
  };

  return (
    <aside className={`tt-side open ${mode === 'edit' ? 'edit' : 'view'}`}>
      <div className="ed-head">
        <div className="ed-headtxt">
          <div className="ed-meta">
            {event.type === 'span' ? '영역' : '스팟'}
            {event.type === 'span' ? ` · z=${event.z || '—'}` : ''}
          </div>
          <button className="ed-title" onClick={onTitleClick} title="클릭 시 사건 위치로 이동">
            {event.title}
          </button>
          <div className="ed-yr">
            {event.type === 'span'
              ? `${yearLabel(event.start)} ~ ${yearLabel(event.end)}`
              : yearLabel(event.start)}
          </div>
        </div>
        <button className="close" onClick={onClose} title="닫기">✕</button>
      </div>

      <div className="mode-tabs">
        <button className={mode === 'view' ? 'on' : ''} onClick={() => handleModeChange('view')}>설명</button>
        <button className={mode === 'edit' ? 'on' : ''} onClick={() => handleModeChange('edit')}>편집</button>
      </div>

      {mode === 'view' && (
        <div className="view-body">
          <p className="desc">
            {event.description || '이 사건에 대한 설명이 없습니다. 편집 탭에서 설명을 추가할 수 있습니다.'}
          </p>
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
            {event.type === 'span' && (
              <div>
                <span className="k">우선 순위</span>
                <span className="v">z = {event.z || '—'}</span>
              </div>
            )}
          </div>
          <div className="conn-block">
            <div className="block-title">연관 사건</div>
            <RelatedChips list={related} onChipClick={onChipClick} />
          </div>
        </div>
      )}

      {mode === 'edit' && (
        <EditFields
          event={event} set={set}
          events={events} related={related}
          onConnAdd={onConnAdd} onConnRemove={onConnRemove}
          onDelete={onDelete}
        />
      )}
    </aside>
  );
}
