import { NextRequest } from "next/server";
import { streamChat, type ChatMessage } from "@/lib/chat-llm";
import { sse } from "@/lib/llm-stream";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

// No per-IP request cap — a chat is many turns. We only trim context so a long
// conversation stays within the model + duration budget.
export async function POST(req: NextRequest) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return new Response(JSON.stringify({ error: "no_key" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("no messages", { status: 400 });
  }

  const trimmed = (messages as ChatMessage[])
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 8000) }))
    .slice(-24);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        for await (const text of streamChat(trimmed)) {
          controller.enqueue(enc.encode(sse({ type: "token", text })));
        }
        controller.enqueue(enc.encode(sse({ type: "done" })));
      } catch (e) {
        controller.enqueue(
          enc.encode(
            sse({
              type: "error",
              error: e instanceof Error ? e.message : String(e),
            }),
          ),
        );
      } finally {
        controller.close();
      }
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
