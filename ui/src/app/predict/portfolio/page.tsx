"use client";

import { useMemo } from "react";
import Link from "next/link";
import { priceYes as priceYesFn } from "@/lib/predict/amm";
import { liquidityB, resetAccount, usePredict } from "@/lib/predict/store";
import {
  cents,
  shares as fmtShares,
  signedUsd,
  timeAgo,
  usd,
} from "@/lib/predict/format";

export default function PortfolioPage() {
  const state = usePredict();
  const byId = useMemo(
    () => new Map(state.marketList.map((m) => [m.id, m])),
    [state.marketList],
  );

  const open = useMemo(() => {
    const rows: {
      id: number;
      slug: string;
      title: string;
      icon: string;
      side: "YES" | "NO";
      shares: number;
      cost: number;
      value: number;
      price: number;
    }[] = [];
    for (const pos of Object.values(state.positions)) {
      const seed = byId.get(pos.marketId);
      const rt = state.markets[pos.marketId];
      if (!seed || !rt) continue;
      const pYes = priceYesFn(rt.qYes, rt.qNo, liquidityB(pos.marketId));
      if (pos.yesShares > 1e-6)
        rows.push({ id: seed.id, slug: seed.slug, title: seed.shortTitle, icon: seed.icon, side: "YES", shares: pos.yesShares, cost: pos.yesCost, value: pos.yesShares * pYes, price: pYes });
      if (pos.noShares > 1e-6)
        rows.push({ id: seed.id, slug: seed.slug, title: seed.shortTitle, icon: seed.icon, side: "NO", shares: pos.noShares, cost: pos.noCost, value: pos.noShares * (1 - pYes), price: 1 - pYes });
    }
    return rows;
  }, [state, byId]);

  const openValue = open.reduce((s, r) => s + r.value, 0);
  const openCost = open.reduce((s, r) => s + r.cost, 0);
  const openPnl = openValue - openCost;
  const realizedPnl = state.settledPositions.reduce((s, p) => s + (p.payout - p.costBasis), 0);
  const portfolio = state.balance + openValue;

  return (
    <main className="mx-auto max-w-5xl px-3 pb-20 pt-8 sm:px-5">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-[26px] tracking-tight text-fg sm:text-[32px]">Portfolio</h1>
        <button
          onClick={() => {
            if (confirm("Reset this play-money account to $1,000 and clear all positions?")) resetAccount();
          }}
          className="rounded-md border border-border px-3 py-1.5 text-[12.5px] text-fg-mute hover:text-fg"
        >
          Reset account
        </button>
      </div>

      {/* Summary */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Portfolio value" value={state.hydrated ? usd(portfolio, { cents: true }) : "—"} />
        <Stat label="Cash" value={state.hydrated ? usd(state.balance, { cents: true }) : "—"} />
        <Stat
          label="Open P&L"
          value={state.hydrated ? signedUsd(openPnl) : "—"}
          tone={openPnl >= 0 ? "good" : "bad"}
        />
        <Stat
          label="Realized P&L"
          value={state.hydrated ? signedUsd(realizedPnl) : "—"}
          tone={realizedPnl >= 0 ? "good" : "bad"}
        />
      </div>

      {/* Open positions */}
      <Section title="Open positions">
        {open.length === 0 ? (
          <Empty>
            No open positions.{" "}
            <Link href="/predict" className="text-coral hover:underline">
              Browse markets →
            </Link>
          </Empty>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            {open.map((r, i) => {
              const pnl = r.value - r.cost;
              return (
                <Link
                  key={`${r.id}-${r.side}`}
                  href={`/predict/${r.slug}`}
                  className={`flex items-center gap-3 px-3 py-3 transition-colors hover:bg-fg/[0.02] sm:px-4 ${
                    i > 0 ? "border-t border-border" : ""
                  }`}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-surface/40 text-[15px]">
                    {r.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] text-fg">{r.title}</p>
                    <p className="font-mono text-[11px] text-fg-mute">
                      <span style={{ color: r.side === "YES" ? "var(--green)" : "var(--red)" }}>{r.side}</span>{" "}
                      · {fmtShares(r.shares)} @ avg {cents(r.cost / r.shares)} · now {cents(r.price)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-[13.5px] tabular-nums text-fg">{usd(r.value, { cents: true })}</p>
                    <p
                      className="font-mono text-[11px] tabular-nums"
                      style={{ color: pnl >= 0 ? "var(--green)" : "var(--red)" }}
                    >
                      {signedUsd(pnl)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Section>

      {/* Settled */}
      {state.settledPositions.length > 0 && (
        <Section title="Resolved">
          <div className="overflow-hidden rounded-xl border border-border">
            {state.settledPositions.map((p, i) => {
              const realized = p.payout - p.costBasis;
              return (
                <div
                  key={`${p.marketId}-${p.settledAt}`}
                  className={`flex items-center gap-3 px-3 py-3 sm:px-4 ${i > 0 ? "border-t border-border" : ""}`}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-surface/40 text-[15px]">
                    {p.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] text-fg">{p.title}</p>
                    <p className="font-mono text-[11px] text-fg-mute">
                      {p.winningOutcome ? `Resolved ${p.winningOutcome}` : "Unresolvable · refunded"} · {timeAgo(p.settledAt)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-[13.5px] tabular-nums text-fg">{usd(p.payout, { cents: true })}</p>
                    <p
                      className="font-mono text-[11px] tabular-nums"
                      style={{ color: realized >= 0 ? "var(--green)" : "var(--red)" }}
                    >
                      {signedUsd(realized)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Activity */}
      {state.trades.length > 0 && (
        <Section title="Activity">
          <div className="overflow-hidden rounded-xl border border-border">
            {state.trades.slice(0, 20).map((t, i) => {
              const seed = byId.get(t.marketId);
              return (
                <div
                  key={t.id}
                  className={`flex items-center gap-3 px-3 py-2.5 text-[12.5px] sm:px-4 ${i > 0 ? "border-t border-border" : ""}`}
                >
                  <span className="w-10 shrink-0 font-mono text-[11px] capitalize text-fg-mute">{t.action}</span>
                  <span className="shrink-0 font-mono text-[11px]" style={{ color: t.side === "YES" ? "var(--green)" : "var(--red)" }}>
                    {t.side}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-fg">{seed?.shortTitle ?? t.marketId}</span>
                  <span className="shrink-0 font-mono text-[11px] text-fg-mute">{fmtShares(t.shares)} @ {cents(t.avgPrice)}</span>
                  <span className="hidden shrink-0 font-mono text-[11px] text-fg-mute sm:inline">{timeAgo(t.ts)}</span>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {!state.hydrated && <p className="mt-10 text-center text-fg-mute">Loading…</p>}
    </main>
  );
}


function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div>
      <div className="text-[12px] text-fg-mute">{label}</div>
      <div
        className="mt-1 text-[22px] font-semibold tabular-nums"
        style={{ color: tone === "good" ? "var(--green)" : tone === "bad" ? "var(--red)" : "var(--fg)" }}
      >
        {value}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="mb-3 text-[14px] font-semibold text-fg">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-[13.5px] text-fg-mute">
      {children}
    </div>
  );
}
