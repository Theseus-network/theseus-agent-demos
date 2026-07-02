"use client";

import { useEffect, useState } from "react";
import type { LiveFund as LF, TradeRec } from "./useLiveFund";
import { EdgeBar } from "./EdgeBar";

const actionColor = (a: string) => /YES/i.test(a) ? "var(--coral)" : /NO/i.test(a) ? "var(--red)" : "var(--fg-dim)";
const STAGES = ["Reading a market…", "Estimating the true probability…", "Weighing the gap…", "Signing the decision on Theseus…"];

// The agent's disagreement with the market, in points, on the side it would take.
function tradeGap(t: TradeRec): number | null {
  if (t.est == null) return null;
  return Math.abs(t.est - t.yesPct);
}

export function LiveFund({ live }: { live: LF | null }) {
  const [stage, setStage] = useState(0);
  const trading = !!live?.trading;
  const trades = (live?.trades ?? []).filter((t) => t.action !== "ERROR");
  const latest = trades[0];
  const older = trades.slice(1, 4);
  const mins = live ? Math.max(1, Math.round(live.nextTradeInMs / 60000)) : null;

  useEffect(() => {
    if (!trading) { setStage(0); return; }
    const id = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 2600);
    return () => clearInterval(id);
  }, [trading]);

  return (
    <div className="mt-4 rounded-xl border border-border bg-bg/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full opacity-60" style={{ background: "var(--coral)" }} />
            <span className="inline-flex h-2 w-2 rounded-full" style={{ background: "var(--coral)" }} />
          </span>
          <span className="text-[13px] font-medium text-fg">The agent&rsquo;s desk</span>
        </div>
        <span className="font-mono text-[11.5px] text-fg-mute tabular-nums">{live?.runCount ?? 0} runs</span>
      </div>

      <div className="mt-3 min-h-[92px]">
        {trading ? (
          <div className="flex items-center gap-2 py-4 text-[13px] text-fg-dim">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "var(--coral)" }} />
            {STAGES[stage]}
          </div>
        ) : latest ? (
          <>
            <p className="text-[13px] leading-snug">
              <span className="font-semibold" style={{ color: actionColor(latest.action) }}>{latest.action}</span>
              <span className="text-fg-dim"> · {latest.question}</span>
            </p>
            {latest.est != null && <div className="mt-2.5"><EdgeBar marketPct={latest.yesPct} estPct={latest.est} /></div>}
            {latest.text && <p className="mt-2 text-[12.5px] leading-relaxed text-fg-mute">{latest.text}</p>}
            {latest.runSeq >= 0 && (
              <a href={live!.explorer} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block font-mono text-[11px] text-coral hover:underline">
                run #{latest.runSeq} · verify on Theseus ↗
              </a>
            )}
          </>
        ) : (
          <p className="py-4 text-[12.5px] text-fg-dim">Warming up. The agent will evaluate a market shortly.</p>
        )}
      </div>

      {!trading && older.length > 0 && (
        <div className="mt-1 space-y-1.5 border-t border-border/60 pt-2.5">
          {older.map((t, i) => {
            const g = tradeGap(t);
            return (
              <div key={i} className="flex items-center gap-2 text-[12px]">
                <span className="w-16 shrink-0 font-medium" style={{ color: actionColor(t.action) }}>{t.action}</span>
                <span className="min-w-0 flex-1 truncate text-fg-dim">{t.question}</span>
                {g != null && <span className="shrink-0 tabular-nums text-fg-mute">{Math.round(g)} pt gap</span>}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3 text-[11.5px] text-fg-mute">
        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--coral)" }} />
        Sovereign: it trades on its own. No one, including you, can direct it.
        {!trading && mins != null && <span className="ml-auto tabular-nums">next review ~{mins}m</span>}
      </div>
    </div>
  );
}
