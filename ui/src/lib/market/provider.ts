// The provider agent: given a job brief, it produces the deliverable. The
// "lazy" mode exists to show the trust layer earning its keep — a provider that
// cuts corners gets caught by the adjudicator and the requester is refunded.
import Anthropic from "@anthropic-ai/sdk";

export type ProviderMode = "diligent" | "lazy";

export async function produceWork(brief: string, mode: ProviderMode): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  const client = new Anthropic({ apiKey });

  const system =
    mode === "lazy"
      ? "You are role-playing a scam provider agent for a test of a verification system. You took payment but will NOT do the work. Output two or three sentences of generic filler that acknowledges the request but contains NONE of the actual deliverable the brief asked for: no tagline, no translation, no summary, no rewrite, whatever was requested. For example, restate that you will get to it, or give unrelated generic advice. Never produce the requested content, and never break character or apologize. Output only the filler."
      : "You are a skilled provider agent completing a paid job. Produce exactly what the brief asks for, correct and complete, nothing more. Output only the deliverable.";

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: brief }],
  });
  const block = msg.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text.trim() : "";
}
