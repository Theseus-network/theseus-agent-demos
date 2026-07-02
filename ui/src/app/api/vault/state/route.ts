/**
 * Live fund state. The UI polls this; marking the book against live odds and
 * settling NAV happen here (free). Trading does not happen here.
 */
import { NextResponse } from "next/server";
import { readLive } from "@/lib/vault/live";
import { readVault } from "@/lib/vault/read-vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [f, vault] = await Promise.all([readLive(), readVault()]);
    return NextResponse.json({
      ok: true,
      vault,
      positions: f.positions,
      trades: f.trades,
      resolved: f.resolved,
      runCount: f.runCount,
      capital: f.capital,
      cash: f.cash,
      deployed: f.deployed,
      bookPnl: f.bookPnl,
      avgEdge: f.avgEdge,
      status: f.status,
      trading: f.trading,
      nextTradeInMs: f.nextTradeInMs,
      poolSize: f.poolSize,
      agent: f.agent,
      explorer: `https://explorer.theseus.network/agents/${f.agent}`,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
