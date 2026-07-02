"use client";

// The fund's value per share against holding ETH. The historical span is the
// 9-month backtest; when `liveFrom` is set, everything past that index is live
// NAV recorded from the running fund, and the endpoint pulses.

interface Props {
  net: number[];
  hold: number[];
  startISO: string;
  upTo?: number;
  liveFrom?: number;
}

const W = 680;
const H = 200;
const AXL = 38; // left gutter for return labels
const AXB = 18; // bottom gutter for month labels
const TOP = 16;
const RIGHT = 60; // end-of-line labels

const idx = (s: number[]) => s.map((v) => v / (s[0] || 1));
const r2 = (n: number) => Math.round(n * 100) / 100;

function niceStep(range: number): number {
  const raw = range / 3;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm >= 5 ? 5 : norm >= 2 ? 2 : 1;
  return step * mag;
}

export function VaultChart({ net, hold, startISO, upTo, liveFrom }: Props) {
  const n = Math.max(2, Math.min(net.length, (upTo ?? net.length - 1) + 1));
  const N = idx(net), Hb = idx(hold);
  const all = [...N.slice(0, n), ...Hb.slice(0, n), 1];
  const min = Math.min(...all), max = Math.max(...all);
  const pad = (max - min) * 0.045 || 0.02;
  const lo = min - pad, hi = max + pad;

  const plotL = AXL, plotR = W - RIGHT, plotT = TOP, plotB = H - AXB;
  const X = (i: number) => r2(plotL + (i / (net.length - 1)) * (plotR - plotL));
  const Y = (v: number) => r2(plotB - ((v - lo) / (hi - lo)) * (plotB - plotT));
  const line = (s: number[]) => s.slice(0, n).map((v, i) => `${i === 0 ? "M" : "L"}${X(i)},${Y(v)}`).join(" ");

  // Y gridlines at round return %
  const step = niceStep((hi - lo) * 100);
  const ticks: number[] = [];
  for (let p = Math.ceil((lo - 1) * 100 / step) * step; p <= (hi - 1) * 100 + 1e-6; p += step) ticks.push(r2(p));

  // X month labels span only the historical (backtest) portion.
  const histN = liveFrom && liveFrom > 1 ? liveFrom : n;
  const start = new Date(startISO + "T00:00:00Z");
  const totalDays = (histN - 1) * 7;
  const xticks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const d = new Date(start.getTime() + f * totalDays * 86400000);
    return { x: X(f * (histN - 1)), label: d.toLocaleDateString(undefined, { month: "short", timeZone: "UTC" }) };
  });

  const lastI = n - 1;
  const netD = line(N);
  const areaD = `${netD} L${X(lastI)},${plotB} L${X(0)},${plotB} Z`;
  const pct = (v: number) => `${v - 1 >= 0 ? "+" : "−"}${(Math.abs(v - 1) * 100).toFixed(1)}%`;
  const isLive = liveFrom != null && liveFrom > 0 && liveFrom < n;
  const bx = isLive ? X(liveFrom!) : 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Fund value per share versus holding ETH">
      {/* Y grid + labels */}
      {ticks.map((p) => {
        const y = Y(1 + p / 100);
        return (
          <g key={p}>
            <line x1={plotL} x2={plotR} y1={y} y2={y} style={{ stroke: "var(--border)", opacity: p === 0 ? 0.7 : 0.35 }} strokeWidth={p === 0 ? 1 : 0.75} />
            <text x={plotL - 7} y={y + 3} textAnchor="end" style={{ fill: "var(--fg-mute)" }} fontSize="9.5" className="tabular-nums">{p > 0 ? "+" : ""}{p}%</text>
          </g>
        );
      })}
      {/* X labels */}
      {xticks.map((t, i) => (
        <text key={i} x={t.x} y={plotB + 13} textAnchor="middle" style={{ fill: "var(--fg-mute)" }} fontSize="9.5">{t.label}</text>
      ))}
      {/* live region marker */}
      {isLive && (
        <>
          <rect x={bx} y={plotT} width={r2(plotR - bx)} height={r2(plotB - plotT)} style={{ fill: "var(--coral)", opacity: 0.05 }} />
          <line x1={bx} x2={bx} y1={plotT} y2={plotB} style={{ stroke: "var(--coral)", opacity: 0.4 }} strokeWidth={0.75} strokeDasharray="2 3" />
          <text x={r2(bx + 4)} y={plotT + 9} style={{ fill: "var(--coral)", opacity: 0.9 }} fontSize="8" letterSpacing="0.5">LIVE</text>
        </>
      )}
      <path d={areaD} style={{ fill: "var(--coral)", opacity: 0.08 }} />
      <path d={line(Hb)} fill="none" style={{ stroke: "var(--fg-dim)", opacity: 0.6 }} strokeWidth={1.5} />
      <path d={netD} fill="none" style={{ stroke: "var(--coral)" }} strokeWidth={2.5} />
      {isLive && (
        <circle cx={X(lastI)} cy={Y(N[lastI])} r={3.5} fill="none" style={{ stroke: "var(--coral)" }} strokeWidth={1.2}>
          <animate attributeName="r" from="3.5" to="10" dur="1.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.7" to="0" dur="1.6s" repeatCount="indefinite" />
        </circle>
      )}
      <circle cx={X(lastI)} cy={Y(N[lastI])} r={3.5} style={{ fill: "var(--coral)" }} />
      <text x={X(lastI) + 7} y={Y(N[lastI]) + 3.5} style={{ fill: "var(--coral)" }} fontSize="11" fontWeight="600" className="tabular-nums">{pct(N[lastI])}</text>
      <text x={X(lastI) + 7} y={Y(Hb[lastI]) + 3.5} style={{ fill: "var(--fg-mute)" }} fontSize="10" className="tabular-nums">{pct(Hb[lastI])}</text>
    </svg>
  );
}
