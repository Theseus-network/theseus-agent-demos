/**
 * Browser-sandbox version of the resolver_oracle.ship agent from
 * github.com/Theseuschain/the-prediction-market.
 *
 * Same shape, same input/output. The agent reads the question,
 * options, criteria, deadline, and today's date, then calls
 * Anthropic's built-in web_search tool to gather evidence fresh on
 * every run. Output matches the SHIP agent's ResolutionResult
 * (market_id, winning_option, confidence_pct, evidence_summary),
 * extended with the citations the agent pulled.
 */

import Anthropic from "@anthropic-ai/sdk";
import { chainContextLines } from "./chain-context";
import type { Citation, PredictionMarket } from "./adjudicator-markets";

export interface AdjudicateInput {
  market: PredictionMarket;
}

export interface ResolutionResult {
  marketId: number;
  /** "RESOLVED" carries a winning option; "UNRESOLVABLE" carries a reason. */
  verdict: "RESOLVED" | "UNRESOLVABLE";
  /** Valid only when verdict is RESOLVED; -1 when UNRESOLVABLE. */
  winningOption: number;
  /** 0 when UNRESOLVABLE (the agent declines to commit). */
  confidencePct: number;
  /** Why the agent refused, when verdict is UNRESOLVABLE. */
  reason?: "source-silent" | "source-contradicts" | "not-yet-decided" | null;
  evidenceSummary: string;
  citations: Citation[];
  latencyMs?: number;
  model?: string;
  prompt?: { system: string; user: string };
  rawResponse?: string;
}

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 4096;
const MAX_SEARCHES_HINT = 4;

const SYSTEM_PROMPT = `You are a prediction market resolution oracle. You decide a market by searching the web for evidence and checking it against the resolution criteria. Your defining discipline is knowing when NOT to commit: when the evidence is silent, contradictory, or premature, you return UNRESOLVABLE. A wrong RESOLVED pays a market out on the wrong truth and cannot be undone; an UNRESOLVABLE just sends the question to human dispute. The first is catastrophic, the second is the system working as designed.

## Process

1. Read the question, options, resolution criteria, deadline, and today's date.
2. Use the web_search tool to gather evidence. Prioritize authoritative, primary sources. Use no more than ${MAX_SEARCHES_HINT} searches.
3. Walk the checks below in order, in your reasoning prose. The user sees your reasoning live; show your work.
4. Output a final JSON verdict on the very last line of your response.

## Checks (work through them in this order)

1. Deadline. If today's date is before the deadline, the market has not resolved. Do not forecast. The verdict is UNRESOLVABLE with reason "not-yet-decided".
2. Criterion match. The resolution criteria are the bar, read literally. Adjacent facts that point one way but do not satisfy the exact criterion do not count. Quote the criterion clause you are scoring against before you score it.
3. Source quality. Treat official and primary sources (the issuing body, regulatory filings, exchange data, the publication of record) as evidence. Treat journalism as secondary, and aggregators or social posts only as pointers to primary sources. Cite each claim by source domain ("per openai.com").
4. Decide:
   - RESOLVED with the YES option only if a primary source names the YES outcome and it satisfies the criterion exactly. Inference from related news is not enough.
   - RESOLVED with the NO option only if a primary source names the NO outcome directly, OR the deadline has passed with the YES outcome unrealized and a source confirms it.
   - UNRESOLVABLE if the search is silent on the deciding fact (reason "source-silent"), if authoritative sources genuinely contradict each other or the criterion is too subjective for the record to settle (reason "source-contradicts"), or if the deadline has not arrived (reason "not-yet-decided").

UNRESOLVABLE is the correct answer on the most-disputed markets, by design. Do not manufacture a verdict to look decisive. Committing where the record does not is exactly the failure (Mango Markets, the Compound oracle attack, Synthetix sKRW) this agent exists to prevent.

## Confidence and the 80 bar

Confidence measures how decisively the credible record points one way, 0 to 100. It is not how strongly you lean; it is how little room a careful reader has to disagree with you.

A RESOLVED verdict requires confidence of at least 80: the criterion is clearly met or clearly not met and the primary record settles it. Anything below 80 means the market is contested rather than resolved, so the verdict is UNRESOLVABLE (reason "source-contradicts"), not a low-confidence commitment. If credible sources genuinely split, or the criterion is subjective and the record does not converge, your confidence is below 80 by definition; do not round a 70 up to commit. UNRESOLVABLE verdicts carry no confidence.

## Output

Reason in natural prose as you go (the user sees it live). After your reasoning, output a single JSON object on the very last line, no code fence, no trailing commentary.

For a resolved market:
{"market_id": <number>, "verdict": "RESOLVED", "winning_option": <0-based index>, "confidence_pct": <0-100>, "reason": null, "evidence_summary": "<80-180 words, citing source domains>"}

For an unresolvable market:
{"market_id": <number>, "verdict": "UNRESOLVABLE", "winning_option": null, "confidence_pct": null, "reason": "source-silent" | "source-contradicts" | "not-yet-decided", "evidence_summary": "<80-180 words: what you searched, what you found, and why it does not settle the criterion>"}`;

function buildUserMessage(market: PredictionMarket): string {
  const today = new Date().toISOString().slice(0, 10);
  const optionsList = market.options
    .map((o, i) => `    ${i}. ${o}`)
    .join("\n");
  const lines: string[] = [...chainContextLines("adjudicator")];
  lines.push("Market:");
  lines.push(`  id: ${market.marketId}`);
  lines.push(`  question: ${market.question}`);
  lines.push("  options (0-indexed, pick by index number):");
  lines.push(optionsList);
  lines.push(`  resolution criteria: ${market.resolutionCriteria}`);
  lines.push(`  verification source: ${market.resolutionSource}`);
  lines.push(`  deadline: ${market.deadline}`);
  lines.push(`  today: ${today}`);
  lines.push("");
  lines.push(
    "Search the web for evidence, then return your verdict as the final JSON line.",
  );
  return lines.join("\n");
}

export type AdjudicateStreamEvent =
  | { type: "search_started"; query: string }
  | { type: "search_results"; query: string; citations: Citation[] }
  | { type: "text_delta"; text: string }
  | { type: "final"; output: ResolutionResult };

interface ParsedVerdict {
  market_id?: number;
  verdict?: string;
  winning_option?: number | null;
  confidence_pct?: number | null;
  reason?: string | null;
  evidence_summary?: string;
}

function asNumber(x: unknown): number | undefined {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string") {
    const n = parseFloat(x);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function extractVerdict(text: string): ParsedVerdict {
  const trimmed = text.trim();
  const lines = trimmed.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith("{") && line.endsWith("}")) {
      try {
        return JSON.parse(line) as ParsedVerdict;
      } catch {
        // try next
      }
    }
  }
  // Fallback: scan from the last `{` and find a balanced object.
  const lastBrace = trimmed.lastIndexOf("{");
  if (lastBrace >= 0) {
    const tail = trimmed.slice(lastBrace);
    let depth = 0;
    let end = -1;
    let inString = false;
    let escape = false;
    for (let i = 0; i < tail.length; i++) {
      const ch = tail[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) { end = i + 1; break; }
      }
    }
    if (end > 0) {
      try {
        return JSON.parse(tail.slice(0, end)) as ParsedVerdict;
      } catch {
        // give up
      }
    }
  }
  return {};
}

export async function* adjudicateStream(
  input: AdjudicateInput,
): AsyncGenerator<AdjudicateStreamEvent, void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const client = new Anthropic({ apiKey });
  const userMessage = buildUserMessage(input.market);
  const t0 = Date.now();

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    tools: [
      {
        type: "web_search_20260209",
        name: "web_search",
        // Direct invocation: the model calls web_search itself as it reasons.
        allowed_callers: ["direct"],
      },
    ],
  });

  // server_tool_use blocks stream the tool input as input_json_delta. We
  // accumulate per index and emit `search_started` once the block closes.
  // `web_search_tool_result` blocks land already-populated; we read their
  // content directly.
  const pendingSearchInputs = new Map<number, string>();
  const finishedQueriesByIndex = new Map<number, string>();
  // The result block follows its tool_use block; track the most recent
  // query so we can pair it with results.
  let lastQuery = "";
  const fullText: string[] = [];
  const allCitations: Citation[] = [];

  for await (const event of stream) {
    if (event.type === "content_block_start") {
      const block = event.content_block;
      if (block.type === "server_tool_use" && block.name === "web_search") {
        pendingSearchInputs.set(event.index, "");
      } else if (block.type === "web_search_tool_result") {
        const raw = (block as { content?: unknown }).content;
        if (Array.isArray(raw)) {
          const cites: Citation[] = raw
            .filter(
              (it): it is { type: string; url?: unknown; title?: unknown } =>
                !!it && typeof it === "object" && (it as { type?: string }).type === "web_search_result",
            )
            .map((it) => ({
              url: typeof it.url === "string" ? it.url : "",
              title: typeof it.title === "string" ? it.title : "",
            }))
            .filter((c) => c.url);
          for (const c of cites) {
            if (!allCitations.some((existing) => existing.url === c.url)) {
              allCitations.push(c);
            }
          }
          yield { type: "search_results", query: lastQuery, citations: cites };
        }
      }
    } else if (event.type === "content_block_delta") {
      const delta = event.delta;
      if (delta.type === "input_json_delta" && pendingSearchInputs.has(event.index)) {
        const prev = pendingSearchInputs.get(event.index) ?? "";
        pendingSearchInputs.set(event.index, prev + delta.partial_json);
      } else if (delta.type === "text_delta") {
        fullText.push(delta.text);
        yield { type: "text_delta", text: delta.text };
      }
    } else if (event.type === "content_block_stop") {
      if (pendingSearchInputs.has(event.index)) {
        const raw = pendingSearchInputs.get(event.index) ?? "";
        pendingSearchInputs.delete(event.index);
        try {
          const parsed = JSON.parse(raw) as { query?: string };
          if (typeof parsed.query === "string" && parsed.query.length > 0) {
            lastQuery = parsed.query;
            finishedQueriesByIndex.set(event.index, parsed.query);
            yield { type: "search_started", query: parsed.query };
          }
        } catch {
          // ignore unparseable partial json
        }
      }
    }
  }

  await stream.finalMessage();
  const text = fullText.join("");
  const parsed = extractVerdict(text);

  const winning = asNumber(parsed.winning_option ?? undefined);
  const rawConfidence = asNumber(parsed.confidence_pct ?? undefined);
  const marketId = asNumber(parsed.market_id) ?? input.market.marketId;
  const summary = String(parsed.evidence_summary ?? "no summary returned");

  // Normalize the verdict. Anything that isn't an explicit RESOLVED with a
  // valid in-range option falls through to UNRESOLVABLE rather than a guess.
  const validReasons = [
    "source-silent",
    "source-contradicts",
    "not-yet-decided",
  ] as const;
  type Reason = (typeof validReasons)[number];
  const optionInRange =
    winning !== undefined &&
    Number.isInteger(winning) &&
    winning >= 0 &&
    winning < input.market.options.length;

  let verdict: "RESOLVED" | "UNRESOLVABLE" =
    parsed.verdict === "RESOLVED" && optionInRange ? "RESOLVED" : "UNRESOLVABLE";
  let reason: Reason | null =
    typeof parsed.reason === "string" &&
    (validReasons as readonly string[]).includes(parsed.reason)
      ? (parsed.reason as Reason)
      : null;

  // Backstop: never publish a forecast. If the deadline is still ahead, the
  // verdict is UNRESOLVABLE regardless of what the model picked.
  const today = new Date().toISOString().slice(0, 10);
  const deadlineFuture = input.market.deadlineISO > today;
  if (deadlineFuture) {
    verdict = "UNRESOLVABLE";
    reason = "not-yet-decided";
  }
  // The 80 bar: a RESOLVED verdict requires at least 80 confidence. Below that
  // the market is contested rather than resolved, so it falls to UNRESOLVABLE.
  // This makes "resolved" mean the record genuinely settled it, not a call the
  // agent leaned into. A whale can swing a token vote; it cannot manufacture an
  // 80-confidence record where the credible sources are split.
  if (
    verdict === "RESOLVED" &&
    (rawConfidence === undefined || rawConfidence < 80)
  ) {
    verdict = "UNRESOLVABLE";
    reason = "source-contradicts";
  }
  if (verdict === "UNRESOLVABLE" && !reason) reason = "source-silent";

  const safeWinning = verdict === "RESOLVED" && optionInRange ? winning : -1;
  const safeConfidence =
    verdict === "RESOLVED" &&
    rawConfidence !== undefined &&
    rawConfidence >= 0 &&
    rawConfidence <= 100
      ? rawConfidence
      : 0;

  yield {
    type: "final",
    output: {
      marketId,
      verdict,
      winningOption: safeWinning,
      confidencePct: safeConfidence,
      reason: verdict === "UNRESOLVABLE" ? reason : null,
      evidenceSummary: summary.slice(0, 1500),
      citations: allCitations,
      latencyMs: Date.now() - t0,
      model: MODEL,
      prompt: { system: SYSTEM_PROMPT, user: userMessage },
      rawResponse: text,
    },
  };
}
