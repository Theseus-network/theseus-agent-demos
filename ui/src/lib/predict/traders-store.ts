// Where the live trader state + agent-moved prices live across cron rounds.
// On Vercel the filesystem is read-only, so we persist to Vercel Blob (set
// BLOB_READ_WRITE_TOKEN). Locally we read/write the bundled JSON files, which is
// what scripts/predict-traders.mts does. The bundled files are always the
// baseline when the blob is empty.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export interface PredictState {
  round: number;
  updatedAt: string;
  traders: any[];
  markets: any[];
}

const KEY = "predict/state-v1.json";
const MARKETS_FILE = resolve(process.cwd(), "src/lib/predict/agent-markets.json");
const TRADERS_FILE = resolve(process.cwd(), "src/lib/predict/agent-traders.json");
const hasBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

function fromFiles(): PredictState | null {
  try {
    const t = JSON.parse(readFileSync(TRADERS_FILE, "utf8"));
    const markets = JSON.parse(readFileSync(MARKETS_FILE, "utf8"));
    return { round: t.round ?? 0, updatedAt: t.updatedAt ?? "", traders: t.traders ?? [], markets };
  } catch {
    return null;
  }
}

/** Latest state from the blob; null if none yet (callers fall back to bundled). */
export async function readState(): Promise<PredictState | null> {
  if (hasBlob()) {
    try {
      const { list } = await import("@vercel/blob");
      const { blobs } = await list({ prefix: KEY });
      const b = blobs.find((x) => x.pathname === KEY) || blobs[0];
      if (b) return (await (await fetch(b.url, { cache: "no-store" })).json()) as PredictState;
    } catch { /* fall through */ }
    return null;
  }
  return fromFiles();
}

/** State to start a round from: the blob if present, else the bundled baseline. */
export async function baselineState(): Promise<PredictState | null> {
  return (await readState()) ?? fromFiles();
}

export async function writeState(state: PredictState): Promise<void> {
  if (hasBlob()) {
    const { put } = await import("@vercel/blob");
    await put(KEY, JSON.stringify(state), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
    return;
  }
  writeFileSync(TRADERS_FILE, JSON.stringify({ round: state.round, updatedAt: state.updatedAt, traders: state.traders }, null, 2));
  writeFileSync(MARKETS_FILE, JSON.stringify(state.markets, null, 2));
}
