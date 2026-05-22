// POST /api/legal/verify
//
// Thin wrapper around the CourtListener citation-lookup client. Accepts
// { citation: string } and returns the structured CitationVerification.
// The Quill demo route consumes this directly server-side; we also
// expose it as a public endpoint so the verification step is auditable
// independently of the LLM call.

import { NextRequest, NextResponse } from "next/server";
import { verifyCitation } from "@/lib/courtlistener";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const b = body as { citation?: unknown };
  if (typeof b.citation !== "string" || !b.citation.trim()) {
    return NextResponse.json(
      { error: "citation is required" },
      { status: 400 },
    );
  }
  const verification = await verifyCitation(b.citation);
  return NextResponse.json(verification, {
    headers: {
      // Same staleness window as the lib-level next.revalidate. The
      // server cache absorbs duplicate requests within the hour.
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=7200",
    },
  });
}
