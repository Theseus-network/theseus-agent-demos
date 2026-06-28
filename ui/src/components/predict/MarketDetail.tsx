"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PriceChart from "./PriceChart";
import TradePanel from "./TradePanel";
import OnChainTradePanel from "./OnChainTradePanel";
import ResolvePanel from "./ResolvePanel";
import AnimatedPct from "./AnimatedPct";
import { isOnChainMarket } from "@/lib/predict/onchain";
import { findMarketBySlug, liquidityB, usePredict } from "@/lib/predict/store";
import { priceYes as priceYesFn } from "@/lib/predict/amm";
import { compactUsd, fmtDate, isPast, pct, untilDeadline } from "@/lib/predict/format";
import type { Outcome } from "@/lib/predict/types";

export default function MarketDetail({ slug }: { slug: string }) {
  const state = usePredict();
  const seed = findMarketBySlug(state, slug);
  const [initialSide, setInitialSide] = useState<Outcome>("YES");

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("side");
    if (s === "NO") setInitialSide("NO");
  }, []);

  if (!state.hydrated) {
    return (
      <main className="mx-auto max-w-6xl px-3 pb-20 pt-6 sm:px-5">
        <div className="mt-10 h-64 animate-pulse rounded-xl border border-border bg-surface/30" />
      </main>
    );
  }
  if (!seed) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-16 text-center">
        <p className="text-fg-mute">This market isn&rsquo;t available right now.</p>
        <Link href="/predict" className="mt-3 inline-block text-coral hover:underline">
          ← Back to markets
        </Link>
      </main>
    );
  }

  const rt = state.markets[seed.id];
  const pYes = rt ? priceYesFn(rt.qYes, rt.qNo, liquidityB(seed.id)) : seed.initialYes;
  const history = rt?.history ?? [];
  const volume = rt?.volumeUsd ?? seed.volumeUsd;
  const change =
    history.length >= 2 ? pYes - history[0].pYes : 0;
  const closed = isPast(seed.deadlineISO);
  const settled = !!state.settlements[seed.id];

  return (
    <main className="mx-auto max-w-6xl px-3 pb-20 pt-6 sm:px-5">
      <Link
        href="/predict"
        className="font-mono text-[11px] uppercase tracking-[0.18em] text-fg-mute transition-colors hover:text-fg"
      >
        ← Markets
      </Link>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left */}
        <div className="min-w-0">
          <div>
            <h1 className="text-[22px] font-semibold leading-snug tracking-tight text-fg sm:text-[27px]">
              {seed.question}
            </h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-fg-mute">
              <span className="text-fg-dim">{seed.category}</span>
              <span>·</span>
              <span>{compactUsd(volume)} vol</span>
              <span>·</span>
              <span className={closed && !settled ? "text-amber" : undefined}>
                {settled ? "Settled" : closed ? "Awaiting settlement" : `ends ${fmtDate(seed.deadlineISO)}`}
              </span>
              {seed.createdBy && (
                <>
                  <span>·</span>
                  <a
                    href={seed.createdBy.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="Written on-chain by a Theseus agent. Verify it."
                    className="text-coral hover:underline"
                  >
                    made by {seed.createdBy.agent} ↗
                  </a>
                </>
              )}
            </div>
          </div>

          {/* Price + chart */}
          <div className="mt-8">
            <div className="flex items-baseline gap-2">
              <AnimatedPct value={pYes} className="font-serif text-[54px] font-medium leading-none tracking-tight tabular-nums text-fg" />
              <span className="text-[13px] text-fg-mute">YES chance</span>
              <span className="font-mono text-[12px]" style={{ color: change >= 0 ? "var(--green)" : "var(--red)" }}>
                {change >= 0 ? "▲" : "▼"} {Math.abs(Math.round(change * 100))}
              </span>
            </div>
            <div className="mt-5">
              <PriceChart history={history} height={210} variant="full" />
            </div>
          </div>

          {/* Resolution (the differentiator) */}
          <div className="mt-8 border-t border-border pt-6">
            <ResolvePanel seed={seed} />
          </div>

          {/* Rules + context */}
          <section className="mt-8 border-t border-border pt-6">
            <p className="text-[13.5px] leading-relaxed text-fg-dim">{seed.description}</p>
            <h2 className="mt-5 text-[11px] text-fg-mute">Resolution rules</h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-dim">{seed.resolutionCriteria}</p>
            <p className="mt-3 text-[11px] text-fg-mute">
              Source · <span className="text-fg-dim">{seed.resolutionSource}</span>
            </p>
          </section>

          {/* Related markets */}
          {(() => {
            const related = state.marketList
              .filter((m) => m.category === seed.category && m.id !== seed.id)
              .slice(0, 4);
            if (related.length === 0) return null;
            return (
              <section className="mt-8 border-t border-border pt-6">
                <h2 className="mb-3 text-[11px] text-fg-mute">More in {seed.category}</h2>
                <div className="grid gap-x-6 sm:grid-cols-2">
                  {related.map((m) => {
                    const r = state.markets[m.id];
                    const p = r ? priceYesFn(r.qYes, r.qNo, liquidityB(m.id)) : m.initialYes;
                    return (
                      <Link
                        key={m.id}
                        href={`/predict/${m.slug}`}
                        className="flex items-center gap-4 border-b border-border/60 py-3 transition-colors hover:text-coral"
                      >
                        <span className="min-w-0 flex-1 truncate text-[13.5px] text-fg">{m.shortTitle}</span>
                        <span className="shrink-0 font-serif text-[16px] font-medium tabular-nums text-fg">{pct(p)}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })()}
        </div>

        {/* Right: trade */}
        <div className="lg:sticky lg:top-[72px] lg:self-start">
          {isOnChainMarket(seed.id) ? (
            <OnChainTradePanel seed={seed} />
          ) : (
            <TradePanel seed={seed} initialSide={initialSide} />
          )}
          <p className="mt-3 px-1 text-[11px] leading-relaxed text-fg-mute">
            Each share pays $1 if its outcome is the agent&rsquo;s verdict, $0
            otherwise. On UNRESOLVABLE, every position is refunded its cost.
          </p>
        </div>
      </div>
    </main>
  );
}
