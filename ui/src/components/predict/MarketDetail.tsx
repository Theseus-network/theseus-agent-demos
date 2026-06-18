"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PriceChart from "./PriceChart";
import TradePanel from "./TradePanel";
import ResolvePanel from "./ResolvePanel";
import { findMarketBySlug, liquidityB, usePredict } from "@/lib/predict/store";
import { priceYes as priceYesFn } from "@/lib/predict/amm";
import { cents, compactUsd, fmtDate, isPast, pct, untilDeadline } from "@/lib/predict/format";
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
          <div className="flex items-start gap-3.5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-border bg-surface/40 text-[24px]">
              {seed.icon}
            </span>
            <div className="min-w-0">
              <h1 className="text-[20px] font-semibold leading-snug tracking-tight text-fg sm:text-[24px]">
                {seed.question}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-fg-mute">
                <span className="rounded-full border border-border px-2 py-0.5">{seed.category}</span>
                <span>{compactUsd(volume)} Vol</span>
                <span className={closed && !settled ? "text-amber" : undefined}>
                  {settled ? "Settled" : closed ? "Awaiting settlement" : `Ends ${fmtDate(seed.deadlineISO)} · ${untilDeadline(seed.deadlineISO)}`}
                </span>
              </div>
            </div>
          </div>

          {/* Price + chart */}
          <div className="mt-6 rounded-xl border border-border bg-surface/40 p-4 sm:p-5">
            <div className="flex items-end justify-between">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[34px] font-semibold leading-none tabular-nums text-fg">
                    {pct(pYes)}
                  </span>
                  <span className="text-[13px] text-fg-mute">YES</span>
                </div>
                <div
                  className="mt-1 font-mono text-[12px]"
                  style={{ color: change >= 0 ? "var(--green)" : "var(--red)" }}
                >
                  {change >= 0 ? "▲" : "▼"} {Math.abs(Math.round(change * 100))} pts
                </div>
              </div>
              <div className="flex gap-2 text-center">
                <div className="rounded-lg border border-[color-mix(in_srgb,var(--green)_30%,transparent)] px-3 py-1.5">
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-mute">Yes</div>
                  <div className="font-mono text-[15px] font-semibold text-green">{cents(pYes)}</div>
                </div>
                <div className="rounded-lg border border-[color-mix(in_srgb,var(--red)_30%,transparent)] px-3 py-1.5">
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-mute">No</div>
                  <div className="font-mono text-[15px] font-semibold text-red">{cents(1 - pYes)}</div>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <PriceChart history={history} height={200} variant="full" />
            </div>
          </div>

          {/* Resolution (the differentiator) */}
          <div className="mt-6">
            <ResolvePanel seed={seed} />
          </div>

          {/* Rules */}
          <section className="mt-6 rounded-xl border border-border bg-surface/40 p-5">
            <h2 className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
              Resolution rules
            </h2>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-fg-dim">
              {seed.resolutionCriteria}
            </p>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-mute">
              Source · <span className="text-fg-dim">{seed.resolutionSource}</span>
            </p>
          </section>

          {/* Context */}
          <section className="mt-6 rounded-xl border border-border bg-surface/40 p-5">
            <h2 className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
              About this market
            </h2>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-fg-dim">{seed.description}</p>
          </section>
        </div>

        {/* Right: trade */}
        <div className="lg:sticky lg:top-[72px] lg:self-start">
          <TradePanel seed={seed} initialSide={initialSide} />
          <p className="mt-3 px-1 text-[11px] leading-relaxed text-fg-mute">
            Each share pays $1 if its outcome is the agent&rsquo;s verdict, $0
            otherwise. On UNRESOLVABLE, every position is refunded its cost.
          </p>
        </div>
      </div>
    </main>
  );
}
