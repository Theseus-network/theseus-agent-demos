"use client";

import type { Position } from "./useLiveFund";
import { EdgeBar } from "./EdgeBar";

const usd = (n: number, d = 0) => n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: d });
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${usd(Math.abs(n), 0)}`;

export function PredictionBook({ positions, explorer }: { positions: Position[]; explorer?: string }) {
  if (!positions.length) {
    return <p className="mt-4 text-[13px] text-fg-dim">No open positions yet. The book fills as the agent takes trades.</p>;
  }
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-border">
      <div className="grid grid-cols-[1fr_52px_180px_88px] items-center gap-4 border-b border-border px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-fg-mute">
        <span>Market</span>
        <span className="text-center">Side</span>
        <span>Market vs agent</span>
        <span className="text-right">Value / P&amp;L</span>
      </div>
      <div className="divide-y divide-border/60">
        {positions.map((p) => (
          <div key={p.id} className="grid grid-cols-[1fr_52px_180px_88px] items-center gap-4 px-4 py-3.5">
            <div className="min-w-0">
              <a href={p.url || "https://polymarket.com"} target="_blank" rel="noopener noreferrer" className="block truncate text-[13px] text-fg hover:text-coral">{p.question}</a>
              {p.runSeq >= 0 && explorer && (
                <a href={explorer} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-block font-mono text-[10.5px] text-fg-mute hover:text-coral">run #{p.runSeq} ↗</a>
              )}
            </div>
            <div className="text-center">
              <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `color-mix(in srgb, ${p.side === "YES" ? "var(--coral)" : "var(--red)"} 15%, transparent)`, color: p.side === "YES" ? "var(--coral)" : "var(--red)" }}>{p.side}</span>
            </div>
            <EdgeBar marketPct={p.yesPct} estPct={p.est} edge={p.edge} />
            <div className="text-right">
              <p className="text-[13px] tabular-nums text-fg">{usd(p.value, 0)}</p>
              <p className="text-[11.5px] tabular-nums" style={{ color: p.pnl > 0.5 ? "var(--coral)" : p.pnl < -0.5 ? "var(--red)" : "var(--fg-mute)" }}>{signed(p.pnl)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
