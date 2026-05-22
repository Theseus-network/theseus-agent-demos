/**
 * Polymarket Gamma API client. Fetches active, unresolved prediction
 * markets and maps them onto the PredictionMarket shape consumed by
 * the existing adjudicator pipeline (lib/adjudicator-markets.ts).
 *
 * No auth required. The Gamma endpoint is rate-limited but anonymous
 * reads are allowed; demo traffic is well under any practical cap.
 *
 * Endpoint used:
 *   GET https://gamma-api.polymarket.com/markets
 *       ?active=true&closed=false&limit=20
 *       &order=volume24hr&ascending=false
 *
 * The Gamma response encodes a few array fields as JSON strings
 * (outcomes, outcomePrices, clobTokenIds). We defensively parse those.
 */

import type { PredictionMarket } from "./adjudicator-markets";

const GAMMA_BASE = "https://gamma-api.polymarket.com";

/** Raw Gamma market shape. Only the fields we use are typed; the
 *  endpoint returns many more. */
interface GammaMarketRaw {
  id?: string | number;
  conditionId?: string;
  question?: string;
  description?: string;
  /** Stringified JSON array like '["Yes","No"]' */
  outcomes?: string | string[];
  /** Stringified JSON array like '["0.58","0.42"]' */
  outcomePrices?: string | string[];
  endDate?: string;
  endDateIso?: string;
  /** Slug used for the polymarket.com permalink. */
  slug?: string;
  volume24hr?: number;
  volume?: number;
  liquidity?: number;
  active?: boolean;
  closed?: boolean;
  /** Polymarket categorizes some markets as "groupItemTitle" within
   *  event bundles. We use the plain category if present, otherwise
   *  fall back to the event title. */
  category?: string;
  /** Optional human-authored resolution rules. */
  resolutionSource?: string;
}

export interface PolymarketLiveMarket {
  /** The underlying Polymarket conditionId, used as the stable key. */
  conditionId: string;
  /** Permalink back to polymarket.com. */
  url: string;
  /** Current YES probability (0–1), if priceable. */
  yesPrice: number | null;
  /** 24-hour USD volume on Polymarket. */
  volume24hUsd: number;
  /** Mapped market in the shape the adjudicator already understands. */
  market: PredictionMarket;
}

/** Parse a Gamma field that's either a JSON-stringified array or an
 *  already-decoded array. Returns [] on any failure. */
function parseStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v !== "string") return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** Crude FNV-1a 32-bit hash. Used to derive a stable numeric marketId
 *  from the conditionId hex so the on-chain commit (which expects a
 *  uint256) gets a deterministic key. */
function conditionIdToNumeric(conditionId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < conditionId.length; i++) {
    h ^= conditionId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // OR with 0x80000000 reserves the high bit so live-Polymarket ids
  // never collide with the synthetic 1001-1004 demo ids.
  return (h | 0x80000000) >>> 0;
}

/** Format an ISO datetime as "Month D, YYYY" for the UI. */
function humanDeadline(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Pluck the date portion (YYYY-MM-DD) from an ISO string for
 *  programmatic deadline comparisons. */
function isoDate(iso: string): string {
  return iso.slice(0, 10);
}

/** Strip markdown headings + image syntax + collapse whitespace, then
 *  hard-cap at `maxChars`. Polymarket descriptions sometimes embed
 *  long rules sections; the adjudicator only needs the gist. */
function cleanDescription(raw: string, maxChars: number): string {
  const cleaned = raw
    .replace(/^#+\s.*$/gm, "")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (cleaned.length <= maxChars) return cleaned;
  return cleaned.slice(0, maxChars).trimEnd() + "…";
}

/** Heuristic culture-war / degen filter. We want markets with crisp
 *  factual resolution criteria — the agent's whole point is to read
 *  evidence, not to wade through politicized framing. */
const SKIP_KEYWORDS = [
  "trump",
  "biden",
  "harris",
  "kamala",
  "putin",
  "musk tweets",
  "musk posts",
  "epstein",
  "kanye",
  "drake",
  "kendrick",
  "diddy",
  "taylor swift",
  "kardashian",
];

function isSafeFactualQuestion(q: string): boolean {
  const lower = q.toLowerCase();
  return !SKIP_KEYWORDS.some((kw) => lower.includes(kw));
}

/** Map a raw Gamma market onto our PredictionMarket shape, or return
 *  null if the market fails any binary/factual/deadline gate. */
function mapGammaToMarket(
  raw: GammaMarketRaw,
  minEndDateMs: number,
): PolymarketLiveMarket | null {
  if (!raw.conditionId || !raw.question) return null;

  const outcomes = parseStringArray(raw.outcomes);
  if (outcomes.length !== 2) return null;

  const endIso = raw.endDate ?? raw.endDateIso;
  if (!endIso) return null;
  const endMs = Date.parse(endIso);
  if (Number.isNaN(endMs) || endMs < minEndDateMs) return null;

  if (!isSafeFactualQuestion(raw.question)) return null;

  const prices = parseStringArray(raw.outcomePrices).map((s) => Number(s));
  const yesPrice =
    prices.length === 2 && Number.isFinite(prices[0]) ? prices[0] : null;

  const description = raw.description?.trim() ?? "";
  const criteria = description
    ? cleanDescription(description, 2000)
    : `Polymarket binary market. Outcomes: [${outcomes.join(", ")}]. Resolves based on the conditions Polymarket's UMA-backed oracle uses for "${raw.question}".`;

  const slug = raw.slug ?? raw.conditionId;
  const url = `https://polymarket.com/event/${slug}`;

  const marketId = conditionIdToNumeric(raw.conditionId);

  const mapped: PredictionMarket = {
    id: `polymarket-${raw.conditionId.slice(2, 12)}`,
    marketId,
    category: raw.category?.trim() || "Polymarket",
    question: raw.question.trim(),
    options: [
      `${outcomes[0]} (${outcomes[0].toLowerCase()})`,
      `${outcomes[1]} (${outcomes[1].toLowerCase()})`,
    ],
    deadline: humanDeadline(endIso),
    deadlineISO: isoDate(endIso),
    resolutionCriteria: criteria,
    resolutionSource:
      raw.resolutionSource?.trim() ||
      "Polymarket UMA optimistic oracle + the primary sources cited in the market description",
  };

  return {
    conditionId: raw.conditionId,
    url,
    yesPrice,
    volume24hUsd: Number(raw.volume24hr ?? 0),
    market: mapped,
  };
}

export interface FetchActiveMarketsOptions {
  /** How many candidates to request from Gamma before filtering.
   *  Higher = more chance of hitting the `take` quota after filters. */
  limit?: number;
  /** Final cap on returned mapped markets. */
  take?: number;
  /** Minimum days-until-end. We default to 14 so the agent has a
   *  resolution surface but the adjudicator UI's "not yet resolvable"
   *  branch still fires (the demo's point is showing the agent
   *  reasoning, not betting before the deadline). */
  minDaysOut?: number;
}

/** Fetches active Polymarket markets, mapped onto PredictionMarket. */
export async function fetchActiveMarkets(
  opts: FetchActiveMarketsOptions = {},
): Promise<PolymarketLiveMarket[]> {
  const limit = opts.limit ?? 20;
  const take = opts.take ?? 6;
  const minDaysOut = opts.minDaysOut ?? 14;

  const url = new URL("/markets", GAMMA_BASE);
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("order", "volume24hr");
  url.searchParams.set("ascending", "false");

  const res = await fetch(url.toString(), {
    headers: { accept: "application/json" },
    next: { revalidate: 300 }, // 5 min server cache
  });
  if (!res.ok) {
    throw new Error(`polymarket gamma ${res.status}`);
  }
  // Gamma returns a top-level array (not wrapped). Be defensive:
  // some proxies wrap in { data: [...] }.
  const json = (await res.json()) as GammaMarketRaw[] | { data?: GammaMarketRaw[] };
  const raw: GammaMarketRaw[] = Array.isArray(json)
    ? json
    : Array.isArray((json as { data?: GammaMarketRaw[] }).data)
      ? ((json as { data?: GammaMarketRaw[] }).data as GammaMarketRaw[])
      : [];

  const minEndDateMs = Date.now() + minDaysOut * 86_400_000;
  const mapped: PolymarketLiveMarket[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const m = mapGammaToMarket(r, minEndDateMs);
    if (!m) continue;
    if (seen.has(m.conditionId)) continue;
    seen.add(m.conditionId);
    mapped.push(m);
    if (mapped.length >= take) break;
  }
  return mapped;
}
