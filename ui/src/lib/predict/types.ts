// Domain types for the agent-settled prediction market (play-money demo).

export type Outcome = "YES" | "NO";

// Known buckets get a curated icon/filter; live Polymarket markets may carry
// other strings, so the type stays open.
export type MarketCategory = string;

export type MarketStatus = "open" | "closed" | "resolving" | "resolved";

/** Static seed for a market. The live AMM state lives in the store. */
export interface SeedMarket {
  id: number;
  slug: string;
  /** Full question, as it resolves. */
  question: string;
  /** Short label for cards. */
  shortTitle: string;
  /** One-paragraph context shown on the detail page. */
  description: string;
  category: MarketCategory;
  /** Emoji used as the market avatar. */
  icon: string;
  /** Verbatim resolution rules the agent reads. */
  resolutionCriteria: string;
  resolutionSource: string;
  /** Resolution deadline (calendar date, ET). */
  deadlineISO: string;
  /** Initial implied YES probability (0..1). */
  initialYes: number;
  /** LMSR liquidity parameter (higher = deeper book, less slippage). */
  liquidityB: number;
  /** Seed 24h + cumulative volume for display. */
  volumeUsd: number;
  /** Whether the deadline has already passed (resolvable now). */
  resolvable: boolean;
}

export interface PricePoint {
  t: number; // epoch ms
  pYes: number; // 0..1
}

/** Per-market runtime state held in the store. */
export interface MarketRuntime {
  qYes: number;
  qNo: number;
  volumeUsd: number;
  history: PricePoint[];
}

export interface Position {
  marketId: number;
  yesShares: number;
  noShares: number;
  /** Net USDC spent acquiring each side (cost basis), reduced on sells. */
  yesCost: number;
  noCost: number;
}

export interface Trade {
  id: string;
  marketId: number;
  side: Outcome;
  action: "buy" | "sell";
  shares: number;
  usdc: number;
  avgPrice: number; // 0..1
  ts: number;
}

/** Final settlement, produced by the agent adjudicator. */
export interface Settlement {
  marketId: number;
  verdict: "RESOLVED" | "UNRESOLVABLE";
  winningOutcome: Outcome | null;
  confidencePct: number;
  reason?: "source-silent" | "source-contradicts" | "not-yet-decided" | null;
  evidenceSummary: string;
  citations: { url: string; title?: string }[];
  settledAt: number;
}
