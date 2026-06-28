import { NextRequest, NextResponse } from "next/server";
import { adjudicateStream } from "@/lib/adjudicator-llm";
import { findMarket, type PredictionMarket } from "@/lib/adjudicator-markets";
import { sse } from "@/lib/llm-stream";
import { resolveOnChain } from "@/lib/predict/resolve-onchain";

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

  // Stream the agent's reasoning and verdict straight through. The agent
  // is deployed sovereign on the Theseus testnet; there is no second
  // settlement chain to post to.
  const encoder = new TextEncoder();
  const agentStream = adjudicateStream({ market });
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of agentStream) {
          controller.enqueue(encoder.encode(sse(event as object)));
          // When the agent commits a verdict, write it on-chain (no-op unless
          // the contract + settler key are configured).
          const ev = event as { type?: string; output?: { verdict?: string; winningOption?: number } };
          if (ev?.type === "final" && ev.output?.verdict === "RESOLVED" && (ev.output.winningOption === 0 || ev.output.winningOption === 1)) {
            const tx = await resolveOnChain(market.marketId, ev.output.winningOption === 0 ? "YES" : "NO");
            if (tx) controller.enqueue(encoder.encode(sse({ type: "settled_onchain", tx, chain: "base-sepolia" })));
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        controller.enqueue(encoder.encode(sse({ type: "error", error: msg })));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
