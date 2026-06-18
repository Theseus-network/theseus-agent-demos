"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import MarketCard from "@/components/predict/MarketCard";
import { liquidityB, usePredict } from "@/lib/predict/store";
import { priceYes as priceYesFn } from "@/lib/predict/amm";
import { compactUsd, isPast } from "@/lib/predict/format";

const CAT_ORDER = ["Crypto", "Politics", "Economy", "Tech", "Science", "Sports", "Trending"];
type Sort = "volume" | "ending" | "new";

export default function MarketsIndex() {
  const state = usePredict();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const [sort, setSort] = useState<Sort>("volume");

  const categories = useMemo(() => {
    const present = new Set(state.marketList.map((m) => m.category));
    const ordered = CAT_ORDER.filter((c) => present.has(c));
    const extra = [...present].filter((c) => !CAT_ORDER.includes(c));
    return ["All", ...ordered, ...extra];
  }, [state.marketList]);

  const rows = useMemo(() => {
    const list = state.marketList
      .filter((m) => {
        if (cat !== "All" && m.category !== cat) return false;
        if (q && !m.question.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      })
      .map((seed) => {
        const rt = state.markets[seed.id];
        const price = rt
          ? priceYesFn(rt.qYes, rt.qNo, liquidityB(seed.id))
          : seed.initialYes;
        return {
          seed,
          price,
          history: rt?.history ?? [],
          volume: rt?.volumeUsd ?? seed.volumeUsd,
          settlement: state.settlements[seed.id],
        };
      });
    list.sort((a, b) => {
      if (sort === "volume") return b.volume - a.volume;
      if (sort === "new") return b.seed.id - a.seed.id;
      const ap = isPast(a.seed.deadlineISO) ? 1 : 0;
      const bp = isPast(b.seed.deadlineISO) ? 1 : 0;
      if (ap !== bp) return ap - bp;
      return Date.parse(a.seed.deadlineISO) - Date.parse(b.seed.deadlineISO);
    });
    return list;
  }, [state, q, cat, sort]);

  const totalVol = useMemo(
    () =>
      state.marketList.reduce(
        (s, m) => s + (state.markets[m.id]?.volumeUsd ?? m.volumeUsd),
        0,
      ),
    [state],
  );

  return (
    <main className="mx-auto max-w-6xl px-3 pb-20 pt-8 sm:px-5">
      {/* Hero */}
      <section className="rounded-2xl border border-border bg-surface/40 p-6 sm:p-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-coral">
          Agent-settled prediction markets
        </p>
        <h1 className="mt-2 max-w-2xl font-serif text-[28px] leading-[1.1] tracking-tight text-fg sm:text-[38px]">
          Markets settled by the record, not a token vote.
        </h1>
        <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-fg-dim">
          Every market resolves when a sovereign Theseus agent reads the primary
          source and commits a verdict, only when the evidence clears an 80%
          confidence bar. No whale can outvote it. Trade with play-money USDC and
          watch the agent settle live.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[12px] text-fg-mute">
          {state.hydrated && (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: state.live ? "var(--green)" : "var(--amber)" }}
              />
              {state.live ? "Live odds from Polymarket" : "Sample odds (Polymarket unavailable)"}
            </span>
          )}
          <span>
            <span className="text-fg">{state.marketList.length}</span> markets
          </span>
          <span>
            <span className="text-fg">{compactUsd(totalVol)}</span> volume
          </span>
          <Link href="/predict/how-it-works" className="text-coral hover:underline">
            How resolution works →
          </Link>
        </div>
      </section>

      {/* Controls */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search markets"
          className="w-full rounded-lg border border-border bg-surface/40 px-3 py-2 text-[14px] text-fg outline-none placeholder:text-fg-mute focus:border-coral sm:max-w-xs"
        />
        <div className="flex flex-1 items-center gap-2 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                cat === c
                  ? "border-coral bg-coral/10 text-coral"
                  : "border-border text-fg-mute hover:text-fg"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="shrink-0 rounded-lg border border-border bg-surface/40 px-3 py-2 text-[13px] text-fg outline-none focus:border-coral"
        >
          <option value="volume">Volume</option>
          <option value="ending">Ending soon</option>
          <option value="new">Newest</option>
        </select>
      </div>

      {/* Grid */}
      {!state.hydrated ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[200px] animate-pulse rounded-xl border border-border bg-surface/30"
            />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-16 text-center text-fg-mute">No markets match that filter.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <MarketCard
              key={r.seed.id}
              seed={r.seed}
              priceYes={r.price}
              history={r.history}
              volume={r.volume}
              settlement={r.settlement}
            />
          ))}
        </div>
      )}
    </main>
  );
}
