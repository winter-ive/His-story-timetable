import { useState, useEffect } from 'react';

const INITIAL_PW = '9938';
const SECURITY_Q = 'fourmis pw';
const INITIAL_SEC_A = '9938';

async function sha256(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function ensureSeed() {
  if (!localStorage.getItem('tt-pw-hash')) {
    localStorage.setItem('tt-pw-hash', await sha256(INITIAL_PW));
  }
  if (!localStorage.getItem('tt-sec-q')) {
    localStorage.setItem('tt-sec-q', SECURITY_Q);
  }
  if (!localStorage.getItem('tt-sec-a-hash')) {
    localStorage.setItem('tt-sec-a-hash', await sha256(INITIAL_SEC_A));
  }
}

export default function PasswordModal({ open, onClose, onPass }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [stage, setStage] = useState('pw');
  const [secA, setSecA] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const secQ = localStorage.getItem('tt-sec-q') || SECURITY_Q;

  useEffect(() => {
    if (open) { setPw(''); setErr(''); setStage('pw'); setSecA(''); setNewPw(''); setNewPw2(''); }
  }, [open]);

  if (!open) return null;

  const tryPw = async () => {
    const h = await sha256(pw);
    if (h === localStorage.getItem('tt-pw-hash')) {
      sessionStorage.setItem('tt-auth', '1');
      onPass();
    } else {
      setErr('비밀번호가 맞지 않아요.');
    }
  };
  const tryRecover = async () => {
    const h = await sha256(secA.trim());
    if (h === localStorage.getItem('tt-sec-a-hash')) {
      setErr(''); setStage('recover-set');
    } else {
      setErr('보안 질문 답이 맞지 않아요.');
    }
  };
  const trySetNew = async () => {
    if (!newPw || newPw !== newPw2) { setErr('비밀번호가 일치하지 않아요.'); return; }
    localStorage.setItem('tt-pw-hash', await sha256(newPw));
    sessionStorage.setItem('tt-auth', '1');
    onPass();
  };

  return (
    <div className="tt-modal-backdrop open" onClick={onClose}>
      <div className="tt-modal pw-modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="ed-head">
          <div className="ed-headtxt">
            <div className="ed-meta">관리자</div>
            <div className="ed-title">
              {stage === 'pw' && '비밀번호 입력'}
              {stage === 'recover-q' && '보안 질문'}
              {stage === 'recover-set' && '새 비밀번호 설정'}
            </div>
          </div>
          <button className="close" onClick={onClose}>✕</button>
        </div>
        <div className="pw-body">
          {stage === 'pw' && (
            <>
              <input className="pw-input" type="password" autoFocus value={pw}
                onChange={(e) => setPw(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && tryPw()}
                placeholder="· · · ·"
              />
              {err && <div className="pw-err">{err}</div>}
              <button className="pw-submit" onClick={tryPw}>확인</button>
              <button className="pw-link" onClick={() => { setErr(''); setStage('recover-q'); }}>
                비밀번호를 잊으셨나요?
              </button>
            </>
          )}
          {stage === 'recover-q' && (
            <>
              <div className="pw-q">{secQ}</div>
              <input className="pw-input" type="text" autoFocus value={secA}
                onChange={(e) => setSecA(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && tryRecover()}
                placeholder="답"
              />
              {err && <div className="pw-err">{err}</div>}
              <button className="pw-submit" onClick={tryRecover}>확인</button>
              <button className="pw-link" onClick={() => { setErr(''); setStage('pw'); }}>← 비밀번호 입력으로</button>
            </>
          )}
          {stage === 'recover-set' && (
            <>
              <input className="pw-input" type="password" autoFocus value={newPw}
                onChange={(e) => setNewPw(e.target.value)} placeholder="새 비밀번호" />
              <input className="pw-input" type="password" value={newPw2}
                onChange={(e) => setNewPw2(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && trySetNew()}
                placeholder="비밀번호 확인"
              />
              {err && <div className="pw-err">{err}</div>}
              <button className="pw-submit" onClick={trySetNew}>변경하고 접속</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
