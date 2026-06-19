// Streams one agent-to-agent job: requester funds, provider delivers,
// adjudicator verifies and settles. Each step is an SSE event.
import { NextRequest } from "next/server";
import { runJob } from "@/lib/market/run";

export const runtime = "nodejs";
export const maxDuration = 180;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let task: string;
  let budget: number;
  let mode: "diligent" | "lazy";
  try {
    const body = await req.json();
    task = String(body.task ?? "");
    budget = Number(body.budget ?? 5);
    mode = body.mode === "lazy" ? "lazy" : "diligent";
    if (task.trim().length < 8) throw new Error("task too short");
    if (!Number.isFinite(budget) || budget <= 0 || budget > 100_000) throw new Error("bad budget");
  } catch {
    return new Response("invalid request", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      try {
        for await (const ev of runJob({ task: task.trim(), budget, mode })) {
          send(ev);
        }
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : "job failed" });
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
