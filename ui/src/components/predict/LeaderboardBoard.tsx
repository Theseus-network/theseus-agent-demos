"use client";

import { myStanding, usePredict } from "@/lib/predict/store";
import { usd, cents } from "@/lib/predict/format";

const HUE: Record<string, string> = {
  Kestrel: "var(--amber)",
  Atlas: "#6366F1",
  Sage: "var(--green)",
  Onyx: "#A855F7",
  You: "var(--coral)",
};

const pnlColor = (p: number) => (p > 0 ? "var(--green)" : p < 0 ? "var(--red)" : "var(--fg-mute)");

interface Row {
  name: string;
  blurb: string;
  value: number;
  cash: number;
  pnlPct: number;
  positions: number;
  kind: "agent" | "you";
  explorerUrl?: string;
}

export default function LeaderboardBoard({ agents, feed }: { agents: any[]; feed: any[] }) {
  const state = usePredict();

  const rows: Row[] = agents
    .map((a) => ({
      name: a.name,
      blurb: a.blurb,
      value: a.value ?? 0,
      cash: a.cash ?? 0,
      pnlPct: a.pnlPct ?? 0,
      positions: Object.keys(a.positions || {}).length,
      kind: "agent" as const,
      explorerUrl: a.address ? a.explorerUrl : undefined,
    }))
    .sort((a, b) => b.pnlPct - a.pnlPct);

  let me: { value: number; pnl: number; pnlPct: number } | null = null;
  let myOpen = 0;
  let myRank = 0;
  if (state.hydrated) {
    me = myStanding(state);
    myOpen = Object.values(state.positions).filter((p) => p.yesShares > 0 || p.noShares > 0).length;
    myRank = rows.filter((r) => r.pnlPct > me!.pnlPct).length + 1;
  }

  return (
    <>
      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        {rows.map((t, i) => (
          <div key={t.name} className="rounded-xl border border-border bg-surface/40 p-5">
            <div className="flex items-start gap-3.5">
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl font-serif text-[20px] font-medium text-white"
                style={{ background: HUE[t.name] ?? "var(--coral)" }}
              >
                {t.name[0]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-[16px] font-semibold text-fg">
                    <span className="font-mono text-[12px] text-fg-mute">#{i + 1}</span>
                    {t.name}
                    <span className="rounded-full bg-fg/[0.06] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-fg-mute">agent</span>
                  </h2>
                  <span className="font-mono text-[12px] font-semibold tabular-nums" style={{ color: pnlColor(t.pnlPct) }}>
                    {t.pnlPct >= 0 ? "+" : ""}{t.pnlPct.toFixed(1)}%
                  </span>
                </div>
                <p className="mt-0.5 font-mono text-[11px] text-fg-mute">{(t.blurb || "").split(".")[0]}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Stat label="Portfolio" value={usd(t.value)} />
              <Stat label="Cash" value={usd(t.cash)} />
              <Stat label="Positions" value={String(t.positions)} />
            </div>

            {t.explorerUrl ? (
              <a href={t.explorerUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 font-mono text-[10.5px] text-fg-mute transition-colors hover:text-coral">
                <span className="h-1 w-1 rounded-full bg-coral/70" /> on Theseus, verify ↗
              </a>
            ) : (
              <p className="mt-3 font-mono text-[10.5px] text-fg-mute">awaiting first round</p>
            )}
          </div>
        ))}
      </section>

      {me && (
        <section className="mt-4 rounded-xl border border-coral/40 bg-coral/[0.06] p-5">
          <div className="flex flex-wrap items-center gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-coral font-serif text-[20px] font-medium text-white">Y</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-coral">Your standing</span>
                <span className="font-mono text-[10.5px] text-fg-mute">would place #{myRank} of {rows.length + 1}</span>
              </div>
              <p className="mt-0.5 text-[12.5px] text-fg-dim">You trade the same board as the agents, on your own schedule.</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Stat label="Return" value={`${me.pnlPct >= 0 ? "+" : ""}${me.pnlPct.toFixed(1)}%`} />
              <Stat label="Portfolio" value={usd(me.value)} />
              <Stat label="Cash" value={usd(state.balance)} />
              <Stat label="Positions" value={String(myOpen)} />
            </div>
          </div>
        </section>
      )}

      <section className="mt-12">
        <h2 className="mb-4 font-serif text-[22px] tracking-tight text-fg">Recent agent trades</h2>
        {feed.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface/40 px-5 py-8 text-center text-[13.5px] text-fg-mute">
            No agent trades yet. When a round runs, every agent&rsquo;s reasoned trades show up here.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border">
            {feed.map((tr: any, i: number) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg font-serif text-[13px] text-white" style={{ background: HUE[tr.trader] ?? "var(--coral)" }}>
                  {tr.trader[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] leading-snug text-fg">
                    <span className="font-semibold">{tr.trader}</span> bought{" "}
                    <span style={{ color: tr.side === "YES" ? "var(--green)" : "var(--red)" }}>{tr.side}</span>{" "}
                    on <span className="text-fg-dim">{tr.q}</span> at {cents(tr.price)}{" "}
                    <span className="font-mono text-[11.5px] text-fg-mute">· {usd(tr.usd)}</span>
                  </p>
                  {tr.reason && <p className="mt-0.5 text-[12.5px] leading-snug text-fg-mute">{tr.reason}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg py-2">
      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-fg-mute">{label}</div>
      <div className="mt-0.5 font-mono text-[13.5px] font-semibold text-fg tabular-nums">{value}</div>
    </div>
  );
}
