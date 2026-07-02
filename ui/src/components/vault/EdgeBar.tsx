"use client";

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/** Market-implied probability vs the agent's own estimate. The gap between them
 *  is the agent's claim, not a proven advantage. */
export function EdgeBar({ marketPct, estPct }: { marketPct: number; estPct: number | null; edge?: number | null }) {
  const gap = estPct != null ? Math.round(estPct - marketPct) : null;
  return (
    <div className="w-full">
      <div className="flex items-center gap-2">
        <span className="w-10 shrink-0 text-[10.5px] text-fg-mute">market</span>
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-fg/[0.08]">
          <div className="h-full rounded-full" style={{ width: `${clamp(marketPct)}%`, background: "var(--fg-dim)", opacity: 0.55 }} />
        </div>
        <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-fg-dim">{Math.round(marketPct)}%</span>
      </div>
      {estPct != null && (
        <div className="mt-1 flex items-center gap-2">
          <span className="w-10 shrink-0 text-[10.5px] text-fg-mute">agent</span>
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-fg/[0.08]">
            <div className="h-full rounded-full" style={{ width: `${clamp(estPct)}%`, background: "#6366f1" }} />
          </div>
          <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-fg">{Math.round(estPct)}%</span>
        </div>
      )}
      {gap != null && (() => {
        const mag = Math.abs(gap);
        const strong = mag >= 8;
        return (
          <p className="mt-1 text-[11px]">
            <span className="font-medium tabular-nums" style={{ color: strong ? "var(--coral)" : "var(--fg-dim)" }}>{mag} pts {gap < 0 ? "below" : "above"} market</span>
            {!strong && <span className="text-fg-mute"> · too thin to act</span>}
          </p>
        );
      })()}
    </div>
  );
}
