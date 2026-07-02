/**
 * On-demand trade: invoke the agent for one deliberate prediction-market call.
 * This is the only path that spends a paid on-chain run, so it is never
 * triggered automatically by polling.
 */
import { NextResponse } from "next/server";
import { runTrade } from "@/lib/vault/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    const rec = await runTrade();
    return NextResponse.json({ ok: true, trade: rec });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
