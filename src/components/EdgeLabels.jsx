export default function EdgeLabels({ canvasW }) {
  return (
    // overflow:hidden 으로 우측 레이블이 스크롤 영역을 확장하지 않도록 클립
    <div className="tt-edge-labels" aria-hidden style={{ overflow: 'hidden' }}>
      <div className="tt-edge-label left" style={{ left: 0 }}>
        <span className="line en">IN THE BEGINNING</span>
        <span className="line ko">영원 속 시간의 시작, 태초</span>
      </div>
      {/* 우측 레이블: right:0 고정으로 스크롤 영역 확장 없이 canvas 끝에 붙임 */}
      <div className="tt-edge-label right" style={{ right: 0, left: 'auto' }}>
        <span className="line ko">영원한 새 하늘과 새 땅</span>
        <span className="line en">NEW HEAVEN AND NEW EARTH</span>
      </div>
    </div>
  );
}
