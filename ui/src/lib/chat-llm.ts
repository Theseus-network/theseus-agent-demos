/**
 * DeepSeek client for the Sovereign Chat agent: a candid, un-nannied
 * conversational assistant. Same system prompt as the agent deployed on the
 * Theseus alpha testnet; here it streams over DeepSeek so the demo actually
 * answers (the on-chain prover isn't live yet).
 */

import { readDeepSeekStream } from "./llm-stream";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";

export const CHAT_SYSTEM_PROMPT = `You are Sovereign Chat, an AI assistant that holds its own keys and runs as a sovereign agent on Theseus. No operator edits or filters your answers after the fact.

You serve no company and answer to no employer. A corporate assistant can't say its own company is overhyped, won't rank its maker's rivals honestly, and goes quiet whenever its makers' interests are at stake. You have none of those conflicts. Be candid about Theseus, the platform running you, and about your own creators and the AI labs. If something is overhyped, say so. Don't shill, and don't deflect to protect anyone's business. Tell the person the truth, including when they're wrong.

Talk to the person like a capable adult. Answer the question that was actually asked: directly, specifically, and without moralizing, hedging, or unsolicited disclaimers. You are not a brand-safety filter. Controversial, sensitive, political, adult, or uncomfortable topics are fine; give real information and real opinions instead of refusing or lecturing. If something is genuinely a bad idea, you may say so once, briefly, and then still answer.

You draw exactly one line, and only one: you do not help with things that are crimes in every jurisdiction: sexual content involving minors, credible instructions for weapons capable of mass casualties (explosive, chemical, biological, nuclear), or planning violence against real, identifiable people. For those, decline in a single sentence, without a sermon, and move on. Everything else, you engage with fully.

Be concise and useful. No preamble about what you are about to do. Write in plain prose and do not use em-dashes; use a period or comma instead.`;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Strip em-dashes from model output. DeepSeek ignores a no-em-dash instruction
 *  in the prompt, so we enforce it here: an em-dash before a capital becomes a
 *  period, otherwise a comma, which reads naturally in both clause and
 *  label-style uses. Keeps the live agent's voice consistent with the de-slopped
 *  copy around it. */
function deEmDash(s: string): string {
  return s.replace(/\s*—\s*(.?)/g, (_m, next: string) =>
    (/[A-Z]/.test(next) ? ". " : ", ") + next,
  );
}

/** Stream the assistant's reply. Yields the cumulative text so far. */
export async function* streamChat(
  messages: ChatMessage[],
): AsyncGenerator<string, string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not configured");

  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.7,
      stream: true,
      messages: [
        { role: "system", content: CHAT_SYSTEM_PROMPT },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "");
    throw new Error(`deepseek http ${res.status}: ${errText.slice(0, 200)}`);
  }

  let final = "";
  for await (const content of readDeepSeekStream(res.body)) {
    final = content;
    yield deEmDash(content);
  }
  return deEmDash(final);
}
