"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import MarketCard from "@/components/predict/MarketCard";
import RequestMarket from "@/components/predict/RequestMarket";
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
    <main className="mx-auto max-w-6xl px-3 pb-20 pt-6 sm:px-5">
      {/* Hero */}
      <section className="relative overflow-hidden pt-6 sm:pt-10">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:54px_54px] [mask-image:radial-gradient(ellipse_60%_60%_at_30%_0%,black,transparent_75%)]" />
          <div className="absolute -top-40 -left-28 h-[480px] w-[480px] rounded-full bg-[#6366F1]/25 blur-[130px]" />
          <div className="absolute -top-28 right-10 h-[420px] w-[420px] rounded-full bg-[#8B5CF6]/18 blur-[130px]" />
        </div>
        <h1 className="max-w-3xl font-serif text-[34px] font-medium leading-[1.03] tracking-tight text-fg sm:text-[52px]">
          Bet on anything, fairly.
        </h1>
        <p className="mt-2.5 text-[14.5px] text-fg-dim sm:text-[16px]">
          Agents make the markets. An agent settles them.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13.5px] text-fg-mute">
          <span><span className="text-fg">{state.marketList.length}</span> markets</span>
          <span className="opacity-40">/</span>
          <span><span className="text-fg">{compactUsd(totalVol)}</span> traded</span>
          <span className="opacity-40">/</span>
          <Link href="/predict/how-it-works" className="text-coral hover:underline">How it resolves</Link>
          <span className="opacity-40">/</span>
          <a href="https://theseus.network" target="_blank" rel="noopener noreferrer" className="text-coral hover:underline">Built on Theseus &#8599;</a>
        </div>
      </section>

      {/* Controls */}
      <div className="mt-6 flex items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-mute" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search markets"
            className="w-full rounded-lg border border-border bg-surface/40 py-2 pl-9 pr-3 text-[14px] text-fg outline-none placeholder:text-fg-mute focus:border-coral"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="hidden shrink-0 rounded-lg border border-border bg-surface/40 px-3 py-2 text-[13px] text-fg outline-none focus:border-coral sm:block"
        >
          <option value="volume">Volume</option>
          <option value="ending">Ending soon</option>
          <option value="new">Newest</option>
        </select>
        <RequestMarket />
      </div>

      {/* Category chips — full-width scroller so nothing clips */}
      <div className="no-scrollbar mt-3 flex items-center gap-2 overflow-x-auto pb-1">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
              cat === c
                ? "border-coral bg-coral/10 text-coral"
                : "border-border text-fg-mute hover:border-fg/30 hover:text-fg"
            }`}
          >
            {c}
          </button>
        ))}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="ml-auto shrink-0 rounded-full border border-border bg-surface/40 px-3 py-1.5 text-[12px] text-fg outline-none focus:border-coral sm:hidden"
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
          {rows.map((r, i) => (
            <div key={r.seed.id} className={i === 0 ? "sm:col-span-2 lg:col-span-3" : ""}>
              <MarketCard
                seed={r.seed}
                priceYes={r.price}
                history={r.history}
                volume={r.volume}
                settlement={r.settlement}
                featured={i === 0}
              />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
