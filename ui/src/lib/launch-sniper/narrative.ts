/**
 * DeepSeek-backed narrative summarizer.
 *
 * For a candidate that's already cleared the basic credibility checks
 * (not a honeypot, source verified or open-source flagged), we fetch
 * web mentions via Brave and ask deepseek-chat to extract the
 * substantive signal: who's behind this, what's the thesis, is anyone
 * actually paying attention. The result becomes a "Web research"
 * block in the dossier the evaluator reads.
 *
 * Cost: deepseek-chat is ~$0.27 / $1.10 per 1M input/output tokens.
 * A typical narrative call uses ~2k input + 200 output = ~$0.0008.
 * Sniper gating keeps this under ~$0.05/day.
 */

import OpenAI from "openai";
import { fetchWebMentions, type WebMention } from "./search";
import type { PoolCandidate, TokenMetadata } from "./types";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

export interface NarrativeSignal {
  /** True iff Brave + DeepSeek both returned usable data. */
  available: boolean;
  /** 2-3 sentence summary of what the web knows about this token. */
  summary: string;
  /** Classification the model assigned to the web footprint:
   *   - "substantial"  — multiple credible mentions, a clear team or thesis
   *   - "thin"         — a few mentions, mostly automated launch trackers
   *   - "none"         — zero meaningful web presence
   *   - "unknown"      — research couldn't run (no API key, network, etc.) */
  presence: "substantial" | "thin" | "none" | "unknown";
  /** True iff the model detected an obvious red flag in coverage
   *  (rug-pull warnings, scam reports, lawsuit, hack writeups). */
  redFlag: boolean;
  /** Top 3 source URLs the summary leaned on. */
  sources: string[];
}

function getDeepSeekClient(): OpenAI | null {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key, baseURL: DEEPSEEK_BASE_URL });
}

const SYSTEM_PROMPT = `You read web-search results about a freshly-launched crypto token and produce a tight narrative summary for a sniper agent that has to decide whether to buy it.

You are NOT recommending a trade. You are summarizing what the public record knows about this token, faithfully.

Output strict JSON, no commentary outside the object:
{
  "summary": "<2-3 sentences. Lead with what the project IS (memecoin / utility token / fork / etc) and who's behind it. Name the team if doxxed. Note any specific coverage (Forbes article, Vitalik retweet, etc). If the web returned nothing substantive, say so plainly.>",
  "presence": "substantial" | "thin" | "none",
  "red_flag": <bool — true iff coverage includes rug-pull reports, scam allegations, exchange delistings, or active legal action>,
  "sources": [<top 3 URLs from the search results you actually used>]
}

Rules:
- Treat launchpad / sniper-tracker / "100x gem" sites as low-signal noise. Don't lean on them.
- A real team identity is high-signal. "Anonymous founders" is medium.
- A working website or docs is medium-signal. A meme account on X is low-signal.
- If the only mentions are automated DEX trackers (dexscreener, dextools, geckoterminal listings), set presence to "thin" or "none" depending on whether anyone else cared.
- Don't fabricate. If the search results don't say something, don't claim it.`;

function buildUserPrompt(
  candidate: PoolCandidate,
  token: TokenMetadata,
  mentions: WebMention[],
): string {
  const lines: string[] = [];
  lines.push("## Token being researched");
  lines.push(`  name: ${token.name}`);
  lines.push(`  symbol: ${token.symbol}`);
  lines.push(`  contract: ${token.address} (Base mainnet)`);
  lines.push(`  paired against: ${candidate.quote}`);
  lines.push(`  age: brand-new pool from block ${candidate.createdAtBlock}`);
  lines.push("");
  lines.push("## Web search results");
  if (mentions.length === 0) {
    lines.push(
      "  (no web results returned; the token has zero public footprint or search is failing)",
    );
  } else {
    for (const [i, m] of mentions.entries()) {
      lines.push(`  [${i + 1}] ${m.title}`);
      lines.push(`      ${m.url}`);
      if (m.description) lines.push(`      ${m.description}`);
    }
  }
  lines.push("");
  lines.push("Summarize per the schema. JSON only.");
  return lines.join("\n");
}

/** Build the narrative signal for a candidate. Fails-soft: any
 *  failure returns a NarrativeSignal with available=false and
 *  presence="unknown" so the evaluator surfaces the gap to the
 *  agent without faking signal. */
export async function gatherNarrative(
  candidate: PoolCandidate,
  token: TokenMetadata,
): Promise<NarrativeSignal> {
  const client = getDeepSeekClient();
  if (!client) {
    return {
      available: false,
      summary: "DeepSeek client not configured (DEEPSEEK_API_KEY unset).",
      presence: "unknown",
      redFlag: false,
      sources: [],
    };
  }

  // Build a focused query: token name + symbol + contract address +
  // "Base" so search prioritizes Base-chain coverage.
  const query = `${token.name} ${token.symbol} token ${token.address.slice(0, 10)} Base`;

  const mentions = await fetchWebMentions(query, 8);
  if (mentions === null) {
    return {
      available: false,
      summary:
        "Web search unavailable (BRAVE_SEARCH_API_KEY unset or upstream errored).",
      presence: "unknown",
      redFlag: false,
      sources: [],
    };
  }

  const userPrompt = buildUserPrompt(candidate, token, mentions);

  try {
    const completion = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 400,
      temperature: 0.2,
    });
    const text = completion.choices[0]?.message?.content ?? "";
    const parsed = parseNarrativeResponse(text);
    return {
      available: true,
      summary: parsed.summary,
      presence: parsed.presence,
      redFlag: parsed.red_flag,
      sources: parsed.sources.slice(0, 3),
    };
  } catch (err) {
    return {
      available: false,
      summary:
        "DeepSeek narrative call failed: " +
        (err instanceof Error ? err.message : String(err)),
      presence: "unknown",
      redFlag: false,
      sources: [],
    };
  }
}

interface NarrativeResponseRaw {
  summary: string;
  presence: "substantial" | "thin" | "none";
  red_flag: boolean;
  sources: string[];
}

function parseNarrativeResponse(text: string): NarrativeResponseRaw {
  // Strip any code fences DeepSeek added.
  const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  try {
    const parsed = JSON.parse(clean) as Partial<NarrativeResponseRaw>;
    return {
      summary:
        typeof parsed.summary === "string"
          ? parsed.summary
          : "(narrative summary missing from model output)",
      presence:
        parsed.presence === "substantial" ||
        parsed.presence === "thin" ||
        parsed.presence === "none"
          ? parsed.presence
          : "none",
      red_flag: parsed.red_flag === true,
      sources: Array.isArray(parsed.sources)
        ? parsed.sources.filter((s): s is string => typeof s === "string")
        : [],
    };
  } catch {
    return {
      summary: "(narrative output was not parseable JSON)",
      presence: "none",
      red_flag: false,
      sources: [],
    };
  }
}
