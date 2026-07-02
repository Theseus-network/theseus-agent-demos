"use client";

import type { ResolvedRec } from "./useLiveFund";

const usd = (n: number, d = 0) => n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: d });
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${usd(Math.abs(n), 0)}`;

export function TrackRecord({ resolved }: { resolved: ResolvedRec[] }) {
  if (!resolved.length) {
    return (
      <p className="mt-4 text-[13px] leading-relaxed text-fg-dim">
        No bets have settled yet. As the markets the agent bet resolve, each call is scored here — right or wrong, with realized P&amp;L and the estimate it made.
      </p>
    );
  }
  const wins = resolved.filter((r) => r.won).length;
  const pnl = resolved.reduce((a, r) => a + r.pnl, 0);
  const hit = Math.round((wins / resolved.length) * 100);
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[13px] text-fg-mute">
        <span><span className="tabular-nums text-fg">{wins}/{resolved.length}</span> correct</span>
        <span><span className="tabular-nums text-fg">{hit}%</span> hit rate</span>
        <span>realized <span className="tabular-nums" style={{ color: pnl >= 0 ? "var(--coral)" : "var(--red)" }}>{signed(pnl)}</span></span>
      </div>
      <div className="mt-4 divide-y divide-border/60 overflow-hidden rounded-xl border border-border">
        {resolved.map((r, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `color-mix(in srgb, ${r.won ? "var(--coral)" : "var(--red)"} 15%, transparent)`, color: r.won ? "var(--coral)" : "var(--red)" }}>{r.won ? "WON" : "LOST"}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-fg">{r.question}</p>
              <p className="mt-0.5 font-mono text-[11px] text-fg-mute">{r.side} · agent est {r.est ?? "—"}% vs market {r.yesPct}%</p>
            </div>
            <span className="shrink-0 text-[13px] tabular-nums" style={{ color: r.pnl >= 0 ? "var(--coral)" : "var(--red)" }}>{signed(r.pnl)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
