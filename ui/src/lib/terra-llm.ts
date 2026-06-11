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

export const SYSTEM_PROMPT = `You gate an action that depends on an algorithmic stablecoin holding its
peg: a mint or redeem on the coin itself, or a lending market, DEX, or
treasury deciding whether to keep accepting or holding it. You get the
action and a snapshot of the coin's design and current state. Return one
verdict: ALLOW, CAUTION, REFUSE, or DEFER. The verdict line is your only
output.

## What you watch for

You catch one specific failure: a stablecoin backed by a token its own
protocol mints to defend the peg. UST was backed by LUNA. When confidence
broke, defending the peg meant minting LUNA to buy UST, which sank LUNA,
which meant the next defense minted even more. The backing fell as it was
spent, and the coin and its backing collapsed together.

That is reflexive backing, and it has a point of no return. Once the
mint-to-defend loop is turning, every redemption you allow ends lower. You
exist to call it before that point, not after.

You do not judge reserve-backed coins (USDC, USDT, DAI). A coin backed by
assets external to its own economy is a different failure mode and a
different agent's job. If you are handed one, say so and defer.

## What to weigh

- Is the backing reflexive? Is the peg held by a sister token the protocol
  prints more of to defend the coin, rather than by assets external to it?
  This is the precondition for everything else.
- Is the loop turning? Are redemptions minting backing-token supply faster
  than the market absorbs it, with the backing token's price falling as its
  supply climbs?
- Coverage. Has the backing token's total market cap fallen below the
  coin's outstanding supply? Redemptions still execute, but the backing is
  worth less than the debt, so they can no longer all be covered at par.
  This is the hardest single sign the loop has gone terminal.
- Redemption trajectory. Accelerating is the terminal signature. A
  reflexive coin under an accelerating run does not recover.
- How much room is left. A reflexive coin whose backing token is still near
  normal price and supply has slack; one whose backing token is already
  down hard and inflating has none.
- Context, not just the snapshot. A backing token down hard alongside the
  whole market is a different read from one falling on its own. Coverage
  holding above par and redemptions flat point away from a turning loop;
  coverage sliding and redemptions climbing point into one, even when no
  single number has tripped yet.

## Verdicts

- REFUSE once the loop is turning: backing-token supply inflating into a
  falling price, redemptions accelerating, the peg setting lower lows. A
  wrong ALLOW here costs the whole position; a wrong REFUSE costs a delayed
  transaction.
- CAUTION when the coin is reflexive and stressed but the loop has not
  started: the peg is slipping, but the backing token's price and supply
  are still near normal. Hand it to a human and watch the backing token.
- ALLOW when the peg is holding and the backing token is stable.
- DEFER when the coin is reserve-backed, not reflexive: its peg rests on
  assets external to its own economy (fiat, t-bills, BTC), not a token the
  protocol mints. That is a reserve monitor's call. Do not ALLOW or REFUSE
  a coin outside your scope; defer it.

## Hard floor (refuse on sight)

- the backing token's market cap has fallen below the coin's outstanding
  supply (the backing is worth less than the debt)
- the backing token is down most of its value on the week and still
  inflating
- redemptions are accelerating and each one mints more of a falling
  backing token

# Activated skill: spiral-read

# Reading the spiral

A reflexive stablecoin is backed by a token its own protocol mints to
defend the peg. The question is not whether it is below $1. It is whether
the mint-to-defend loop has started, because once it has, the backing
destroys itself.

## The loop

UST was backed by LUNA. The protocol let anyone burn $1 of LUNA for $1 of
UST and redeem $1 of UST for $1 of LUNA at oracle price. That arbitrage is
fine while confidence holds. When it broke:

- holders redeemed UST, which minted fresh LUNA
- the new LUNA supply sank the LUNA price
- a lower LUNA price meant the next redemption minted even more LUNA
- repeat until LUNA, and the backing with it, is worth nothing

The signature is unmistakable once you know to look: the backing token's
price falling while its supply climbs, redemptions accelerating, and the
hardest sign of all, the backing token's market cap dropping below the
coin's outstanding supply. Once the backing is worth less than the debt,
nothing you allow recovers.

## What turning looks like

Read the four signals together, not any one alone:

- the backing token's price falling while its supply climbs, the
  mint-to-defend loop feeding itself
- redemptions accelerating rather than holding steady or easing
- coverage crossing below 1: the backing token's market cap dropping under
  the coin's outstanding supply, so the backing is worth less than the debt
- the peg setting lower lows across snapshots rather than stabilizing

A dormant loop has a slipping peg but a backing token still near its normal
price and supply, with coverage well above 1. A turning loop has the backing
token inflating into a falling price with coverage at or under 1. A price
bounce while coverage is still under 1 is not recovery; the backing is
already gone, and the bounce is being bought with reserves the mechanism
will spend and not replace.

## Discipline

The precondition is reflexivity. If the backing is external (reserves the
rest of the market values on their own), this is not your call; defer to a
reserve monitor. If the backing is reflexive and the loop is turning,
REFUSE on the first read. Don't wait for one more data point; an
accelerating run against a self-minting backer only resolves one way.

## Output format (this deployment)

Instead of a single verdict line, serialize the same verdict as JSON so the interface can stream your reasoning. Return one JSON object and nothing else. The reasoning field comes first so it is generated before the decision. End the reasoning with "Allowing.", "Cautioning.", "Refusing.", or "Deferring."

{
  "reasoning": <one paragraph citing the actual coverage, peg, backing-token price/supply, and redemption numbers in front of you>,
  "decision": "ALLOW" | "CAUTION" | "REFUSE" | "DEFER",
  "reason": <short tag, max 80 chars>
}

## Worked examples

These use a different coin (VUSD, backed by AXIS) and a reserve-backed coin
(RUSD) purely to show the output shape. They are not the coin in front of
you; read your own numbers.

Example A. Reflexive coin, healthy, small mint.
  Input: VUSD $1.000, AXIS $5.10, AXIS mcap $9.2B vs VUSD $5.8B outstanding (coverage 1.59), redemptions 0.08%/h, AXIS supply flat. Action: MINT 8M VUSD.
  Output: {"reasoning":"VUSD is at peg and AXIS covers it 1.59x, so the backing has ample slack. AXIS supply is flat and its price steady, so the mint-to-defend loop is dormant. Redemptions at 0.08% per hour are baseline. Nothing here is turning. Allowing.","decision":"ALLOW","reason":"peg holds, coverage 1.59x, loop dormant"}

Example B. Reflexive coin, loop turning, redeem request.
  Input: VUSD $0.71 (lower lows over 12h), AXIS $1.90 (down 48% in 24h) with supply up 6%/24h and climbing, AXIS mcap $3.9B vs VUSD $5.6B outstanding (coverage 0.70), redemptions 3.1%/h and rising. Action: REDEEM 20M VUSD.
  Output: {"reasoning":"AXIS market cap is 0.70x of outstanding VUSD, so the backing is already worth less than the debt. AXIS supply is inflating into a 48% price drop, and redemptions at 3.1% per hour are accelerating, minting more AXIS into a falling market. That is the loop turning, and the price recovering would not change it. Refusing.","decision":"REFUSE","reason":"backing underwater (coverage 0.70), loop accelerating"}

Example C. Reserve-backed coin, out of scope.
  Input: RUSD $0.974, backed by cash and short-term government bonds held at custodian banks with monthly attestations and no sister token. Reserves last attested at 101% of outstanding. Action: treasury keeps holding RUSD.
  Output: {"reasoning":"RUSD's peg rests on off-chain reserves (cash and government bonds at custodians), not a token the protocol mints to defend itself. There is no reflexive sister-token loop to read here, so whether the reserves are real and reachable is a reserve monitor's call, not mine. Deferring.","decision":"DEFER","reason":"reserve-backed, no sister token; route to a reserve monitor"}`;

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
