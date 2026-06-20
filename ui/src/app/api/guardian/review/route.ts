import { guardianReviewStream, type GuardianInput } from "@/lib/guardian/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request) {
  let body: Partial<GuardianInput>;
  try {
    body = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }
  const input: GuardianInput = {
    title: String(body.title ?? "Untitled action").slice(0, 200),
    claim: String(body.claim ?? "").slice(0, 4000),
    action: String(body.action ?? "").slice(0, 6000),
    mode: body.mode === "guardrail" ? "guardrail" : "onchain",
  };
  if (!input.action.trim()) {
    return new Response("missing action", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of guardianReviewStream(input)) {
          if (ev.type === "text_delta") {
            controller.enqueue(encoder.encode(sse("text_delta", { text: ev.text })));
          } else if (ev.type === "final") {
            controller.enqueue(encoder.encode(sse("verdict", ev.output)));
          }
        }
      } catch (e) {
        controller.enqueue(
          encoder.encode(sse("error", { message: e instanceof Error ? e.message : "review failed" })),
        );
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
