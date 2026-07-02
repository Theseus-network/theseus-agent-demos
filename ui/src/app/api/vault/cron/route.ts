/**
 * Vercel Cron: the fund's heartbeat. Marks the book against live Polymarket
 * odds, settles NAV on Base Sepolia, resolves closed markets, and — when the
 * autonomous trading cadence is due — has the agent evaluate and take one
 * position. This is the only path that spends a paid on-chain run, so it is
 * driven by the scheduler, never by page polling.
 */
import { tick } from "@/lib/vault/live";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  if (process.env.CRON_SECRET && req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    await tick(true);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
