"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  applyShares,
  priceYes,
  quoteBuy,
  seedShares,
  sellProceeds,
} from "./amm";
import { genHistory } from "./seed";
import { fetchLiveMarkets, FALLBACK_MARKETS } from "./markets";
import type {
  MarketRuntime,
  Outcome,
  Position,
  SeedMarket,
  Settlement,
  Trade,
} from "./types";

const STORAGE_KEY = "theseus-predict-v2";
const STARTING_BALANCE = 1_000;
const FAUCET_AMOUNT = 1_000;

export interface SettledPosition {
  marketId: number;
  title: string;
  icon: string;
  yesShares: number;
  noShares: number;
  costBasis: number;
  payout: number;
  winningOutcome: Outcome | null;
  settledAt: number;
}

export interface PredictState {
  hydrated: boolean;
  live: boolean;
  balance: number;
  positions: Record<number, Position>;
  trades: Trade[];
  markets: Record<number, MarketRuntime>;
  marketList: SeedMarket[];
  settlements: Record<number, Settlement>;
  settledPositions: SettledPosition[];
}

const EMPTY: PredictState = {
  hydrated: false,
  live: false,
  balance: 0,
  positions: {},
  trades: [],
  markets: {},
  marketList: [],
  settlements: {},
  settledPositions: [],
};

let state: PredictState = EMPTY;
const listeners = new Set<() => void>();

// Dynamic id -> market metadata map, rebuilt whenever the list changes.
let metaMap = new Map<number, SeedMarket>();
function rebuildMeta(list: SeedMarket[]) {
  metaMap = new Map(list.map((m) => [m.id, m]));
}

export const marketMeta = (id: number) => metaMap.get(id);
export const liquidityB = (id: number) => metaMap.get(id)?.liquidityB ?? 5000;

function emit() {
  for (const l of listeners) l();
  persist();
}
function set(next: Partial<PredictState>) {
  state = { ...state, ...next };
  emit();
}

function persist() {
  if (typeof window === "undefined" || !state.hydrated) return;
  try {
    // Persist user state only. Market odds are reseeded live each load.
    const { balance, positions, trades, settlements, settledPositions } = state;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ balance, positions, trades, settlements, settledPositions }),
    );
  } catch {
    /* quota / private mode — ignore */
  }
}

function seedRuntime(list: SeedMarket[], keep: Record<number, MarketRuntime>): Record<number, MarketRuntime> {
  const out: Record<number, MarketRuntime> = {};
  for (const m of list) {
    // Preserve runtime for markets the user already holds a position in.
    if (keep[m.id] && state.positions[m.id]) {
      out[m.id] = keep[m.id];
      continue;
    }
    const { qYes, qNo } = seedShares(m.initialYes, m.liquidityB);
    out[m.id] = {
      qYes,
      qNo,
      volumeUsd: m.volumeUsd,
      history: genHistory(m.id, m.initialYes),
    };
  }
  return out;
}

let hydrating = false;
function ensureHydrated() {
  if (state.hydrated || hydrating || typeof window === "undefined") return;
  hydrating = true;
  rebuildMeta(FALLBACK_MARKETS);
  const base: PredictState = {
    hydrated: true,
    live: false,
    balance: STARTING_BALANCE,
    positions: {},
    trades: [],
    markets: seedRuntime(FALLBACK_MARKETS, {}),
    marketList: FALLBACK_MARKETS,
    settlements: {},
    settledPositions: [],
  };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<PredictState>;
      base.balance = typeof saved.balance === "number" ? saved.balance : base.balance;
      base.positions = saved.positions ?? {};
      base.trades = saved.trades ?? [];
      base.settlements = saved.settlements ?? {};
      base.settledPositions = saved.settledPositions ?? [];
    }
  } catch {
    /* corrupt store — fall back to fresh */
  }
  state = base;
  emit();
  void loadLive();
}

async function loadLive() {
  const { markets: list, live } = await fetchLiveMarkets();
  rebuildMeta(list);
  set({
    marketList: list,
    markets: seedRuntime(list, state.markets),
    live,
  });
}

// ---- external-store wiring -------------------------------------------------

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
const getSnapshot = () => state;
const getServerSnapshot = () => EMPTY;

export function usePredict(): PredictState {
  useEffect(() => {
    ensureHydrated();
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function findMarketBySlug(s: PredictState, slug: string): SeedMarket | undefined {
  return s.marketList.find((m) => m.slug === slug);
}

export function marketPriceYes(id: number): number {
  const m = state.markets[id];
  if (!m) return metaMap.get(id)?.initialYes ?? 0.5;
  return priceYes(m.qYes, m.qNo, liquidityB(id));
}

export function emptyPosition(marketId: number): Position {
  return { marketId, yesShares: 0, noShares: 0, yesCost: 0, noCost: 0 };
}

// ---- actions ---------------------------------------------------------------

export function faucet(amount = FAUCET_AMOUNT) {
  set({ balance: state.balance + amount });
}

export function resetAccount() {
  state = {
    ...state,
    balance: STARTING_BALANCE,
    positions: {},
    trades: [],
    settlements: {},
    settledPositions: [],
    markets: seedRuntime(state.marketList, {}),
  };
  emit();
}

let tradeSeq = 0;
function tradeId() {
  tradeSeq += 1;
  return `${Date.now().toString(36)}-${tradeSeq}`;
}

export function buy(marketId: number, side: Outcome, usdc: number) {
  const rt = state.markets[marketId];
  if (!rt || usdc <= 0 || usdc > state.balance) return null;
  const b = liquidityB(marketId);
  const { shares, avgPrice } = quoteBuy(rt.qYes, rt.qNo, b, side, usdc);
  if (shares <= 0) return null;
  const next = applyShares(rt.qYes, rt.qNo, side, shares);
  const newHistory = [
    ...rt.history,
    { t: Date.now(), pYes: priceYes(next.qYes, next.qNo, b) },
  ].slice(-120);
  const pos = state.positions[marketId] ?? emptyPosition(marketId);
  const updatedPos: Position =
    side === "YES"
      ? { ...pos, yesShares: pos.yesShares + shares, yesCost: pos.yesCost + usdc }
      : { ...pos, noShares: pos.noShares + shares, noCost: pos.noCost + usdc };
  const trade: Trade = {
    id: tradeId(),
    marketId,
    side,
    action: "buy",
    shares,
    usdc,
    avgPrice,
    ts: Date.now(),
  };
  set({
    balance: state.balance - usdc,
    markets: {
      ...state.markets,
      [marketId]: { ...rt, qYes: next.qYes, qNo: next.qNo, volumeUsd: rt.volumeUsd + usdc, history: newHistory },
    },
    positions: { ...state.positions, [marketId]: updatedPos },
    trades: [trade, ...state.trades].slice(0, 200),
  });
  return { shares, avgPrice };
}

export function sell(marketId: number, side: Outcome, shares: number) {
  const rt = state.markets[marketId];
  const pos = state.positions[marketId];
  if (!rt || !pos || shares <= 0) return null;
  const held = side === "YES" ? pos.yesShares : pos.noShares;
  const sellShares = Math.min(shares, held);
  if (sellShares <= 0) return null;
  const b = liquidityB(marketId);
  const proceeds = sellProceeds(rt.qYes, rt.qNo, b, side, sellShares);
  const next = applyShares(rt.qYes, rt.qNo, side, -sellShares);
  const newHistory = [
    ...rt.history,
    { t: Date.now(), pYes: priceYes(next.qYes, next.qNo, b) },
  ].slice(-120);
  const heldCost = side === "YES" ? pos.yesCost : pos.noCost;
  const costReduction = held > 0 ? (heldCost * sellShares) / held : 0;
  const updatedPos: Position =
    side === "YES"
      ? { ...pos, yesShares: pos.yesShares - sellShares, yesCost: pos.yesCost - costReduction }
      : { ...pos, noShares: pos.noShares - sellShares, noCost: pos.noCost - costReduction };
  const trade: Trade = {
    id: tradeId(),
    marketId,
    side,
    action: "sell",
    shares: sellShares,
    usdc: proceeds,
    avgPrice: sellShares > 0 ? proceeds / sellShares : 0,
    ts: Date.now(),
  };
  set({
    balance: state.balance + proceeds,
    markets: {
      ...state.markets,
      [marketId]: { ...rt, qYes: next.qYes, qNo: next.qNo, volumeUsd: rt.volumeUsd + proceeds, history: newHistory },
    },
    positions: { ...state.positions, [marketId]: updatedPos },
    trades: [trade, ...state.trades].slice(0, 200),
  });
  return { proceeds };
}

/** Apply the agent's verdict: pay winners, refund on UNRESOLVABLE, archive. */
export function applySettlement(s: Settlement) {
  if (state.settlements[s.marketId]) return;
  const pos = state.positions[s.marketId];
  const meta = metaMap.get(s.marketId);
  if (pos) {
    const costBasis = pos.yesCost + pos.noCost;
    let payout = 0;
    if (s.verdict === "UNRESOLVABLE") payout = costBasis;
    else if (s.winningOutcome === "YES") payout = pos.yesShares;
    else if (s.winningOutcome === "NO") payout = pos.noShares;
    const settled: SettledPosition = {
      marketId: s.marketId,
      title: meta?.shortTitle ?? `Market ${s.marketId}`,
      icon: meta?.icon ?? "•",
      yesShares: pos.yesShares,
      noShares: pos.noShares,
      costBasis,
      payout,
      winningOutcome: s.winningOutcome,
      settledAt: s.settledAt,
    };
    const { [s.marketId]: _drop, ...restPos } = state.positions;
    void _drop;
    set({
      balance: state.balance + payout,
      positions: restPos,
      settledPositions: [settled, ...state.settledPositions],
      settlements: { ...state.settlements, [s.marketId]: s },
    });
  } else {
    set({ settlements: { ...state.settlements, [s.marketId]: s } });
  }
}
