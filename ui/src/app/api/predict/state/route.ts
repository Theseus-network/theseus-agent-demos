// Live trader state for the app: the board overlays these prices and the Traders
// page reads the leaderboard. Returns the latest cron round from the store, or
// live:false when none has run yet (the app falls back to the bundled baseline).
import { readState } from "@/lib/predict/traders-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await readState();
  if (!s) return Response.json({ live: false });
  return Response.json({
    live: true,
    round: s.round,
    updatedAt: s.updatedAt,
    prices: Object.fromEntries((s.markets || []).map((m: any) => [m.id, { initialYes: m.initialYes, volumeUsd: m.volumeUsd }])),
    traders: s.traders,
  });
}
