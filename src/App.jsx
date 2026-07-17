import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import HorizontalTimeline from "./components/HorizontalTimeline.jsx";
import SidePanel from "./components/SidePanel.jsx";
import MobileModal from "./components/MobileModal.jsx";
import PasswordModal, { ensureSeed } from "./components/PasswordModal.jsx";
import {
  interpZoom,
  clamp,
  viewCenterYear,
} from "./utils.js";
import {
  CONNECTIONS_INITIAL,
  RANGE,
  ZOOM_LEVELS,
  PAD_LEFT,
  LANE_H,
  TOTAL_H,
} from "./data.js";

// ============================================================
// Google Sheets API endpoint
// ============================================================
const SHEETS_API = "/api/sheets";

function parseEventsFromSheets(rows) {
  return rows.map((ev) => ({
    ...ev,
    start: Number(ev.start),
    end: ev.end !== "" && ev.end != null ? Number(ev.end) : undefined,
    y: Number(ev.y),
    heightPx: Number(ev.heightPx),
    z: Number(ev.z),
    zoomVisibility: [true, true, true, true, true],
  }));
}

async function fetchEventsFromSheets() {
  const res = await fetch("/api/sheets");
  const data = await res.json();
  return parseEventsFromSheets(data.events);
}

async function saveEventsToSheets(events) {
  const payload = events.map((ev) => ({
    id: ev.id, lane: ev.lane, type: ev.type,
    start: ev.start, end: ev.end ?? "",
    title: ev.title, y: ev.y, heightPx: ev.heightPx,
    z: ev.z ?? 1, labelAlign: ev.labelAlign ?? "right",
    description: ev.description ?? "",
  }));
  await fetch("/api/sheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events: payload }),
  });
}

async function saveEventsToSheets(events) {
  const payload = events.map((ev) => ({
    id: ev.id,
    lane: ev.lane,
    type: ev.type,
    start: ev.start,
    end: ev.end ?? "",
    title: ev.title,
    y: ev.y,
    heightPx: ev.heightPx,
    z: ev.z ?? 1,
    labelAlign: ev.labelAlign ?? "right",
    description: ev.description ?? "",
  }));
  await fetch(SHEETS_API, {
    method: "POST",
    body: JSON.stringify({ events: payload }),
  });
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isMobile;
}

function ZoomControl({ zoom, levelInfo, onStep }) {
  const lvl = Math.round(zoom);
  return (
    <div className="tt-zoom">
      <button className="iconbtn" onClick={() => onStep(-0.5)}>
        −
      </button>
      <span className="level-label">
        <span className="lv">Lv {lvl}</span>
        {levelInfo.label}
      </span>
      <button className="iconbtn" onClick={() => onStep(+0.5)}>
        ＋
      </button>
    </div>
  );
}

export default function App() {
  const isMobile = useIsMobile();

  // ── 데이터 로딩 상태 ──────────────────────────────────────
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle"); // "idle" | "saving" | "saved" | "error"

  const [connections, setConnections] = useState(CONNECTIONS_INITIAL);
  const [selectedId, setSelectedId] = useState(null);
  const [panelMode, setPanelMode] = useState("view");
  const [zoom, setZoom] = useState(2);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewW, setViewW] = useState(window.innerWidth);
  const [isAuthed, setIsAuthed] = useState(
    () => sessionStorage.getItem("tt-auth") === "1",
  );
  const [pwOpen, setPwOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("tt-theme") === "dark",
  );

  const pwCallbackRef = useRef(null);
  const scrollRef = useRef(null);
  const canvasRef = useRef(null);
  const scaleRef = useRef(interpZoom(2).scale);
  const zoomRef = useRef(2);
  const pinchRef = useRef(null);
  const pendingTransformClearRef = useRef(false);
  // 저장 디바운스용 타이머
  const saveTimerRef = useRef(null);

  useEffect(() => {
    ensureSeed();
  }, []);

  // ── Google Sheets에서 초기 데이터 로드 ───────────────────
  useEffect(() => {
    fetchEventsFromSheets()
      .then((evs) => {
        setEvents(evs);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Sheets 로드 실패:", err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      darkMode ? "dark" : "light",
    );
    localStorage.setItem("tt-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  // ── events 변경 시 Sheets에 디바운스 저장 (2초) ──────────
  const isMounted = useRef(false);
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return; // 초기 로드 시에는 저장 안 함
    }
    if (events.length === 0) return;
    clearTimeout(saveTimerRef.current);
    setSaveStatus("saving");
    saveTimerRef.current = setTimeout(() => {
      saveEventsToSheets(events)
        .then(() => setSaveStatus("saved"))
        .catch(() => setSaveStatus("error"));
    }, 2000);
  }, [events]);

  const levelInfo = useMemo(() => interpZoom(zoom), [zoom]);
  const scale = levelInfo.scale;
  scaleRef.current = scale;
  zoomRef.current = zoom;

  useLayoutEffect(() => {
    if (pendingTransformClearRef.current && canvasRef.current) {
      canvasRef.current.style.transform = "";
      canvasRef.current.style.transformOrigin = "";
      pendingTransformClearRef.current = false;
    }
  }, [zoom]);

  const selected = events.find((e) => e.id === selectedId) || null;

  const relatedIds = useMemo(() => {
    if (!selectedId) return new Set();
    const out = new Set();
    connections.forEach((c) => {
      if (c.from === selectedId) out.add(c.to);
      else if (c.to === selectedId) out.add(c.from);
    });
    return out;
  }, [selectedId, connections]);

  // Initial scroll to AD 0
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    let raf1, raf2;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const lv2Scale = ZOOM_LEVELS[1].scale;
        const x = (0 - RANGE.min) * lv2Scale + PAD_LEFT - sc.clientWidth / 2;
        sc.scrollLeft = Math.max(0, x);
        setScrollLeft(sc.scrollLeft);
        setViewW(sc.clientWidth);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll + resize tracking
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const onScroll = () => setScrollLeft(sc.scrollLeft);
    const onResize = () => setViewW(sc.clientWidth);
    sc.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    onResize();
    return () => {
      sc.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setSelectedId(null);
      const t = e.target;
      const inForm =
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable);
      if (inForm) return;
      if (e.key === "+" || e.key === "=") setZoom((z) => clamp(z + 0.5, 1, 5));
      if (e.key === "-" || e.key === "_") setZoom((z) => clamp(z - 0.5, 1, 5));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Drag-to-scroll
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    let isDown = false,
      startX = 0,
      startScroll = 0;
    const md = (e) => {
      if (
        e.target.closest(".tt-event-seg") ||
        e.target.closest(".tt-side") ||
        e.target.closest(".tt-modal")
      )
        return;
      isDown = true;
      startX = e.clientX;
      startScroll = sc.scrollLeft;
      sc.style.cursor = "grabbing";
    };
    const mu = () => {
      isDown = false;
      sc.style.cursor = "";
    };
    const mm = (e) => {
      if (!isDown) return;
      sc.scrollLeft = startScroll - (e.clientX - startX);
    };
    sc.addEventListener("mousedown", md);
    window.addEventListener("mouseup", mu);
    window.addEventListener("mousemove", mm);
    return () => {
      sc.removeEventListener("mousedown", md);
      window.removeEventListener("mouseup", mu);
      window.removeEventListener("mousemove", mm);
    };
  }, []);

  // Wheel zoom + pinch zoom
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;

    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = -e.deltaY * 0.005;
      const rect = sc.getBoundingClientRect();
      const viewOffset = e.clientX - rect.left;

      setZoom((prevZoom) => {
        const nextZoom = clamp(prevZoom + delta, 1, 5);
        const ratio = interpZoom(nextZoom).scale / interpZoom(prevZoom).scale;
        const targetScroll = (sc.scrollLeft + viewOffset) * ratio - viewOffset;
        requestAnimationFrame(() => {
          if (sc) sc.scrollLeft = Math.max(0, targetScroll);
        });
        return nextZoom;
      });
    };

    const onTouchStart = (e) => {
      if (e.touches.length !== 2) return;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const rect = sc.getBoundingClientRect();
      const canvasAnchorX = sc.scrollLeft + (midX - rect.left);
      pinchRef.current = {
        startDist: dist,
        startZoomLevel: zoomRef.current,
        canvasAnchorX,
        viewOffset: midX - rect.left,
        startScrollLeft: sc.scrollLeft,
        cumulativeRatio: 1,
      };
    };
    const onTouchMove = (e) => {
      if (e.touches.length !== 2 || !pinchRef.current) return;
      e.preventDefault();
      const newDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      const ratio = newDist / pinchRef.current.startDist;
      pinchRef.current.cumulativeRatio = ratio;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const { canvasAnchorX } = pinchRef.current;
      canvas.style.transformOrigin = `${canvasAnchorX}px center`;
      canvas.style.transform = `scaleX(${ratio})`;
    };
    const onTouchEnd = () => {
      const p = pinchRef.current;
      pinchRef.current = null;
      if (!p) return;

      const { cumulativeRatio, viewOffset, startScrollLeft, startZoomLevel } = p;
      const nextZoom = clamp(startZoomLevel + (cumulativeRatio - 1) * 3, 1, 5);
      const oldScale = interpZoom(startZoomLevel).scale;
      const newScale = interpZoom(nextZoom).scale;
      const scaleRatio = newScale / oldScale;
      const targetScroll = Math.max(0, (startScrollLeft + viewOffset) * scaleRatio - viewOffset);

      sc.scrollLeft = targetScroll;
      pendingTransformClearRef.current = true;
      setZoom(nextZoom);
    };

    const onTouchCancel = () => {
      pinchRef.current = null;
      if (canvasRef.current) {
        canvasRef.current.style.transform = "";
        canvasRef.current.style.transformOrigin = "";
      }
    };

    sc.addEventListener("wheel", onWheel, { passive: false });
    sc.addEventListener("touchstart", onTouchStart, { passive: true });
    sc.addEventListener("touchmove", onTouchMove, { passive: false });
    sc.addEventListener("touchend", onTouchEnd);
    sc.addEventListener("touchcancel", onTouchCancel);
    return () => {
      sc.removeEventListener("wheel", onWheel);
      sc.removeEventListener("touchstart", onTouchStart);
      sc.removeEventListener("touchmove", onTouchMove);
      sc.removeEventListener("touchend", onTouchEnd);
      sc.removeEventListener("touchcancel", onTouchCancel);
    };
  }, []);

  const stepZoom = useCallback(
    (dir) => setZoom((z) => clamp(Math.round((z + dir) * 2) / 2, 1, 5)),
    [],
  );

  const scrollToEvent = useCallback(
    (evOrId) => {
      const ev =
        typeof evOrId === "string"
          ? events.find((e) => e.id === evOrId)
          : evOrId;
      if (!ev || !scrollRef.current) return;
      const sc = scrollRef.current;
      const evX = (ev.start - RANGE.min) * scale + PAD_LEFT;
      const panelW = !isMobile && selectedId ? 300 : 0;
      const visibleW = sc.clientWidth - panelW;
      const target = evX - visibleW / 2;
      sc.scrollTo({
        left: clamp(target, 0, sc.scrollWidth - sc.clientWidth),
        behavior: "smooth",
      });
    },
    [events, scale, isMobile, selectedId],
  );

  const handleReset = useCallback(() => {
    setZoom(1);
    const lv1Scale = ZOOM_LEVELS[0].scale;
    if (scrollRef.current) {
      const sc = scrollRef.current;
      const x = (0 - RANGE.min) * lv1Scale + PAD_LEFT - sc.clientWidth / 2;
      sc.scrollTo({ left: clamp(x, 0, sc.scrollWidth), behavior: "smooth" });
    }
  }, []);

  const handleSelect = (id) => {
    setSelectedId(id);
    setPanelMode("view");
  };
  const handleClose = () => setSelectedId(null);
  const handleUpdate = (updated) => {
    setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  };

  const onTitleClick = useCallback(() => {
    if (isMobile) return;
    if (selected) scrollToEvent(selected);
  }, [isMobile, selected, scrollToEvent]);

  const onChipClick = useCallback(
    (id) => {
      scrollToEvent(id);
      if (isMobile) handleSelect(id);
    },
    [scrollToEvent, isMobile],
  );

  const addConnection = useCallback((fromId, toId) => {
    setConnections((prev) => {
      const exists = prev.some(
        (c) =>
          (c.from === fromId && c.to === toId) ||
          (c.from === toId && c.to === fromId),
      );
      if (exists) return prev;
      return [...prev, { from: fromId, to: toId }];
    });
  }, []);

  const removeConnection = useCallback((fromId, toId) => {
    setConnections((prev) =>
      prev.filter(
        (c) =>
          !(
            (c.from === fromId && c.to === toId) ||
            (c.from === toId && c.to === fromId)
          ),
      ),
    );
  }, []);

  const requestAuth = useCallback((cb) => {
    pwCallbackRef.current = cb;
    setPwOpen(true);
  }, []);

  const onPwPass = useCallback(() => {
    setIsAuthed(true);
    setPwOpen(false);
    const cb = pwCallbackRef.current;
    pwCallbackRef.current = null;
    if (cb) cb();
  }, []);

  // F-1: Add event
  const handleAddEvent = useCallback(() => {
    if (!isAuthed) {
      requestAuth(() => handleAddEvent());
      return;
    }
    const sc = scrollRef.current;
    const centerYear = sc
      ? viewCenterYear(sc.scrollLeft, sc.clientWidth, scale, RANGE.min)
      : 0;
    const newId = `ev-${Date.now()}`;
    const newEvent = {
      id: newId,
      lane: "world",
      type: "spot",
      start: centerYear,
      title: "새 사건",
      y: LANE_H / 2,
      heightPx: 50,
      labelAlign: "right",
      description: "",
      zoomVisibility: [true, true, true, true, true],
    };
    setEvents((prev) => [...prev, newEvent]);
    setSelectedId(newId);
    setPanelMode("edit");
  }, [isAuthed, requestAuth, scale]);

  // F-2: Delete event
  const handleDeleteEvent = useCallback(() => {
    if (!selectedId) return;
    if (!window.confirm("이 사건을 삭제할까요?")) return;
    setEvents((prev) => prev.filter((e) => e.id !== selectedId));
    setConnections((prev) =>
      prev.filter((c) => c.from !== selectedId && c.to !== selectedId),
    );
    setSelectedId(null);
  }, [selectedId]);

  const editingId = panelMode === "edit" && isAuthed ? selectedId : null;

  const handleDragUpdate = useCallback((evId, dYear, dPx) => {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== evId) return e;
        const newStart = e.start + dYear;
        const newEnd = e.end != null ? e.end + dYear : e.end;
        const newY = clamp(e.y + dPx, -LANE_H, TOTAL_H + LANE_H);
        return {
          ...e,
          start: newStart,
          ...(newEnd != null ? { end: newEnd } : {}),
          y: newY,
        };
      }),
    );
  }, []);

  const onStageClick = (e) => {
    if (e.target.closest(".tt-event-seg")) return;
    if (e.target.closest(".tt-side")) return;
    if (e.target.closest(".tt-modal")) return;
    setSelectedId(null);
  };

  // ── 저장 상태 표시 텍스트 ─────────────────────────────────
  const saveStatusLabel =
    saveStatus === "saving" ? "저장 중…" :
    saveStatus === "saved"  ? "저장됨 ✓" :
    saveStatus === "error"  ? "저장 실패 ✗" : "";

  return (
    <div className="app">
      <header className="tt-header">
        <div className="top-row">
          <div className="tt-brand">
            <h1 className="brand-name" aria-label="HIS STORY TIMETABLE">
              <span className="b-his-s">HI</span>
              <span className="b-his-s">S</span>
              <span className="b-story-s">S</span>
              <span>TORY</span>
              <span className="b-timetable">TIMETABLE</span>
            </h1>
          </div>
          {!isMobile && <div className="tt-spacer" />}
          {!isMobile && (
            <div className="tt-controls desktop-only">
              {saveStatusLabel && (
                <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>
                  {saveStatusLabel}
                </span>
              )}
              <ZoomControl
                zoom={zoom}
                levelInfo={levelInfo}
                onStep={stepZoom}
              />
              <button
                className="tt-btn icon-only"
                title="초기화"
                onClick={handleReset}
              >
                <span className="ic">⤺</span>
              </button>
              <button
                className={`tt-btn icon-only ${darkMode ? "on" : ""}`}
                title={darkMode ? "라이트 모드로 전환" : "다크 모드로 전환"}
                onClick={() => setDarkMode((v) => !v)}
              >
                <span className="ic">{darkMode ? "◑" : "◐"}</span>
              </button>
              <button className="tt-btn primary" onClick={handleAddEvent}>
                <span className="ic">＋</span> 사건 추가
              </button>
            </div>
          )}
        </div>
        {isMobile && (
          <div className="mobile-controls">
            <button
              className="tt-btn icon-only"
              title="초기화"
              onClick={handleReset}
            >
              <span className="ic">⤺</span>
            </button>
            <ZoomControl zoom={zoom} levelInfo={levelInfo} onStep={stepZoom} />
            <button
              className={`tt-btn icon-only ${darkMode ? "on" : ""}`}
              title={darkMode ? "라이트 모드로 전환" : "다크 모드로 전환"}
              onClick={() => setDarkMode((v) => !v)}
            >
              <span className="ic">{darkMode ? "◑" : "◐"}</span>
            </button>
          </div>
        )}
      </header>

      <main className="tt-stage" onClick={onStageClick}>
        {loading ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: "100%", fontSize: "1rem", opacity: 0.6
          }}>
            데이터 불러오는 중…
          </div>
        ) : (
          <div className="tt-scroll" ref={scrollRef}>
            <HorizontalTimeline
              events={events}
              connections={connections}
              range={RANGE}
              scale={scale}
              level={zoom}
              levelInfo={levelInfo}
              onSelect={handleSelect}
              selectedId={selectedId}
              relatedIds={relatedIds}
              scrollLeft={scrollLeft}
              viewW={viewW}
              editingId={editingId}
              onDragUpdate={handleDragUpdate}
              canvasRef={canvasRef}
            />
          </div>
        )}
        {!isMobile && selected && (
          <SidePanel
            event={selected}
            mode={panelMode}
            onClose={handleClose}
            onModeChange={setPanelMode}
            onUpdate={handleUpdate}
            onDelete={handleDeleteEvent}
            events={events}
            connections={connections}
            onTitleClick={onTitleClick}
            onChipClick={onChipClick}
            onConnAdd={addConnection}
            onConnRemove={removeConnection}
            isAuthed={isAuthed}
            onRequestAuth={requestAuth}
          />
        )}
      </main>

      <footer className="tt-footer">
        <span className="copyright">
          © Winterive All rights reserved. In God we trust.
        </span>
      </footer>

      {isMobile && (
        <MobileModal
          event={selected}
          open={!!selectedId}
          onClose={handleClose}
          events={events}
          connections={connections}
          onChipClick={onChipClick}
        />
      )}

      <PasswordModal
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        onPass={onPwPass}
      />
    </div>
  );
}
