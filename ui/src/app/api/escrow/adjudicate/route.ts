// Streams an escrow verdict. role=arbiter (default) runs the primary arbiter;
// role=sentinel runs the independent appeals agent (different model, blind to the
// first verdict). Same SSE shape as the prediction-market adjudicator.
import { NextRequest, NextResponse } from "next/server";
import {
  escrowAdjudicateStream,
  SENTINEL_MODEL,
  SENTINEL_SYSTEM_PROMPT,
  type EscrowAdjudicateInput,
} from "@/lib/escrow/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const sse = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured on the server" }, { status: 503 });
  }

  let body: { dealId?: number; spec?: string; delivery?: string; amountLabel?: string; role?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }
  if (typeof body.spec !== "string" || typeof body.delivery !== "string") {
    return NextResponse.json({ error: "missing spec or delivery" }, { status: 400 });
  }

  const input: EscrowAdjudicateInput = {
    dealId: Number(body.dealId) || 0,
    spec: body.spec,
    delivery: body.delivery,
    amountLabel: String(body.amountLabel ?? ""),
  };
  const opts = body.role === "sentinel" ? { model: SENTINEL_MODEL, system: SENTINEL_SYSTEM_PROMPT } : undefined;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of escrowAdjudicateStream(input, opts)) {
          controller.enqueue(encoder.encode(sse(event)));
        }
      } catch (e) {
        controller.enqueue(encoder.encode(sse({ type: "error", error: e instanceof Error ? e.message : String(e) })));
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
