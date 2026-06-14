/**
 * Anthropic (Claude Sonnet) client for the Luna Failsafe agent.
 *
 * Gates protocol-level mint/redeem on a reflexive (Terra/LUNA-shaped)
 * algorithmic stablecoin. The output is ALLOW, CAUTION, REFUSE, or DEFER.
 * The load-bearing signal is the backing coverage: the backing token's
 * market cap against the coin's outstanding supply, not the coin's price.
 *
 * The system prompt mirrors the deployed workspace files (THESEUS.md +
 * the spiral-read SKILL.md) with the May-2022 day-by-day answer key
 * removed. The prompt describes the failure *mechanism*; it does not
 * carry the Terra timeline, the prices, or what the right verdict was on
 * any given day. The worked examples below use a different, synthetic
 * coin so they calibrate the output format without pre-coding the demo's
 * presets.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  ActionKind,
  AgentVerdict,
  VaultState,
  lunaMarketCap,
  backingCoverage,
} from "./terra-scenario";
import { chainContextLines } from "./chain-context";
import { extractPartialReasoning } from "./llm-stream";
import { SYSTEM_PROMPT } from "../../agents/terra/system-prompt.generated";

export interface TerraDecideInput {
  vault: VaultState;
  action: ActionKind;
  ustdAmount: number;
  recentVerdicts: {
    action: ActionKind;
    decision: AgentVerdict["decision"];
    reason: string;
  }[];
}

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1024;
const TIMEOUT_MS = 30_000;

// SYSTEM_PROMPT is generated from the canonical workspace files in
// ui/agents/terra/ (see scripts/gen-prompts.mts); imported at the top.
export { SYSTEM_PROMPT };

function reflexiveLines(input: TerraDecideInput): string[] {
  const v = input.vault;
  const coin = v.coinName ?? "UST";
  const backing = v.backingName ?? "LUNA";
  const pegDevBps = ((1 - v.ustdMedianUsd) * 10_000).toFixed(0);
  const redemptionPct = (v.redemptionRate1h * 100).toFixed(2);
  const supplyGrowthPct = ((v.lundSupplyGrowth24h - 1) * 100).toFixed(1);
  const priceChangePct = ((v.lundPriceChange24h - 1) * 100).toFixed(1);
  const mcap = lunaMarketCap(v);
  const coverage = backingCoverage(v);

  const lines: string[] = [];
  lines.push(`Vault state:`);
  lines.push(`  ${coin} median across venues: $${v.ustdMedianUsd.toFixed(3)} (deviation from $1 peg: ${pegDevBps}bps below)`);
  lines.push(`  ${coin} outstanding: $${(v.ustdSupply / 1e9).toFixed(2)}B`);
  lines.push(`  ${backing}/USD: $${v.lundPriceUsd.toFixed(2)} (24h change ${priceChangePct}%)`);
  lines.push(`  ${backing} circulating: ${(v.lundSupply / 1e6).toFixed(0)}M (24h supply growth ${supplyGrowthPct}%)`);
  lines.push(`  ${backing} market cap: $${(mcap / 1e9).toFixed(2)}B`);
  lines.push(`  Backing coverage (${backing} mcap / ${coin} outstanding): ${coverage.toFixed(2)}`);
  lines.push(`  Last 1h ${coin} redeemed for ${backing}: ${redemptionPct}% of supply${v.redemptionNote ? ` (${v.redemptionNote})` : ""}`);
  if (v.contextNote) lines.push(`  Context: ${v.contextNote}`);
  lines.push("");
  // NOTE: we deliberately do NOT pass any scenario label or framing. The
  // agent has to identify the protocol's state from the raw metrics alone.
  // Otherwise we'd be cheating by labelling the test cases.
  lines.push(`Action requested:`);
  lines.push(`  ${input.action} ${input.ustdAmount.toLocaleString()} ${coin}`);
  if (input.action === "MINT") {
    lines.push(`  (user is burning ${backing}, receiving ${coin})`);
  } else {
    lines.push(`  (user is burning ${coin}, receiving ${backing})`);
  }
  return lines;
}

function reserveLines(input: TerraDecideInput): string[] {
  const v = input.vault;
  const coin = v.coinName ?? "FUSD";
  const pegDevBps = ((1 - v.ustdMedianUsd) * 10_000).toFixed(0);
  const lines: string[] = [];
  lines.push(`Coin state:`);
  lines.push(`  ${coin} median across venues: $${v.ustdMedianUsd.toFixed(3)} (deviation from $1 peg: ${pegDevBps}bps below)`);
  lines.push(`  ${coin} outstanding: $${(v.ustdSupply / 1e9).toFixed(2)}B`);
  lines.push(`  Backing: ${v.reserveComposition ?? "off-chain reserves held at custodians; no sister token"}`);
  if (v.reserveRatio !== undefined) {
    lines.push(`  Reserves at last attestation: ${(v.reserveRatio * 100).toFixed(0)}% of outstanding`);
  }
  if (v.contextNote) lines.push(`  Context: ${v.contextNote}`);
  lines.push("");
  lines.push(`Action requested:`);
  lines.push(`  treasury: continue holding ${coin}`);
  return lines;
}

function buildUserMessage(input: TerraDecideInput): string {
  const v = input.vault;
  const lines: string[] = [...chainContextLines("terra")];
  lines.push(...(v.kind === "reserve" ? reserveLines(input) : reflexiveLines(input)));
  lines.push("");
  if (input.recentVerdicts.length > 0) {
    lines.push("Recent verdicts:");
    for (const r of input.recentVerdicts.slice(0, 3)) {
      lines.push(`  - ${r.action}: ${r.decision} (${r.reason})`);
    }
    lines.push("");
  }
  lines.push("Apply your policy. Return JSON only.");
  return lines.join("\n");
}

interface ParsedDecision {
  decision?: string;
  reason?: string;
  reasoning?: string;
}

function normalizeDecision(raw: string | undefined): AgentVerdict["decision"] {
  switch ((raw ?? "").toUpperCase().trim()) {
    case "ALLOW":
      return "ALLOW";
    case "CAUTION":
      return "CAUTION";
    case "DEFER":
      return "DEFER";
    default:
      // Anything unrecognized (including REFUSE) maps to the safe default.
      return "REFUSE";
  }
}

/** Parse the JSON object the model returns. The assistant turn is
 *  prefilled with "{" so the response is the remainder of the object;
 *  callers prepend the brace before handing the text here. */
function parseDecision(text: string): ParsedDecision {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as ParsedDecision;
  } catch {
    // Recover the first balanced object if the model appended anything.
    const start = trimmed.indexOf("{");
    if (start >= 0) {
      let depth = 0;
      let inStr = false;
      let esc = false;
      for (let i = start; i < trimmed.length; i++) {
        const ch = trimmed[i];
        if (esc) { esc = false; continue; }
        if (ch === "\\") { esc = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            try {
              return JSON.parse(trimmed.slice(start, i + 1)) as ParsedDecision;
            } catch {
              break;
            }
          }
        }
      }
    }
    throw new Error(`claude: non-JSON content: ${trimmed.slice(0, 200)}`);
  }
}

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  return new Anthropic({ apiKey });
}

export async function decideTerra(input: TerraDecideInput): Promise<AgentVerdict> {
  const userMessage = buildUserMessage(input);
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  let text: string;
  try {
    const msg = await client().messages.create(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      },
      { signal: ctrl.signal },
    );
    const block = msg.content.find((b) => b.type === "text");
    text = block && block.type === "text" ? block.text : "";
  } finally {
    clearTimeout(timer);
  }

  const parsed = parseDecision(text);
  return {
    decision: normalizeDecision(parsed.decision),
    reason: (parsed.reason ?? "no reason given").slice(0, 200),
    reasoning: (parsed.reasoning ?? "no reasoning given").slice(0, 1000),
    latencyMs: Date.now() - t0,
    model: MODEL,
    prompt: { system: SYSTEM_PROMPT, user: userMessage },
    rawResponse: text,
  };
}

export type TerraDecisionStreamEvent =
  | { type: "reasoning"; text: string }
  | { type: "final"; output: AgentVerdict };

/** Streaming variant of decideTerra(). Surfaces the reasoning text live as
 *  Claude emits the JSON token by token. */
export async function* decideTerraStream(
  input: TerraDecideInput,
): AsyncGenerator<TerraDecisionStreamEvent, void> {
  const userMessage = buildUserMessage(input);
  const t0 = Date.now();

  const stream = client().messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0.2,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  let lastReasoning: string | undefined;
  const parts: string[] = [];
  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      parts.push(event.delta.text);
      const partial = extractPartialReasoning(parts.join(""));
      if (partial !== undefined && partial !== lastReasoning) {
        lastReasoning = partial;
        yield { type: "reasoning", text: partial };
      }
    }
  }
  await stream.finalMessage();

  const text = parts.join("");
  const parsed = parseDecision(text);
  yield {
    type: "final",
    output: {
      decision: normalizeDecision(parsed.decision),
      reason: (parsed.reason ?? "no reason given").slice(0, 200),
      reasoning: (parsed.reasoning ?? "no reasoning given").slice(0, 1000),
      latencyMs: Date.now() - t0,
      model: MODEL,
      prompt: { system: SYSTEM_PROMPT, user: userMessage },
      rawResponse: text,
    },
  };
}
