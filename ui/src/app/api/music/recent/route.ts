// GET /api/music/recent
//
// Thin wrapper over `fetchRecentReleases()`. The Marcellus demo UI
// calls this once when the visitor opens the "or assign a real new
// release" section, then lets them pick one to feed into the agent.
//
// Mirrors src/app/api/governance/arbitrum/route.ts.

import { NextResponse } from "next/server";
import { fetchRecentReleases } from "@/lib/music-feeds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const releases = await fetchRecentReleases(6);
    return NextResponse.json(
      { releases },
      {
        headers: {
          // Browser/edge cache mirrors the server-side revalidate (3h).
          "cache-control":
            "public, s-maxage=10800, stale-while-revalidate=21600",
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 },
    );
  }
}
