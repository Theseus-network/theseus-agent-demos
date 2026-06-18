// Streams the agent settling a disputed escrow deal: reads the deal from the
// contract, streams the arbiter's reasoning (SSE), then posts resolve() on
// chain and streams the tx hash. Only deals in DISPUTED status are accepted.

import { NextRequest } from "next/server";
import { escrowAdjudicateStream } from "@/lib/escrow/llm";
import { readDeal, resolveOnChain } from "@/lib/escrow/settle";
import { STATUS } from "@/lib/escrow/abi";
import { ESCROW } from "@/lib/deployed-contracts";
import { basescanTxUrl } from "@/lib/agent-onchain/wallet";

export const runtime = "nodejs";
export const maxDuration = 120;

function fmtAmount(amount: bigint): string {
  const whole = amount / 10n ** BigInt(ESCROW.usdcDecimals);
  return `${whole.toLocaleString("en-US")} ${ESCROW.usdcSymbol}`;
}

export async function POST(req: NextRequest) {
  let dealId: number;
  try {
    const body = await req.json();
    dealId = Number(body.dealId);
    if (!Number.isInteger(dealId) || dealId <= 0) throw new Error("bad dealId");
  } catch {
    return new Response("invalid request", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      try {
        const deal = await readDeal(dealId);
        if (deal.status !== STATUS.DISPUTED) {
          send("error", { message: "Deal is not in dispute; only a disputed deal can be settled by the agent." });
          controller.close();
          return;
        }

        send("deal", {
          dealId,
          spec: deal.spec,
          delivery: deal.delivery,
          amountLabel: fmtAmount(deal.amount),
        });

        for await (const ev of escrowAdjudicateStream({
          dealId,
          spec: deal.spec,
          delivery: deal.delivery,
          amountLabel: fmtAmount(deal.amount),
        })) {
          if (ev.type === "final") {
            send("verdict", ev.output);
            // Post resolve() on chain.
            try {
              const hash = await resolveOnChain(
                dealId,
                ev.output.verdict,
                ev.output.confidencePct,
                ev.output.evidenceSummary,
              );
              send("settled", { txHash: hash, url: basescanTxUrl(hash) });
            } catch (e) {
              send("settle_error", {
                message: e instanceof Error ? e.message : "on-chain settlement failed",
              });
            }
          } else {
            send(ev.type, ev);
          }
        }
        send("done", {});
      } catch (e) {
        send("error", { message: e instanceof Error ? e.message : "settlement failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
