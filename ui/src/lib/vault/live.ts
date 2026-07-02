/**
 * Prediction-market fund engine.
 *
 * - The fund holds a book of positions in real prediction markets (Polymarket).
 * - MARKING is continuous and FREE: positions are re-priced against live odds
 *   and the vault NAV is settled to the book P&L. No agent calls.
 * - TRADING is deliberate and rare: the agent is invoked (a paid Theseus run)
 *   only on demand or on a long lazy cadence.
 * - Each decision carries the agent's own probability ESTIMATE, so we can show
 *   the edge (agent vs market) — the reason a position exists.
 */
import { callSovereign, marketPrompt, parseTrade } from "./agent-call";
import { settlePnlUsd } from "./settle";

const BOOK_CAPITAL = 25_000;
const MARK_MS = 30_000;
const MARKET_TTL_MS = 30_000;
const TRADE_MS = 20 * 60_000; // the agent trades on its own on this cadence; nobody can trigger it
const MAX_POSITIONS = 6;
const MAX_STAKE_FRAC = 0.15;
const AGENT = process.env.NEXT_PUBLIC_THESEUS_AGENT_FUND ?? "5C8RTTrk13NkNS7B7UqiCciL5oTMTePyiHCvpmEUbApPJ1L6";

export interface Position { id: string; marketId: string; question: string; url: string; side: "YES" | "NO"; entryPrice: number; curPrice: number; stake: number; est: number | null; yesPct: number; openedAt: number; runSeq: number; misses: number; }
export interface TradeRec { ts: number; runSeq: number; action: string; size: number; est: number | null; yesPct: number; question: string; url: string; text: string; blockHash: string; }
export interface ResolvedRec { question: string; side: "YES" | "NO"; est: number | null; yesPct: number; stake: number; won: boolean; pnl: number; ts: number; runSeq: number; }
interface Market { id: string; question: string; yes: number; url: string; }

interface State {
  startedAt: number; capital: number;
  positions: Position[]; trades: TradeRec[]; resolved: ResolvedRec[]; runCount: number;
  lastTradeAt: number; lastMarkAt: number; lastSettledPnl: number;
  pool: Market[]; poolAt: number; poolIdx: number;
  agent: string; status: "idle" | "trading";
}
interface Cell { state: State; trading: boolean; }
declare global { var __pmFund2: Cell | undefined; }

function cell(): Cell {
  if (!globalThis.__pmFund2) {
    globalThis.__pmFund2 = {
      trading: false,
      state: {
        startedAt: Date.now(), capital: BOOK_CAPITAL,
        positions: [], trades: [], resolved: [], runCount: 0,
        lastTradeAt: Date.now(), lastMarkAt: 0, lastSettledPnl: 0,
        pool: [], poolAt: 0, poolIdx: 0, agent: AGENT, status: "idle",
      },
    };
  }
  return globalThis.__pmFund2;
}

async function fetchPool(): Promise<Market[]> {
  const url = "https://gamma-api.polymarket.com/markets?closed=false&active=true&order=volumeNum&ascending=false&limit=120";
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json();
  const arr = Array.isArray(j) ? j : (j.data ?? []);
  const out: Market[] = [];
  for (const m of arr) {
    let prices = m.outcomePrices; try { if (typeof prices === "string") prices = JSON.parse(prices); } catch {}
    let outs = m.outcomes; try { if (typeof outs === "string") outs = JSON.parse(outs); } catch {}
    if (!Array.isArray(prices) || !Array.isArray(outs)) continue;
    const yi = outs.findIndex((o: string) => /^yes$/i.test(o));
    if (yi < 0) continue;
    const yes = Number(prices[yi]);
    if (!(yes > 0.12 && yes < 0.88)) continue;
    const q = m.question || m.title;
    if (!q) continue;
    const slug = m.slug || m.events?.[0]?.slug;
    out.push({ id: String(m.id ?? m.conditionId ?? q), question: q, yes, url: slug ? `https://polymarket.com/event/${slug}` : "https://polymarket.com" });
    if (out.length >= 24) break;
  }
  return out;
}

/** If a held market dropped out of the active set, check whether it resolved. */
async function resolveIfClosed(p: Position): Promise<ResolvedRec | null> {
  try {
    const r = await fetch(`https://gamma-api.polymarket.com/markets/${p.marketId}`, { cache: "no-store" });
    const m = await r.json();
    if (!m || m.closed !== true) return null;
    let prices = m.outcomePrices; try { if (typeof prices === "string") prices = JSON.parse(prices); } catch {}
    let outs = m.outcomes; try { if (typeof outs === "string") outs = JSON.parse(outs); } catch {}
    const yi = Array.isArray(outs) ? outs.findIndex((o: string) => /^yes$/i.test(o)) : 0;
    const yesFinal = Array.isArray(prices) ? Number(prices[yi]) : NaN;
    if (!Number.isFinite(yesFinal)) return null;
    const finalSide = p.side === "YES" ? yesFinal : 1 - yesFinal; // 1 if won, 0 if lost
    const value = p.stake * (finalSide / p.entryPrice);
    return { question: p.question, side: p.side, est: p.est, yesPct: p.yesPct, stake: p.stake, won: finalSide > 0.5, pnl: value - p.stake, ts: Date.now(), runSeq: p.runSeq };
  } catch { return null; }
}

async function mark() {
  const c = cell(); const s = c.state;
  if (Date.now() - s.lastMarkAt < MARK_MS) return;
  if (s.pool.length === 0 || Date.now() - s.poolAt > MARKET_TTL_MS) {
    try { const p = await fetchPool(); if (p.length) { s.pool = p; s.poolAt = Date.now(); } } catch {}
  }
  const byId = new Map(s.pool.map((m) => [m.id, m]));
  const stillOpen: Position[] = [];
  for (const p of s.positions) {
    const m = byId.get(p.marketId);
    if (m) { p.curPrice = p.side === "YES" ? m.yes : 1 - m.yes; if (!p.url) p.url = m.url; p.misses = 0; stillOpen.push(p); continue; }
    // absent from the active set — may have resolved
    p.misses = (p.misses ?? 0) + 1;
    if (p.misses >= 3) {
      const res = await resolveIfClosed(p);
      if (res) { s.resolved.unshift(res); s.resolved = s.resolved.slice(0, 20); continue; } // drop from book
    }
    stillOpen.push(p);
  }
  s.positions = stillOpen;
  const totalPnl = s.positions.reduce((a, p) => a + p.stake * (p.curPrice / p.entryPrice - 1), 0)
    + s.resolved.reduce((a, r) => a + r.pnl, 0);
  const delta = totalPnl - s.lastSettledPnl;
  if (Math.abs(delta) >= 0.5) { await settlePnlUsd(delta); s.lastSettledPnl = totalPnl; }
  s.lastMarkAt = Date.now();
}

export async function runTrade(): Promise<TradeRec | null> {
  const c = cell(); const s = c.state;
  if (c.trading) return null;
  if (s.pool.length === 0) { try { s.pool = await fetchPool(); s.poolAt = Date.now(); } catch {} }
  if (s.pool.length === 0) return null;

  const held = new Set(s.positions.map((p) => p.marketId));
  let market: Market | undefined;
  for (let i = 0; i < s.pool.length; i++) {
    const idx = (s.poolIdx + i) % s.pool.length;
    if (!held.has(s.pool[idx].id)) { market = s.pool[idx]; s.poolIdx = (idx + 1) % s.pool.length; break; }
  }
  if (!market) return null;

  c.trading = true; s.status = "trading"; s.lastTradeAt = Date.now();
  try {
    const yesPct = Math.round(market.yes * 100);
    const res = await callSovereign(marketPrompt(market.question, yesPct));
    const t = parseTrade(res.full);
    s.runCount += 1;

    const deployed = s.positions.reduce((a, p) => a + p.stake, 0);
    const cash = Math.max(0, s.capital - deployed);
    if ((t.action === "BUY YES" || t.action === "BUY NO") && t.size > 0 && cash > 1 && s.positions.length < MAX_POSITIONS) {
      const side = t.action === "BUY YES" ? "YES" : "NO";
      const entryPrice = side === "YES" ? market.yes : 1 - market.yes;
      const stake = Math.max(1, Math.min((t.size / 100) * s.capital, cash, s.capital * MAX_STAKE_FRAC));
      s.positions.push({ id: `${market.id}-${s.runCount}`, marketId: market.id, question: market.question, url: market.url, side, entryPrice, curPrice: entryPrice, stake, est: t.est, yesPct, openedAt: Date.now(), runSeq: res.runSeq, misses: 0 });
    }
    const rec: TradeRec = { ts: Date.now(), runSeq: res.runSeq, action: t.action, size: t.size, est: t.est, yesPct, question: market.question, url: market.url, text: t.reason || res.decision, blockHash: res.blockHash };
    s.trades.unshift(rec); s.trades = s.trades.slice(0, 12);
    return rec;
  } catch (e) {
    s.trades.unshift({ ts: Date.now(), runSeq: -1, action: "ERROR", size: 0, est: null, yesPct: 0, question: market.question, url: market.url, text: e instanceof Error ? e.message : String(e), blockHash: "" });
    s.trades = s.trades.slice(0, 12);
    return null;
  } finally { c.trading = false; s.status = "idle"; }
}

export interface LiveView {
  positions: (Position & { value: number; pnl: number; edge: number | null })[];
  trades: TradeRec[]; resolved: ResolvedRec[]; runCount: number;
  capital: number; cash: number; deployed: number; bookPnl: number; avgEdge: number | null;
  agent: string; status: "idle" | "trading"; trading: boolean; nextTradeInMs: number; poolSize: number;
}

export async function readLive(): Promise<LiveView> {
  const c = cell(); const s = c.state;
  await mark().catch(() => {});
  if (!c.trading && Date.now() - s.lastTradeAt > TRADE_MS) runTrade().catch(() => {});
  const deployed = s.positions.reduce((a, p) => a + p.stake, 0);
  const cash = Math.max(0, s.capital - deployed);
  const positions = s.positions.map((p) => ({
    ...p,
    value: p.stake * (p.curPrice / p.entryPrice),
    pnl: p.stake * (p.curPrice / p.entryPrice - 1),
    edge: p.est != null ? (p.side === "YES" ? p.est - p.yesPct : p.yesPct - p.est) : null,
  }));
  const bookPnl = positions.reduce((a, p) => a + p.pnl, 0);
  const edges = positions.map((p) => p.edge).filter((e): e is number => e != null);
  const avgEdge = edges.length ? edges.reduce((a, b) => a + b, 0) / edges.length : null;
  return {
    positions, trades: s.trades, resolved: s.resolved, runCount: s.runCount,
    capital: s.capital, cash, deployed, bookPnl, avgEdge,
    agent: s.agent, status: s.status, trading: c.trading,
    nextTradeInMs: Math.max(0, TRADE_MS - (Date.now() - s.lastTradeAt)), poolSize: s.pool.length,
  };
}
