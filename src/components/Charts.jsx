import { short } from '../lib/biz.js';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/**
 * Twelve bars, one per month: what you kept (accent) on top of what it cost (muted).
 * Tap a month to pick it. Bars spring up from the baseline, one after another.
 */
export function MonthBars({ months, picked, onPick, current }) {
  const W = 340, H = 150, L = 34, R = 4, T = 10, B = 20;
  const max = Math.max(1, ...months.map((m) => m.gross));
  const nice = niceMax(max);
  const bw = (W - L - R) / Math.max(6, months.length);
  const y = (v) => T + (H - T - B) * (1 - v / nice);
  return (
    <svg className="chart bars" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Income by month">
      {[0, nice / 2, nice].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid" />
          <text x={L - 6} y={y(v) + 4} textAnchor="end">{short(v)}</text>
        </g>
      ))}
      {months.map((m, i) => {
        const x = L + i * bw + bw * 0.16;
        const w = bw * 0.68;
        const keep = Math.max(0, m.profit);
        const hAll = (H - T - B) * (m.gross / nice);
        const hKeep = (H - T - B) * (keep / nice);
        const on = picked === m.ym;
        return (
          <g key={m.ym} className={`bar${on ? ' on' : ''}${current === m.ym ? ' now' : ''}`} style={{ '--i': i }} onClick={() => onPick && onPick(on ? null : m.ym)}>
            <rect x={L + i * bw} y={T} width={bw} height={H - T - B} className="hit" />
            {m.gross > 0 && (
              <g className="grow" style={{ transformOrigin: `${x + w / 2}px ${H - B}px` }}>
                <rect x={x} y={H - B - hAll} width={w} height={hAll} rx="4" className="b-cost" />
                <rect x={x} y={H - B - hKeep} width={w} height={hKeep} rx="4" className="b-keep" />
              </g>
            )}
            <text x={x + w / 2} y={H - 5} textAnchor="middle" className="b-lab">{m.label ?? MONTHS[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Income piling up through the year, with last year dashed behind it. */
export function CumLine({ cur, prev, todayDay }) {
  const W = 340, H = 140, L = 38, R = 8, T = 10, B = 20;
  const max = niceMax(Math.max(1, ...cur.map((p) => p.v), ...prev.map((p) => p.v)));
  const x = (d) => L + (W - L - R) * (d / 365);
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const steps = (pts, end) => {
    const out = [];
    pts.forEach((p, i) => {
      if (i) out.push(`${x(p.d)},${y(pts[i - 1].v)}`);
      out.push(`${x(p.d)},${y(p.v)}`);
    });
    if (end != null && pts.length) out.push(`${x(end)},${y(pts.at(-1).v)}`);
    return out.join(' ');
  };
  const quarterX = [0, 90, 181, 273];
  return (
    <svg className="chart cum-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Income so far this year compared with last year">
      {[0, max / 2, max].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid" />
          <text x={L - 6} y={y(v) + 4} textAnchor="end">{short(v)}</text>
        </g>
      ))}
      {quarterX.map((d, i) => <text key={d} x={x(d) + 2} y={H - 5}>{['Jan', 'Apr', 'Jul', 'Oct'][i]}</text>)}
      {prev.length > 1 && <polyline points={steps(prev, 365)} className="prev" />}
      <polyline points={steps(cur, todayDay)} className="cur draw" pathLength="1" />
      {cur.length > 0 && <circle cx={x(todayDay ?? cur.at(-1).d)} cy={y(cur.at(-1).v)} r="4" className="end-dot" />}
    </svg>
  );
}

/** One bar split into colored parts (services, payment methods…). */
export function SplitBar({ parts }) {
  const total = parts.reduce((t, p) => t + p.v, 0) || 1;
  return (
    <div className="split" aria-hidden="true">
      {parts.map((p, i) => <i key={p.key} style={{ width: `${(p.v / total) * 100}%`, background: p.c, '--i': i }} />)}
    </div>
  );
}

/** Rows of label, bar and amount. Rows with onPick can be tapped. */
export function BarRows({ rows, format, onPick }) {
  const max = Math.max(1, ...rows.map((r) => r.v));
  return (
    <ul className="bar-rows">
      {rows.map((r, i) => {
        const inner = (
          <>
            <span className="br-name">{r.c && <i style={{ background: r.c }} />}{r.label}</span>
            <span className="br-bar"><i style={{ width: `${(r.v / max) * 100}%`, background: r.c || 'var(--sun)', '--i': i }} /></span>
            <b>{format(r.v)}{r.sub && <small>{r.sub}</small>}</b>
          </>
        );
        return <li key={r.key}>{onPick ? <button onClick={() => onPick(r)}>{inner}</button> : <div>{inner}</div>}</li>;
      })}
    </ul>
  );
}

/** Seven small columns, Monday to Sunday. */
export function WeekdayBars({ counts }) {
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const max = Math.max(1, ...counts);
  const top = counts.indexOf(Math.max(...counts));
  return (
    <div className="wd-bars">
      {counts.map((n, i) => (
        <div key={i} className={i === top && n ? 'top' : ''}>
          <span className="wd-col"><i style={{ height: `${(n / max) * 100}%`, '--i': i }} /></span>
          <b>{n}</b>
          <span>{names[i]}</span>
        </div>
      ))}
    </div>
  );
}

function niceMax(v) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
