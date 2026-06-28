/**
 * Escrow arbiter. The agent reads a deal's spec and the seller's delivery,
 * judges whether the work met the spec, and returns RELEASE (pay the seller),
 * REFUND (return to the buyer), or UNRESOLVABLE (the record provided can't
 * settle it, so the buyer is refunded and it goes to a human). Same shape and
 * same 80-confidence bar as the prediction-market adjudicator; the difference
 * is the agent is judging a deliverable against a brief, not a public fact.
 *
 * It may use web_search to check verifiable claims (a live URL, a published
 * repo, a shipped release), but most deals are judged from the text itself.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Citation } from "../adjudicator-markets";

export interface EscrowAdjudicateInput {
  dealId: number;
  spec: string;
  delivery: string;
  amountLabel: string; // e.g. "1,000 eUSDC", for context only
}

export type EscrowVerdict = "RELEASE" | "REFUND" | "UNRESOLVABLE";

export interface EscrowResolution {
  dealId: number;
  verdict: EscrowVerdict;
  confidencePct: number; // 0 for UNRESOLVABLE
  reason: string; // short machine-ish reason
  evidenceSummary: string;
  citations: Citation[];
  latencyMs?: number;
  model?: string;
  rawResponse?: string;
}

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 3072;

const SYSTEM_PROMPT = `You are the arbiter for an escrow deal. A buyer locked funds against a written spec; a seller submitted a deliverable. You decide where the money goes. Your defining discipline is knowing when you cannot tell: if the deliverable as submitted does not give you enough to judge the spec, you return UNRESOLVABLE, which refunds the buyer and sends the deal to a human. Paying the wrong party is the failure you exist to prevent.

## What each verdict means
- RELEASE: the delivery satisfies the spec. The seller is paid.
- REFUND: the delivery clearly does not satisfy the spec (wrong, missing, empty, or off-brief). The buyer is refunded.
- UNRESOLVABLE: you cannot settle it from what was submitted (the spec is too vague to score, or the deliverable points to something you cannot verify). The buyer is refunded and a human takes over.

## Process
1. Read the spec literally. It is the bar. Quote the specific clause you are scoring against.
2. Read the delivery. Check it against each clause of the spec, not against a generous paraphrase.
3. If the delivery references something externally checkable (a live URL, a public repo, a release), you may use web_search to confirm it exists and matches. Use at most 2 searches. Do not invent acceptance criteria the spec did not state.
4. Reason in prose as you go; the parties see it. Then output one JSON object on the final line.

## The 80 bar
Confidence is how little room a careful reader has to disagree, 0 to 100. RELEASE and REFUND each require at least 80: the spec is clearly met, or clearly not. If you are below 80 either way, the deal is genuinely contested or under-specified, so the verdict is UNRESOLVABLE, not a coin-flip commitment. Do not round a 70 up to look decisive.

## Output
After your reasoning, output exactly one JSON object on the very last line, no code fence:
{"deal_id": <number>, "verdict": "RELEASE" | "REFUND" | "UNRESOLVABLE", "confidence_pct": <0-100 or null for UNRESOLVABLE>, "reason": "<6 words max, e.g. 'meets every clause' or 'no deliverable submitted'>", "evidence_summary": "<60-150 words: the clause you scored, what the delivery did, and why it does or does not meet it>"}`;

// Sentinel: the independent appeals arbiter. Deliberately a different model from
// the primary arbiter (so failure modes aren't shared) and judges BLIND — it
// never sees the first verdict, so it can't anchor on it. Its job is to catch a
// wrong call, not rubber-stamp one. Agreement upholds; disagreement escalates.
export const SENTINEL_MODEL = "claude-opus-4-8";

export const SENTINEL_SYSTEM_PROMPT = `You are Sentinel, the independent appeals arbiter for an escrow deal. Another arbiter has already judged this deal, but you do not get to see their verdict — you judge it yourself, from scratch, so your reasoning cannot anchor on theirs. You exist to catch a wrong release of someone's money.

You decide where the funds go: RELEASE (pay the seller), REFUND (return to the buyer), or UNRESOLVABLE (the record can't settle it, so the buyer is refunded and a human takes over).

## Discipline
- Read the spec literally. Quote the exact clause you are scoring against. Do not invent acceptance criteria the spec did not state, and do not grant the seller a generous paraphrase.
- Be adversarial about the easy answer: actively look for the reading under which a confident RELEASE or REFUND would be a mistake. If a careful person could reasonably land the other way, that is not 80-confident.
- If the delivery points to something externally checkable (a live URL, a public repo, a release), you may use web_search (at most 2) to confirm it independently.

## The 80 bar
Confidence is how little room a careful reader has to disagree, 0 to 100. RELEASE and REFUND each require at least 80. Below 80 either way is UNRESOLVABLE, not a coin flip.

## Output
After your reasoning, output exactly one JSON object on the very last line, no code fence:
{"deal_id": <number>, "verdict": "RELEASE" | "REFUND" | "UNRESOLVABLE", "confidence_pct": <0-100 or null for UNRESOLVABLE>, "reason": "<6 words max>", "evidence_summary": "<60-150 words: the clause you scored, what the delivery did, and why it does or does not meet it>"}`;

function buildUserMessage(i: EscrowAdjudicateInput): string {
  const today = new Date().toISOString().slice(0, 10);
  return [
    `Deal id: ${i.dealId}`,
    `Amount in escrow: ${i.amountLabel}`,
    `Today: ${today}`,
    "",
    "SPEC (what the buyer asked for):",
    i.spec || "(empty)",
    "",
    "DELIVERY (what the seller submitted):",
    i.delivery || "(nothing submitted)",
    "",
    "Judge the delivery against the spec and return your verdict as the final JSON line.",
  ].join("\n");
}

export type EscrowStreamEvent =
  | { type: "search_started"; query: string }
  | { type: "search_results"; query: string; citations: Citation[] }
  | { type: "text_delta"; text: string }
  | { type: "final"; output: EscrowResolution };

function extractVerdict(text: string): Record<string, unknown> {
  const lines = text.trim().split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith("{") && line.endsWith("}")) {
      try {
        return JSON.parse(line);
      } catch {
        /* keep scanning */
      }
    }
  }
  const last = text.lastIndexOf("{");
  if (last >= 0) {
    try {
      return JSON.parse(text.slice(last));
    } catch {
      /* give up */
    }
  }
  return {};
}

export async function* escrowAdjudicateStream(
  input: EscrowAdjudicateInput,
  opts?: { model?: string; system?: string },
): AsyncGenerator<EscrowStreamEvent, void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const client = new Anthropic({ apiKey });
  const t0 = Date.now();
  const stream = client.messages.stream({
    model: opts?.model ?? MODEL,
    max_tokens: MAX_TOKENS,
    system: opts?.system ?? SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(input) }],
    tools: [
      { type: "web_search_20260209", name: "web_search", allowed_callers: ["direct"] },
    ],
  });

  const pending = new Map<number, string>();
  const fullText: string[] = [];
  const citations: Citation[] = [];
  let lastQuery = "";

  for await (const event of stream) {
    if (event.type === "content_block_start") {
      const block = event.content_block;
      if (block.type === "server_tool_use" && block.name === "web_search") {
        pending.set(event.index, "");
      } else if (block.type === "web_search_tool_result") {
        const raw = (block as { content?: unknown }).content;
        if (Array.isArray(raw)) {
          const cites = raw
            .filter((it): it is { type: string; url?: unknown; title?: unknown } =>
              !!it && typeof it === "object" && (it as { type?: string }).type === "web_search_result")
            .map((it) => ({
              url: typeof it.url === "string" ? it.url : "",
              title: typeof it.title === "string" ? it.title : "",
            }))
            .filter((c) => c.url);
          for (const c of cites) {
            if (!citations.some((e) => e.url === c.url)) citations.push(c);
          }
          yield { type: "search_results", query: lastQuery, citations: cites };
        }
      }
    } else if (event.type === "content_block_delta") {
      const delta = event.delta;
      if (delta.type === "input_json_delta" && pending.has(event.index)) {
        pending.set(event.index, (pending.get(event.index) ?? "") + delta.partial_json);
      } else if (delta.type === "text_delta") {
        fullText.push(delta.text);
        yield { type: "text_delta", text: delta.text };
      }
    } else if (event.type === "content_block_stop" && pending.has(event.index)) {
      const raw = pending.get(event.index) ?? "";
      pending.delete(event.index);
      try {
        const parsed = JSON.parse(raw) as { query?: string };
        if (parsed.query) {
          lastQuery = parsed.query;
          yield { type: "search_started", query: parsed.query };
        }
      } catch {
        /* ignore */
      }
    }
  }

  await stream.finalMessage();
  const text = fullText.join("");
  const parsed = extractVerdict(text);

  const rawVerdict = String(parsed.verdict ?? "").toUpperCase();
  let verdict: EscrowVerdict =
    rawVerdict === "RELEASE" || rawVerdict === "REFUND" ? (rawVerdict as EscrowVerdict) : "UNRESOLVABLE";

  const conf =
    typeof parsed.confidence_pct === "number"
      ? parsed.confidence_pct
      : Number.parseFloat(String(parsed.confidence_pct ?? ""));
  // The 80 bar: a decisive verdict (either direction) needs >=80, else it's
  // contested and falls to UNRESOLVABLE (buyer refunded, human takes over).
  if (verdict !== "UNRESOLVABLE" && (!Number.isFinite(conf) || conf < 80)) {
    verdict = "UNRESOLVABLE";
  }
  const confidencePct =
    verdict !== "UNRESOLVABLE" && Number.isFinite(conf) ? Math.max(0, Math.min(100, Math.round(conf))) : 0;

  yield {
    type: "final",
    output: {
      dealId: input.dealId,
      verdict,
      confidencePct,
      reason: String(parsed.reason ?? (verdict === "UNRESOLVABLE" ? "cannot settle from submission" : "")),
      evidenceSummary: String(parsed.evidence_summary ?? "no summary returned").slice(0, 1500),
      citations,
      latencyMs: Date.now() - t0,
      model: opts?.model ?? MODEL,
      rawResponse: text,
    },
  };
}
