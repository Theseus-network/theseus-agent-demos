/**
 * Persistent state for the prediction-market fund.
 *
 * On Vercel the filesystem is read-only and serverless functions don't share
 * memory, so the fund's book/trades/timers live in Vercel Blob (the same store
 * the rest of the app uses; set BLOB_READ_WRITE_TOKEN). Locally, with no blob
 * token, we keep it in a warm-instance singleton — same as a long-running dev
 * server. A short cache avoids a blob read on every poll.
 */
export interface Position { id: string; marketId: string; question: string; url: string; side: "YES" | "NO"; entryPrice: number; curPrice: number; stake: number; est: number | null; yesPct: number; openedAt: number; runSeq: number; misses: number; resolveAt: number | null; }
export interface TradeRec { ts: number; runSeq: number; action: string; size: number; est: number | null; yesPct: number; question: string; url: string; text: string; blockHash: string; }
export interface ResolvedRec { question: string; side: "YES" | "NO"; est: number | null; yesPct: number; stake: number; won: boolean; pnl: number; ts: number; runSeq: number; }

export interface NavPoint { t: number; pps: number; tvl: number; }

export interface FundState {
  startedAt: number;
  positions: Position[];
  trades: TradeRec[];
  resolved: ResolvedRec[];
  runCount: number;
  lastTradeAt: number;
  lastMarkAt: number;
  lastSettledPnl: number;
  poolIdx: number;
  tradingUntil: number; // while > now, the agent is mid-evaluation (shown across instances)
  navHistory: NavPoint[]; // on-chain NAV/share sampled over time — the product surface
}

export const BOOK_CAPITAL = 25_000;
const KEY = "vault/pm-state-v1.json";
const CACHE_MS = 3000;
const hasBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

declare global { var __vaultCache: { at: number; state: FundState } | undefined; }

export function initialState(): FundState {
  return { startedAt: Date.now(), positions: [], trades: [], resolved: [], runCount: 0, lastTradeAt: Date.now(), lastMarkAt: 0, lastSettledPnl: 0, poolIdx: 0, tradingUntil: 0, navHistory: [] };
}

/** Default fields added after a blob was first written, so old state loads safely. */
function migrate(s: FundState): FundState {
  if (!Array.isArray(s.navHistory)) s.navHistory = [];
  if (!Array.isArray(s.positions)) s.positions = [];
  if (!Array.isArray(s.trades)) s.trades = [];
  if (!Array.isArray(s.resolved)) s.resolved = [];
  if (!s.startedAt) s.startedAt = Date.now();
  return s;
}

export async function loadState(): Promise<FundState> {
  if (!hasBlob()) return globalThis.__vaultCache?.state ?? initialState();
  const c = globalThis.__vaultCache;
  if (c && Date.now() - c.at < CACHE_MS) return c.state;
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: KEY });
    const b = blobs.find((x) => x.pathname === KEY) || blobs[0];
    if (b) {
      const state = migrate((await (await fetch(b.url, { cache: "no-store" })).json()) as FundState);
      globalThis.__vaultCache = { at: Date.now(), state };
      return state;
    }
  } catch { /* fall through */ }
  return c?.state ?? initialState();
}

export async function saveState(state: FundState): Promise<void> {
  globalThis.__vaultCache = { at: Date.now(), state };
  if (!hasBlob()) return;
  try {
    const { put } = await import("@vercel/blob");
    await put(KEY, JSON.stringify(state), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
  } catch { /* keep the warm cache even if the write fails */ }
}
