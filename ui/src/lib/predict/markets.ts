// Live market source. Pulls real, currently-open Polymarket markets (real YES
// odds, real 24h volume, real resolution rules) via the adjudicator's existing
// Gamma integration, and maps them onto our SeedMarket shape. Falls back to a
// bundled set if the upstream is unavailable. The two just-closed DEMO_MARKETS
// are always appended so the agent settlement stays demoable now.

import type { PolymarketLiveMarket } from "@/lib/polymarket";
import { DEMO_MARKETS, SEED_MARKETS } from "./seed";
import type { SeedMarket } from "./types";

export { DEMO_MARKETS };
export const FALLBACK_MARKETS: SeedMarket[] = SEED_MARKETS;

const CAT_ICON: Record<string, string> = {
  Crypto: "📈",
  Politics: "🇺🇸",
  Economy: "🏛️",
  Tech: "🤖",
  Science: "🚀",
  Culture: "🎬",
  Sports: "🏆",
  Trending: "🔥",
};

function inferCategory(q: string): string {
  const s = q.toLowerCase();
  if (/bitcoin|btc|ethereum|\beth\b|solana|\bsol\b|crypto|token|coin|\bxrp\b|dogecoin/.test(s)) return "Crypto";
  if (/election|president|senate|\bhouse\b|congress|trump|biden|republican|democrat|\bvote\b|poll|governor|primary|nominee/.test(s)) return "Politics";
  if (/\bfed\b|interest rate|inflation|\bgdp\b|recession|jobs report|\bcpi\b|unemployment|tariff/.test(s)) return "Economy";
  if (/\bai\b|openai|\bgpt\b|anthropic|google|apple|iphone|tesla|nvidia|chatgpt|llm|model\b/.test(s)) return "Tech";
  if (/spacex|nasa|rocket|\bmars\b|launch|orbit|starship|climate|nobel/.test(s)) return "Science";
  if (/\bnfl\b|\bnba\b|\bmlb\b|world cup|champion|super bowl|olympic|movie|film|oscar|grammy|box office|\bgame\b/.test(s)) return "Sports";
  return "Trending";
}

function iconFor(q: string, cat: string): string {
  const s = q.toLowerCase();
  if (/bitcoin|btc/.test(s)) return "₿";
  if (/ethereum|\beth\b/.test(s)) return "Ξ";
  if (/solana|\bsol\b/.test(s)) return "◎";
  return CAT_ICON[cat] ?? "📊";
}

function slugify(q: string, cond: string): string {
  const base = q
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);
  return `${base}-${cond.replace(/^0x/, "").slice(0, 6)}`;
}

function mapLive(plm: PolymarketLiveMarket): SeedMarket | null {
  const m = plm.market;
  if (!m.deadlineISO || plm.yesPrice == null || !m.resolutionCriteria) return null;
  const cat = inferCategory(m.question);
  const vol = Math.max(0, plm.volume24hUsd || 0);
  return {
    id: m.marketId,
    slug: slugify(m.question, plm.conditionId),
    question: m.question,
    shortTitle: m.question,
    description:
      "A live market mirrored from Polymarket. The odds and volume are real and current; on Theseus Predict, the agent settles it from the public record instead of a token vote.",
    category: cat,
    icon: iconFor(m.question, cat),
    resolutionCriteria: m.resolutionCriteria,
    resolutionSource: m.resolutionSource,
    deadlineISO: m.deadlineISO,
    initialYes: Math.min(0.98, Math.max(0.02, plm.yesPrice)),
    liquidityB: Math.min(25000, Math.max(2500, 2500 + vol / 1500)),
    volumeUsd: vol,
    resolvable: false,
  };
}

export interface LoadResult {
  markets: SeedMarket[];
  live: boolean;
}

const STOP = new Set([
  "will","the","by","of","in","to","be","is","at","on","after","before",
  "this","that","next","win","there","any","for","with","and","or","its","an","a","no",
]);

// Group markets by topic so a single event (e.g. "Will <country> win the World
// Cup") can't flood the board. Keyed on the trailing content words.
function familyKey(q: string): string {
  const toks = q
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
  return toks.slice(-2).join(" ") || q.toLowerCase().slice(0, 14);
}

const PER_FAMILY = 3;
const MAX_MARKETS = 18;

/** Fetch live Polymarket markets, mapped + diversified, with DEMO appended. */
export async function fetchLiveMarkets(signal?: AbortSignal): Promise<LoadResult> {
  try {
    const res = await fetch("/api/adjudicate/polymarket?limit=200&take=120", { signal });
    if (!res.ok) throw new Error(`http ${res.status}`);
    const j = (await res.json()) as { markets?: PolymarketLiveMarket[] };
    const seenId = new Set<number>();
    const ranked = (j.markets ?? [])
      .map(mapLive)
      .filter((m): m is SeedMarket => m !== null)
      // drop dead-certain longshots that aren't interesting to trade
      .filter((m) => m.initialYes >= 0.03 && m.initialYes <= 0.97)
      .filter((m) => (seenId.has(m.id) ? false : (seenId.add(m.id), true)))
      .sort((a, b) => b.volumeUsd - a.volumeUsd);

    const famCount = new Map<string, number>();
    const live: SeedMarket[] = [];
    for (const m of ranked) {
      const k = familyKey(m.question);
      const c = famCount.get(k) ?? 0;
      if (c >= PER_FAMILY) continue;
      famCount.set(k, c + 1);
      live.push(m);
      if (live.length >= MAX_MARKETS) break;
    }
    if (live.length < 4) throw new Error("too few live markets");
    return { markets: [...live, ...DEMO_MARKETS], live: true };
  } catch {
    return { markets: FALLBACK_MARKETS, live: false };
  }
}
