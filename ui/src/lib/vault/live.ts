/**
 * Prediction-market fund engine (serverless-ready).
 *
 * State lives in Vercel Blob (see ./store). Request handlers are READ-ONLY:
 * readLive() loads the state and overlays live Polymarket odds for display.
 * The authoritative work — marking positions, settling NAV, and the agent's
 * autonomous trades — runs in tick(), driven by a Vercel cron (and, locally,
 * lazily from reads since there's no cron in dev).
 */
import { callSovereign, marketPrompt, parseTrade } from "./agent-call";
import { settlePnlUsd } from "./settle";
import { readVault } from "./read-vault";
import { loadState, saveState, initialState, BOOK_CAPITAL, type FundState, type Position } from "./store";

const MARK_MS = 30_000;
const MARKET_TTL_MS = 30_000;
const TRADE_MS = 20 * 60_000;       // the agent trades on its own on this cadence
const MAX_POSITIONS = 10;
const MAX_STAKE_FRAC = 0.12;
const NAV_SAMPLE_MS = 20 * 60_000;  // how often to record a NAV point
const NAV_MAX = 720;                // cap history length
const AGENT = process.env.NEXT_PUBLIC_THESEUS_AGENT_FUND ?? "5C8RTTrk13NkNS7B7UqiCciL5oTMTePyiHCvpmEUbApPJ1L6";
const hasBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

interface Market { id: string; question: string; yes: number; url: string; resolveAt: number | null; }
declare global { var __vaultPool: { at: number; markets: Market[] } | undefined; }
let devTicking = false; // local-dev only: avoid stacking lazy ticks in a single process

const MIN_VOL = 10_000;   // enough depth to be a real market
const MAX_DAYS = 30;      // trade markets that resolve soon, so the book turns over and NAV moves

// The universe is the most liquid, genuinely-uncertain binary markets that
// resolve soon. Bounding the window server-side (end_date_max) and ordering by
// volume is what keeps the book live and legible: it surfaces real markets that
// move day to day and settle within weeks — World Cup matches, Fed decisions,
// near-term events — instead of drowning in the endless intraday crypto candles
// that dominate a soonest-first feed. So the track record and NAV accumulate.
export async function fetchPool(): Promise<Market[]> {
  const minEnd = new Date(Date.now() + 2 * 3600_000).toISOString();   // skip markets resolving within a couple hours (near-decided)
  const maxEnd = new Date(Date.now() + MAX_DAYS * 86_400_000).toISOString();
  const url = `https://gamma-api.polymarket.com/markets?closed=false&active=true&order=volumeNum&ascending=false&limit=100&end_date_min=${encodeURIComponent(minEnd)}&end_date_max=${encodeURIComponent(maxEnd)}`;
  const r = await fetch(url, { cache: "no-store" });
  const arr = (await r.json()) as any[];
  const list = Array.isArray(arr) ? arr : ((arr as any).data ?? []);
  const out: Market[] = [];
  for (const m of list) {
    let prices = m.outcomePrices; try { if (typeof prices === "string") prices = JSON.parse(prices); } catch {}
    let outs = m.outcomes; try { if (typeof outs === "string") outs = JSON.parse(outs); } catch {}
    if (!Array.isArray(prices) || !Array.isArray(outs)) continue;
    const yi = outs.findIndex((o: string) => /^yes$/i.test(o));
    if (yi < 0) continue;
    const yes = Number(prices[yi]);
    if (!(yes > 0.12 && yes < 0.88)) continue;
    if (Number(m.volumeNum ?? m.volume ?? 0) < MIN_VOL) continue;
    const resolveAt = m.endDate ? Date.parse(m.endDate) : NaN;
    const days = (resolveAt - Date.now()) / 86_400_000;
    if (!Number.isFinite(days) || days < 0 || days > MAX_DAYS) continue; // must resolve soon (skip null/far dates)
    const q = m.question || m.title; if (!q) continue;
    const slug = m.slug || m.events?.[0]?.slug;
    out.push({ id: String(m.id ?? m.conditionId ?? q), question: q, yes, url: slug ? `https://polymarket.com/event/${slug}` : "https://polymarket.com", resolveAt });
    if (out.length >= 24) break;
  }
  return out;
}

async function getPool(force = false): Promise<Market[]> {
  const c = globalThis.__vaultPool;
  if (!force && c && Date.now() - c.at < MARKET_TTL_MS) return c.markets;
  try { const m = await fetchPool(); if (m.length) { globalThis.__vaultPool = { at: Date.now(), markets: m }; return m; } } catch {}
  return c?.markets ?? [];
}

async function resolveIfClosed(p: Position) {
  try {
    const m = await (await fetch(`https://gamma-api.polymarket.com/markets/${p.marketId}`, { cache: "no-store" })).json();
    if (!m || m.closed !== true) return null;
    let prices = m.outcomePrices; try { if (typeof prices === "string") prices = JSON.parse(prices); } catch {}
    let outs = m.outcomes; try { if (typeof outs === "string") outs = JSON.parse(outs); } catch {}
    const yi = Array.isArray(outs) ? outs.findIndex((o: string) => /^yes$/i.test(o)) : 0;
    const yesFinal = Array.isArray(prices) ? Number(prices[yi]) : NaN;
    if (!Number.isFinite(yesFinal)) return null;
    const finalSide = p.side === "YES" ? yesFinal : 1 - yesFinal;
    const value = p.stake * (finalSide / p.entryPrice);
    return { question: p.question, side: p.side, est: p.est, yesPct: p.yesPct, stake: p.stake, won: finalSide > 0.5, pnl: value - p.stake, ts: Date.now(), runSeq: p.runSeq };
  } catch { return null; }
}

async function doTrade(s: FundState, pool: Market[]) {
  const held = new Set(s.positions.map((p) => p.marketId));
  let market: Market | undefined;
  for (let i = 0; i < pool.length; i++) {
    const idx = (s.poolIdx + i) % pool.length;
    if (!held.has(pool[idx].id)) { market = pool[idx]; s.poolIdx = (idx + 1) % pool.length; break; }
  }
  if (!market) return;
  s.lastTradeAt = Date.now();
  s.tradingUntil = Date.now() + 150_000;
  await saveState(s); // publish "evaluating" so viewers see it across instances
  try {
    const yesPct = Math.round(market.yes * 100);
    const res = await callSovereign(marketPrompt(market.question, yesPct));
    const t = parseTrade(res.full);
    s.runCount += 1;
    const deployed = s.positions.reduce((a, p) => a + p.stake, 0);
    const cash = Math.max(0, BOOK_CAPITAL - deployed);
    if ((t.action === "BUY YES" || t.action === "BUY NO") && t.size > 0 && cash > 1 && s.positions.length < MAX_POSITIONS) {
      const side = t.action === "BUY YES" ? "YES" : "NO";
      const entryPrice = side === "YES" ? market.yes : 1 - market.yes;
      const stake = Math.max(1, Math.min((t.size / 100) * BOOK_CAPITAL, cash, BOOK_CAPITAL * MAX_STAKE_FRAC));
      s.positions.push({ id: `${market.id}-${s.runCount}`, marketId: market.id, question: market.question, url: market.url, side, entryPrice, curPrice: entryPrice, stake, est: t.est, yesPct, openedAt: Date.now(), runSeq: res.runSeq, misses: 0, resolveAt: market.resolveAt });
    }
    s.trades.unshift({ ts: Date.now(), runSeq: res.runSeq, action: t.action, size: t.size, est: t.est, yesPct, question: market.question, url: market.url, text: t.reason || res.decision, blockHash: res.blockHash });
  } catch (e) {
    s.trades.unshift({ ts: Date.now(), runSeq: -1, action: "ERROR", size: 0, est: null, yesPct: 0, question: market.question, url: market.url, text: e instanceof Error ? e.message : String(e), blockHash: "" });
  }
  s.trades = s.trades.slice(0, 12);
  s.tradingUntil = 0;
}

/**
 * Authoritative update: mark the book, settle NAV, and trade when due.
 * Cron-driven. Concurrency across serverless instances is coordinated through
 * the persisted, self-expiring `tradingUntil` marker (not an in-process lock,
 * which could get stuck true on a frozen instance and wedge the cron). Marking
 * is idempotent under last-write-wins; only trading is guarded, so at most one
 * instance opens a position per cadence.
 */
export async function tick(trade: boolean): Promise<void> {
  const s = await loadState();
  const pool = await getPool(true);
  const byId = new Map(pool.map((m) => [m.id, m]));
  const stillOpen: Position[] = [];
  for (const p of s.positions) {
    const m = byId.get(p.marketId);
    if (m) { p.curPrice = p.side === "YES" ? m.yes : 1 - m.yes; if (!p.url) p.url = m.url; p.misses = 0; stillOpen.push(p); continue; }
    p.misses = (p.misses ?? 0) + 1;
    if (p.misses >= 3) { const res = await resolveIfClosed(p); if (res) { s.resolved.unshift(res); s.resolved = s.resolved.slice(0, 20); continue; } }
    stillOpen.push(p);
  }
  s.positions = stillOpen;
  const totalPnl = s.positions.reduce((a, p) => a + p.stake * (p.curPrice / p.entryPrice - 1), 0) + s.resolved.reduce((a, r) => a + r.pnl, 0);
  const delta = totalPnl - s.lastSettledPnl;
  if (Math.abs(delta) >= 0.5) { const ok = await settlePnlUsd(delta); if (ok) s.lastSettledPnl = totalPnl; }
  s.lastMarkAt = Date.now();
  // Sample the on-chain NAV line — the product surface.
  const lastNav = s.navHistory[s.navHistory.length - 1];
  if (!lastNav || Date.now() - lastNav.t > NAV_SAMPLE_MS) {
    const v = await readVault();
    if (v) { s.navHistory.push({ t: Date.now(), pps: v.pricePerShare, tvl: v.tvl }); if (s.navHistory.length > NAV_MAX) s.navHistory = s.navHistory.slice(-NAV_MAX); }
  }
  const due = Date.now() - s.lastTradeAt > TRADE_MS && s.positions.length < MAX_POSITIONS && Date.now() >= (s.tradingUntil || 0);
  if (trade && due) await doTrade(s, pool);
  await saveState(s);
}

/** Force one trade now (ops/seeding only; not user-facing). */
export async function forceTrade(): Promise<void> {
  const s = await loadState();
  if (Date.now() < (s.tradingUntil || 0)) return; // a trade is already in flight
  await doTrade(s, await getPool(true));
  await saveState(s);
}

export interface LiveView {
  positions: (Position & { value: number; pnl: number; edge: number | null })[];
  trades: FundState["trades"]; resolved: FundState["resolved"]; runCount: number;
  capital: number; cash: number; deployed: number; bookPnl: number; avgEdge: number | null;
  agent: string; status: "idle" | "trading"; trading: boolean; nextTradeInMs: number; poolSize: number;
  navHistory: FundState["navHistory"]; startedAt: number;
}

/** Read-only view: load state, overlay live odds for display. */
export async function readLive(): Promise<LiveView> {
  const s = (await loadState()) ?? initialState();
  const pool = await getPool();
  const byId = new Map(pool.map((m) => [m.id, m]));
  const positions = s.positions.map((p) => {
    const m = byId.get(p.marketId);
    const cur = m ? (p.side === "YES" ? m.yes : 1 - m.yes) : p.curPrice;
    return { ...p, curPrice: cur, value: p.stake * (cur / p.entryPrice), pnl: p.stake * (cur / p.entryPrice - 1), edge: p.est != null ? (p.side === "YES" ? p.est - p.yesPct : p.yesPct - p.est) : null };
  });
  const deployed = s.positions.reduce((a, p) => a + p.stake, 0);
  const cash = Math.max(0, BOOK_CAPITAL - deployed);
  const bookPnl = positions.reduce((a, p) => a + p.pnl, 0);
  const edges = positions.map((p) => p.edge).filter((e): e is number => e != null);
  const avgEdge = edges.length ? edges.reduce((a, b) => a + b, 0) / edges.length : null;
  // Locally there is no cron, so drive the fund from reads (non-blocking).
  if (!hasBlob() && !devTicking && Date.now() - s.lastMarkAt > MARK_MS) {
    devTicking = true;
    tick(true).catch(() => {}).finally(() => { devTicking = false; });
  }
  const trading = Date.now() < (s.tradingUntil || 0);
  return {
    positions, trades: s.trades, resolved: s.resolved, runCount: s.runCount,
    capital: BOOK_CAPITAL, cash, deployed, bookPnl, avgEdge,
    agent: AGENT, status: trading ? "trading" : "idle", trading,
    nextTradeInMs: Math.max(0, TRADE_MS - (Date.now() - s.lastTradeAt)), poolSize: pool.length,
    navHistory: s.navHistory ?? [], startedAt: s.startedAt,
  };
}
