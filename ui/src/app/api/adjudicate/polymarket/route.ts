// GET /api/adjudicate/polymarket
//
// Returns the top-N high-volume binary Polymarket markets, mapped onto
// the adjudicator's PredictionMarket shape so the UI can hand the
// selection straight into the existing streaming adjudicate pipeline.

import { NextResponse } from "next/server";
import { fetchActiveMarkets } from "@/lib/polymarket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const markets = await fetchActiveMarkets();
    return NextResponse.json(
      { markets },
      {
        headers: {
          "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
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
