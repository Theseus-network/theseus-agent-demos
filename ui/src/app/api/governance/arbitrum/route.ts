// GET /api/governance/arbitrum
//
// Returns the most recent N proposals from the Arbitrum DAO Snapshot
// space, mapped onto our reviewer's ProposalState shape. The UI calls
// this once when the visitor opens the "load live Arbitrum proposal"
// section, then lets them pick which one to feed into the existing
// review flow.

import { NextResponse } from "next/server";
import { fetchSnapshotProposals } from "@/lib/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const proposals = await fetchSnapshotProposals();
    return NextResponse.json(
      { proposals },
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
