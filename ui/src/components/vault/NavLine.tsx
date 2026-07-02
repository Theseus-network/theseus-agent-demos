"use client";

import type { NavPoint } from "./useLiveFund";

/**
 * The NAV line — the product surface. Net asset value per share over time,
 * sampled on-chain. Anchored at launch (1.0000) and tipped with the live price
 * so the line reads from day one; the y-domain always includes breakeven and
 * never magnifies sub-cent noise into drama.
 */
export function NavLine({ history, startedAt, pps }: { history: NavPoint[]; startedAt: number; pps: number | undefined }) {
  const now = Date.now();
  const cur = pps ?? (history.length ? history[history.length - 1].pps : 1);

  // Build the series: launch anchor → samples → live tip.
  const pts: { t: number; v: number }[] = [{ t: startedAt || (history[0]?.t ?? now), v: 1 }];
  for (const h of history) pts.push({ t: h.t, v: h.pps });
  pts.push({ t: now, v: cur });
  pts.sort((a, b) => a.t - b.t);

  const t0 = pts[0].t;
  const t1 = Math.max(pts[pts.length - 1].t, t0 + 1);
  const vals = pts.map((p) => p.v);
  const lo = Math.min(0.99, ...vals);
  const hi = Math.max(1.01, ...vals);
  const pad = (hi - lo) * 0.12 || 0.01;
  const yLo = lo - pad, yHi = hi + pad;

  const W = 1000, H = 260;
  const x = (t: number) => ((t - t0) / (t1 - t0)) * W;
  const y = (v: number) => H - ((v - yLo) / (yHi - yLo)) * H;
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const yBreak = y(1);

  const ret = cur - 1;
  const up = ret >= 0;
  const stroke = up ? "#34d399" : "#f87171";
  const days = Math.max(0, Math.floor((now - (startedAt || now)) / 86_400_000));

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[12px] uppercase tracking-wide text-fg-mute">NAV / share</p>
          <p className="mt-1 font-mono text-[40px] leading-none tracking-tight text-fg tabular-nums sm:text-[52px]">
            ${cur.toFixed(4)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[12px] uppercase tracking-wide text-fg-mute">Since launch</p>
          <p className="mt-1 font-mono text-[24px] leading-none tabular-nums sm:text-[28px]" style={{ color: stroke }}>
            {up ? "+" : "−"}{Math.abs(ret * 100).toFixed(2)}%
          </p>
          <p className="mt-1 text-[11.5px] text-fg-mute">{days === 0 ? "day one" : `${days} day${days === 1 ? "" : "s"} live`}</p>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-bg/30">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[220px] w-full sm:h-[260px]">
          <defs>
            <linearGradient id="navfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.20" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* breakeven line */}
          <line x1="0" y1={yBreak} x2={W} y2={yBreak} stroke="var(--border)" strokeWidth="1" strokeDasharray="4 5" />
          <path d={area} fill="url(#navfill)" />
          <path d={line} fill="none" stroke={stroke} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(pts[pts.length - 1].t)} cy={y(cur)} r="4" fill={stroke} />
        </svg>
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-fg-mute">
        <span>launch · $1.0000</span>
        <span>breakeven ┄ $1.0000</span>
        <span>now · ${cur.toFixed(4)}</span>
      </div>
    </div>
  );
}
