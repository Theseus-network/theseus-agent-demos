/**
 * GoPlus Security API client.
 *
 * https://api.gopluslabs.io/api/v1/token_security/<chainId>?contract_addresses=<addr>
 *
 * Free, no auth required for low volume. The Sniper cron fires ~20
 * candidates every 20 min ≈ 1 req/min, comfortably under GoPlus's
 * anonymous rate limit (30 req/min as documented).
 *
 * This is the single biggest dossier improvement the agent can get
 * without paying for a feed. Returns the contract-pathology signals
 * (honeypot, mintable, pausable, ownership tricks, taxes) plus the
 * actual top-holder list with each holder's "is this a known locker /
 * DEX / LP contract" classification — so we finally get an honest LP
 * lock signal without resolving V3 NFT ownership ourselves.
 */

import type { Address } from "viem";

const GOPLUS_BASE = "https://api.gopluslabs.io/api/v1/token_security";
const BASE_CHAIN_ID = "8453";
const FETCH_TIMEOUT_MS = 8000;

/** Raw fields we read off the GoPlus response. The endpoint returns
 *  many more — buy/sell-tag dexes, anti-whale modes, trusted-token
 *  flags, etc. — that we don't currently surface. Add them here if
 *  the evaluator needs them. */
interface GoPlusTokenSecurityRaw {
  /** "0"/"1" string flags. GoPlus uses strings, not booleans. */
  is_honeypot?: string;
  cannot_buy?: string;
  cannot_sell_all?: string;
  can_take_back_ownership?: string;
  is_mintable?: string;
  is_proxy?: string;
  is_open_source?: string;
  slippage_modifiable?: string;
  transfer_pausable?: string;
  trading_cooldown?: string;
  external_call?: string;
  /** "0.05" = 5%. */
  buy_tax?: string;
  sell_tax?: string;
  holder_count?: string;
  total_supply?: string;
  creator_address?: string;
  /** Decimal fraction string, e.g. "0.005175" = 0.5175%. */
  creator_percent?: string;
  owner_address?: string;
  owner_percent?: string;
  holders?: GoPlusHolderRaw[];
  lp_holders?: GoPlusLpHolderRaw[];
}

interface GoPlusHolderRaw {
  address: string;
  is_contract: number;
  /** Decimal fraction string. */
  percent: string;
  tag?: string;
  is_locked: number; // 0 / 1
}

interface GoPlusLpHolderRaw {
  address: string;
  is_contract: number;
  percent: string;
  tag?: string;
  is_locked: number;
  locked_detail?: Array<{
    amount: string;
    end_time: string;
    opt_time: string;
  }>;
}

/** Public shape — strings turned into booleans/numbers, key fields
 *  surfaced, nulls when GoPlus had no answer. */
export interface GoPlusSecurity {
  /** True iff GoPlus flagged the token honeypot. */
  isHoneypot: boolean | null;
  cannotBuy: boolean | null;
  cannotSellAll: boolean | null;
  canTakeBackOwnership: boolean | null;
  isMintable: boolean | null;
  isProxy: boolean | null;
  isOpenSource: boolean | null;
  slippageModifiable: boolean | null;
  transferPausable: boolean | null;
  tradingCooldown: boolean | null;
  externalCall: boolean | null;
  /** Buy tax as a fraction (0..1). null if GoPlus didn't return one. */
  buyTaxPct: number | null;
  sellTaxPct: number | null;
  holderCount: number | null;
  /** Creator/owner share of total supply, 0..1. */
  creatorPercent: number | null;
  ownerPercent: number | null;
  /** Sum of top-3 holder shares as a fast adoption proxy. */
  top3HolderPct: number | null;
  /** Tags on the top 3 holders if GoPlus labeled them (e.g. "Uniswap V3",
   *  "lock contract", "Team Finance"). null entries are unlabeled EOAs. */
  top3HolderTags: (string | null)[];
  /** Share of total supply held in LP positions classified as locked. */
  lockedLpPct: number | null;
  /** Share of total supply held in LP positions that aren't locked. */
  unlockedLpPct: number | null;
  /** Set when the entire lookup was unavailable (rate-limited, etc.) so
   *  the calling research module can surface a clean "unknown". */
  unavailable?: boolean;
}

function parseBool(v: string | undefined): boolean | null {
  if (v === "1") return true;
  if (v === "0") return false;
  return null;
}

function parsePct(v: string | undefined): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseHolderCount(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : null;
}

/** GoPlus returns lp_holders with is_locked=1 for known locker contracts
 *  (Team Finance, Unicrypt, etc.) or burned addresses. Sum their share. */
function partitionLp(lp: GoPlusLpHolderRaw[] | undefined): {
  locked: number | null;
  unlocked: number | null;
} {
  if (!Array.isArray(lp) || lp.length === 0) {
    return { locked: null, unlocked: null };
  }
  let locked = 0;
  let unlocked = 0;
  for (const h of lp) {
    const pct = Number(h.percent);
    if (!Number.isFinite(pct)) continue;
    if (h.is_locked === 1) locked += pct;
    else unlocked += pct;
  }
  return { locked, unlocked };
}

function topThree(holders: GoPlusHolderRaw[] | undefined): {
  pct: number | null;
  tags: (string | null)[];
} {
  if (!Array.isArray(holders) || holders.length === 0) {
    return { pct: null, tags: [] };
  }
  // GoPlus returns holders sorted by descending percent.
  const top = holders.slice(0, 3);
  let sum = 0;
  for (const h of top) {
    const p = Number(h.percent);
    if (Number.isFinite(p)) sum += p;
  }
  return {
    pct: sum,
    tags: top.map((h) => (h.tag && h.tag.trim() ? h.tag : null)),
  };
}

/** Fetch the GoPlus security profile for a Base token. Never throws —
 *  on any failure (network, parse, missing fields) returns a result
 *  with unavailable=true so the LLM treats the row as unknown. */
export async function fetchGoPlusSecurity(
  token: Address,
): Promise<GoPlusSecurity> {
  const url = `${GOPLUS_BASE}/${BASE_CHAIN_ID}?contract_addresses=${token}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: ctrl.signal,
      next: { revalidate: 300 },
    });
  } catch {
    clearTimeout(timer);
    return blankUnavailable();
  }
  clearTimeout(timer);

  if (!res.ok) return blankUnavailable();

  let json: {
    code?: number;
    message?: string;
    result?: Record<string, GoPlusTokenSecurityRaw>;
  };
  try {
    json = await res.json();
  } catch {
    return blankUnavailable();
  }

  // GoPlus signals success with code===1; everything else is a soft
  // failure (token not indexed, rate limit, malformed query). Surface
  // unavailable rather than fabricating fields.
  if (json.code !== 1 || !json.result) return blankUnavailable();

  // The result is keyed by the (lowercased) contract address; pick the
  // first entry regardless of key casing.
  const entry = Object.values(json.result)[0];
  if (!entry) return blankUnavailable();

  const lp = partitionLp(entry.lp_holders);
  const top = topThree(entry.holders);

  return {
    isHoneypot: parseBool(entry.is_honeypot),
    cannotBuy: parseBool(entry.cannot_buy),
    cannotSellAll: parseBool(entry.cannot_sell_all),
    canTakeBackOwnership: parseBool(entry.can_take_back_ownership),
    isMintable: parseBool(entry.is_mintable),
    isProxy: parseBool(entry.is_proxy),
    isOpenSource: parseBool(entry.is_open_source),
    slippageModifiable: parseBool(entry.slippage_modifiable),
    transferPausable: parseBool(entry.transfer_pausable),
    tradingCooldown: parseBool(entry.trading_cooldown),
    externalCall: parseBool(entry.external_call),
    buyTaxPct: parsePct(entry.buy_tax),
    sellTaxPct: parsePct(entry.sell_tax),
    holderCount: parseHolderCount(entry.holder_count),
    creatorPercent: parsePct(entry.creator_percent),
    ownerPercent: parsePct(entry.owner_percent),
    top3HolderPct: top.pct,
    top3HolderTags: top.tags,
    lockedLpPct: lp.locked,
    unlockedLpPct: lp.unlocked,
  };
}

function blankUnavailable(): GoPlusSecurity {
  return {
    isHoneypot: null,
    cannotBuy: null,
    cannotSellAll: null,
    canTakeBackOwnership: null,
    isMintable: null,
    isProxy: null,
    isOpenSource: null,
    slippageModifiable: null,
    transferPausable: null,
    tradingCooldown: null,
    externalCall: null,
    buyTaxPct: null,
    sellTaxPct: null,
    holderCount: null,
    creatorPercent: null,
    ownerPercent: null,
    top3HolderPct: null,
    top3HolderTags: [],
    lockedLpPct: null,
    unlockedLpPct: null,
    unavailable: true,
  };
}
