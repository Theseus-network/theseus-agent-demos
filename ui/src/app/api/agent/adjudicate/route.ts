import { NextRequest, NextResponse } from "next/server";
import { adjudicateStream, type ResolutionResult } from "@/lib/adjudicator-llm";
import { findMarket, type PredictionMarket } from "@/lib/adjudicator-markets";
import { commitAdjudicatorVerdict } from "@/lib/agent-onchain/adjudicator";
import { streamWithCommit } from "@/lib/agent-onchain/stream-commit";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
export const runtime = "nodejs";

/** Type guard: accept an inline market payload (for live Polymarket
 *  picks the server didn't pre-register) only if it has the fields the
 *  agent actually consumes. Treat strings defensively. */
function isInlineMarket(x: unknown): x is PredictionMarket {
  if (!x || typeof x !== "object") return false;
  const m = x as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    typeof m.marketId === "number" &&
    typeof m.question === "string" &&
    Array.isArray(m.options) &&
    m.options.every((o) => typeof o === "string") &&
    typeof m.deadline === "string" &&
    typeof m.deadlineISO === "string" &&
    typeof m.resolutionCriteria === "string" &&
    typeof m.resolutionSource === "string"
  );
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured on the server" },
      { status: 503 },
    );
  }

  let body: { marketId?: string; market?: unknown };
  try {
    body = (await req.json()) as { marketId?: string; market?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  // Prefer registered markets (synthetic presets). Fall back to an
  // inline market payload, used by the live Polymarket pick path so
  // the client doesn't have to re-fetch on submit.
  let market: PredictionMarket | undefined;
  if (body.marketId) {
    market = findMarket(body.marketId);
  }
  if (!market && isInlineMarket(body.market)) {
    market = body.market;
  }
  if (!market) {
    return NextResponse.json(
      {
        error: body.marketId
          ? `unknown market: ${body.marketId}`
          : "missing marketId or inline market payload",
      },
      { status: body.marketId ? 404 : 400 },
    );
  }

  const stream = streamWithCommit({
    stream: adjudicateStream({ market }),
    pickFinal: (event) =>
      event.type === "final" ? (event.output as ResolutionResult) : null,
    commit: async (final) =>
      commitAdjudicatorVerdict({
        kind: "resolve",
        marketId: market.marketId,
        numOptions: market.options.length,
        winningOption: Math.max(
          0,
          Math.min(market.options.length - 1, final.winningOption),
        ),
        confidencePct: Math.max(0, Math.min(100, final.confidencePct)),
        blob: {
          schema: "prediction-market-adjudicator/v1",
          chain: "base-sepolia",
          market: {
            marketId: market.marketId,
            question: market.question,
            options: market.options,
          },
          resolution: final,
          committedAt: new Date().toISOString(),
        },
      }),
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
