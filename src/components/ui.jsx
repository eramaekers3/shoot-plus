import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { sheetOut, toastOut } from '../lib/motion.js';
import { logoSVG } from '../lib/logo.js';
import { createPortal } from 'react-dom';
import { useDragDismiss } from '../lib/dragDismiss.js';
import { useToast, dismissToast } from '../lib/toast.js';

export function useNow(ms = 30000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/* ---------- Logo ---------- */
export function LogoMark({ color, size = 30, className = 'logo-mark' }) {
  const html = useMemo(() => logoSVG(color, { id: `lm${String(color).replace(/\W/g, '')}` }), [color]);
  return <span className={className} style={{ width: size, height: size }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />;
}

/* ---------- Icons ---------- */
const paths = {
  home: <><path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19v-8.5Z" /></>,
  bookings: <><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /><path d="m9 14.6 2 2 4-4" /></>,
  stats: <><path d="M4 19.5V10M10 19.5V5M16 19.5v-7M21 19.5H3" /></>,
  clients: <><circle cx="9" cy="8.5" r="3.3" /><path d="M3 19.5c.6-3.3 3-5 6-5s5.4 1.7 6 5" /><path d="M15.5 5.6a3.2 3.2 0 0 1 0 6M17.5 14.8c1.9.6 3.1 2.2 3.5 4.7" /></>,
  pricing: <><path d="M3.8 12.7V5.2a1.4 1.4 0 0 1 1.4-1.4h7.5l7.5 7.5a1.6 1.6 0 0 1 0 2.2l-7.3 7.3a1.6 1.6 0 0 1-2.2 0l-6.9-8.1Z" /><circle cx="8.3" cy="8.3" r="1.5" /></>,
  camera: <><path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3v10H4v-10Z" /><circle cx="12" cy="13.2" r="3.4" /></>,
  video: <><rect x="3" y="6.5" width="12.5" height="11" rx="2.5" /><path d="m15.5 10.5 5.5-3v9l-5.5-3" /></>,
  settings: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></>,
  left: <path d="m14.5 6-6 6 6 6" />,
  right: <path d="m9.5 6 6 6-6 6" />,
  check: <path d="m5.5 12.5 4 4 9-9.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  grip: <><circle cx="9" cy="6.5" r="1.3" /><circle cx="15" cy="6.5" r="1.3" /><circle cx="9" cy="12" r="1.3" /><circle cx="15" cy="12" r="1.3" /><circle cx="9" cy="17.5" r="1.3" /><circle cx="15" cy="17.5" r="1.3" /></>,
  down: <path d="m6 9.5 6 6 6-6" />,
  pin: <><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.3" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  car: <><path d="M5 16.5V12l1.8-4.6A1.5 1.5 0 0 1 8.2 6.5h7.6a1.5 1.5 0 0 1 1.4.9L19 12v4.5" /><path d="M4 12h16v4.5H4z" /><path d="M6.5 16.5v2M17.5 16.5v2" /><circle cx="7.5" cy="14.2" r=".6" /><circle cx="16.5" cy="14.2" r=".6" /></>,
  user: <><circle cx="12" cy="8.5" r="3.6" /><path d="M5 20c.7-3.7 3.4-5.5 7-5.5s6.3 1.8 7 5.5" /></>,
  tax: <><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  out: <><path d="M14 4.5h5.5V10M19.5 4.5 11 13" /><path d="M17 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4" /></>,
  trash: <><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5" /></>,
  copy: <><rect x="8" y="8" width="11.5" height="11.5" rx="2.5" /><path d="M5.5 15.5H5A1.5 1.5 0 0 1 3.5 14V5A1.5 1.5 0 0 1 5 3.5h9A1.5 1.5 0 0 1 15.5 5v.5" /></>,
  phone: <path d="M6.5 3.5h3l1.5 4-2 1.3a10 10 0 0 0 5.2 5.2l1.3-2 4 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2Z" />,
  mail: <><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="m4 7 8 6 8-6" /></>,
  card: <><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M3 9.5h18M6.5 15h4" /></>,
  star: <path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6L12 4Z" />,
};
export function Icon({ name, size = 20 }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

/* ---------- Bottom sheet ---------- */

/**
 * The part of the screen you can actually see. On iPhone the keyboard slides over the page instead
 * of shrinking it, so sheets size themselves to this to stay above the keyboard.
 */
function useVisibleArea() {
  const read = () => {
    const vv = window.visualViewport;
    if (!vv) return null;
    return { top: vv.offsetTop, height: vv.height, keyboard: window.innerHeight - vv.height > 120 };
  };
  const [area, setArea] = useState(read);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    // Only follow real size changes (the keyboard opening or closing), not scrolling, and ignore
    // sub-pixel jitter: reacting to every scroll fights iPhone's own scroll-to-the-text-box and
    // makes the sheet jump back and forth.
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setArea((prev) => {
          const next = read();
          if (prev && next && Math.abs(prev.height - next.height) < 2 && Math.abs(prev.top - next.top) < 2) return prev;
          return next;
        })
      );
    };
    vv.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener('resize', update);
    };
  }, []);
  return area;
}

export function Sheet({ title, onClose, children, top = false }) {
  const area = useVisibleArea();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const sheetRef = useRef(null);
  const scrimRef = useRef(null);
  useDragDismiss(sheetRef, () => closeRef.current(), { scrim: scrimRef });
  // However it closes, the sheet animates out (see motion.js).
  useLayoutEffect(() => {
    const node = scrimRef.current;
    return () => sheetOut(node);
  }, []);
  // Runs once per sheet. (onClose is often a fresh function each render; re-running this on every
  // keystroke would unpin and re-pin the page, which makes it jump.)
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    // Pin the page in place while a sheet is open, so iPhone can't scroll it underneath.
    const y = window.scrollY;
    const b = document.body.style;
    const prev = { position: b.position, top: b.top, width: b.width, overflow: b.overflow };
    Object.assign(b, { position: 'fixed', top: `-${y}px`, width: '100%', overflow: 'hidden' });
    return () => {
      window.removeEventListener('keydown', onKey);
      Object.assign(b, prev);
      window.scrollTo(0, y);
    };
  }, []);
  return createPortal(
    <div
      ref={scrimRef}
      className={`scrim${top ? ' top' : ''}${area && area.keyboard ? ' kb' : ''}`}
      style={area ? { top: area.top, height: area.height, bottom: 'auto', '--vh': `${area.height}px` } : undefined}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={sheetRef}>
        <div className="grab-bar" aria-hidden="true" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1 }}>×</span>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

/* ---------- Toast ---------- */
export function Toaster() {
  const t = useToast();
  if (!t) return null;
  return <Toast t={t} key={t.key} />;
}

function Toast({ t }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const node = ref.current;
    return () => toastOut(node);
  }, []);
  return (
    <div className={`toast${t.action ? ' has-action' : ''}`} ref={ref} role="status">
      {t.text}
      {t.action && (
        <button
          className="toast-action"
          onClick={() => {
            t.action.run();
            dismissToast();
          }}
        >
          {t.action.label}
        </button>
      )}
    </div>
  );
}

/* ---------- Numbers that count up when they first appear or change ---------- */
const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function CountUp({ value, format = (v) => String(Math.round(v)), ms = 700 }) {
  const [shown, setShown] = useState(reduced() ? value : 0);
  const from = useRef(reduced() ? value : 0);
  useEffect(() => {
    if (reduced()) return setShown(value);
    const start = performance.now();
    const a = from.current;
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      const v = a + (value - a) * e;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, ms]);
  return <span className="count">{format(shown)}</span>;
}

/* ---------- Progress ring ---------- */
export function Ring({ p, size = 64, stroke = 7, color = 'var(--sun)', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, p || 0));
  return (
    <span className="ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} className="ring-fill" strokeWidth={stroke}
          style={{ stroke: color, strokeDasharray: c, '--off': c * (1 - v), '--full': c }}
        />
      </svg>
      <span className="ring-in">{children}</span>
    </span>
  );
}
