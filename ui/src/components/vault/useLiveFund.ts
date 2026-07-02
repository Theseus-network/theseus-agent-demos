"use client";

import { useEffect, useState } from "react";

export interface Position { id: string; marketId: string; question: string; url: string; side: "YES" | "NO"; entryPrice: number; curPrice: number; stake: number; value: number; pnl: number; est: number | null; yesPct: number; edge: number | null; runSeq: number; }
export interface TradeRec { ts: number; runSeq: number; action: string; size: number; est: number | null; yesPct: number; question: string; url: string; text: string; blockHash: string; }
export interface ResolvedRec { question: string; side: "YES" | "NO"; est: number | null; yesPct: number; stake: number; won: boolean; pnl: number; ts: number; runSeq: number; }
export interface VaultOnChain { tvl: number; shares: number; pricePerShare: number; redemptionsOpen: boolean; nextRedemptionOpen: number; }
export interface LiveFund {
  vault: VaultOnChain | null;
  positions: Position[];
  trades: TradeRec[];
  resolved: ResolvedRec[];
  runCount: number;
  capital: number;
  cash: number;
  deployed: number;
  bookPnl: number;
  avgEdge: number | null;
  status: "idle" | "trading";
  trading: boolean;
  nextTradeInMs: number;
  poolSize: number;
  agent: string;
  explorer: string;
}

export function useLiveFund(intervalMs = 4000): LiveFund | null {
  const [state, setState] = useState<LiveFund | null>(null);
  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const r = await fetch("/api/vault/state", { cache: "no-store" });
        const j = await r.json();
        if (alive && j.ok) setState(j as LiveFund);
      } catch {}
    }
    poll();
    const id = setInterval(poll, intervalMs);
    return () => { alive = false; clearInterval(id); };
  }, [intervalMs]);
  return state;
}
