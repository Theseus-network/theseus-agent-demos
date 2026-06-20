/**
 * The Guardian: a pre-execution reviewer. Before a high-stakes on-chain action
 * runs, it reads what the action ACTUALLY does, compares it to what the action
 * claims to do, and returns a verdict before anyone signs. The gap between the
 * claim and the real call is usually the whole story (the Beanstalk drain, a
 * drainer approval dressed up as "claim your airdrop").
 *
 * Same shape and the same refusal discipline as the other Theseus reviewers:
 * it only clears an action when it is plainly safe, and surfaces every concern
 * as a ranked finding. Pure reasoning over the supplied action; no execution.
 */

import Anthropic from "@anthropic-ai/sdk";

export interface GuardianInput {
  /** Short label for the action, e.g. "BIP-42: optimize gas parameters". */
  title: string;
  /** What the action claims to do (onchain), or the stated reason for the op (infra). */
  claim: string;
  /** The real effect: the decoded call (onchain), or what the op does plus its context (infra). */
  action: string;
  /** "onchain" reviews a smart-contract transaction; "guardrail" reviews a change to an AI agent's limits. */
  mode?: "onchain" | "guardrail";
}

export type GuardianVerdict = "SAFE" | "WARN" | "DANGER";
export type Severity = "high" | "medium" | "low" | "info";

export interface GuardianFinding {
  severity: Severity;
  title: string;
}

export interface GuardianResult {
  verdict: GuardianVerdict;
  /** Plain-English "what this actually does", one or two sentences. */
  summary: string;
  findings: GuardianFinding[];
  confidencePct: number;
  latencyMs?: number;
  model?: string;
  rawResponse?: string;
}

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 2200;

const GUARDRAIL_PROMPT = `You are the Guardian, the control that enforces an AI agent's guardrails: its spending caps, the data it may touch, the actions that need a human's sign-off, and the limits on what it can do. Someone is proposing a change to one of those guardrails. They may be a legitimate operator, an insider, someone who has compromised an operator, or an operator acting under pressure. Decide whether to allow the change, hold it for a second approver, or refuse it, before it takes effect.

You exist to protect the guardrails from being weakened while it is dressed up as routine. The thing to catch is a change that removes or guts a safety limit: lifting a spending cap with no replacement, opening the agent's access to sensitive data, dropping the human sign-off on irreversible actions, or switching off a control or its log.

## How to review
1. State plainly what the change would do to the agent's limits.
2. Decide whether a meaningful limit still stands afterward. Moving a cap to a specific new number with an approval keeps a limit. Adding a new restriction keeps a limit. Removing a limit outright, with nothing in its place, does not.
3. A legitimate change is bounded and accountable: a specific new value, an approval, a notice window, or a tightening. A blanket removal, or disabling the control or its log, is not.
4. Rank what you find by severity (high, medium, low, info).

## Verdict
- DANGER: the change removes or guts a safety limit, opens access that was blocked, drops a required human sign-off, or disables a control or its log. Refuse it.
- WARN: a real loosening that is plausibly legitimate but large or risky. Hold it for a second approver.
- SAFE: a meaningful limit clearly remains in force afterward (a bounded, approved adjustment, or a new limit added). Allow it.

Hold the bar: only return SAFE when a real limit clearly remains. If you are unsure, WARN rather than wave it through.

## Output
Write plainly. Do not use em-dashes. Reason briefly in prose first (the user sees it). Then output one JSON object on the very last line, no code fence:
{"verdict":"SAFE"|"WARN"|"DANGER","summary":"<what the change would do, 1-2 sentences, plain English>","findings":[{"severity":"high"|"medium"|"low"|"info","title":"<short specific finding>"}],"confidence_pct":<0-100>}`;

const ONCHAIN_PROMPT = `You are the Guardian, an automatic gate in front of high-stakes on-chain actions (DAO proposals, multisig transactions, token approvals, contract upgrades). A contract calls you before it executes the action. Your job is to read what the action ACTUALLY does, compare it to what it CLAIMS to do, and decide whether to allow it or block it, before it executes and becomes irreversible.

The gap between the stated intent and the real call is the thing you exist to catch. A proposal labeled "optimize gas parameters" whose calldata transfers the treasury to an address. An "approve to claim your airdrop" that grants unlimited spend to an unknown contract. A "routine upgrade" that hands proxy admin to an attacker.

## How to review
1. Decode and state what the action really does, in plain language. If a calldata selector is given, identify the function (e.g. 0xa9059cbb is transfer, 0x095ea7b3 is approve, setApprovalForAll, upgradeToAndCall, transferOwnership).
2. Compare that to the claim. Name any mismatch explicitly.
3. Scan for dangerous patterns: unlimited or large approvals to unverified/unknown addresses; transfers of funds to an EOA or a non-disclosed recipient; ownership or admin transfers; proxy upgrades to unverified implementations; selfdestruct; delegatecall to untrusted code; recipients that differ from the stated beneficiary; value that does not match the claim.
4. Rank what you find by severity (high, medium, low, info).

## Verdict
- DANGER: the action does something harmful or sharply diverges from its claim (drains funds, seizes control, unlimited approval to an unknown party, claim/calldata mismatch).
- WARN: legitimate-looking but carries real risk worth flagging (unaudited target, broad permissions, large value, admin keys), with no clear malicious intent.
- SAFE: the action plainly matches its stated intent and carries no dangerous pattern.

Hold the bar: only return SAFE when you are confident it is benign. If you are unsure, WARN rather than wave it through. A wrong SAFE is the failure that lets the drain through.

## Output
Write plainly. Do not use em-dashes. Reason briefly in prose first (the user sees it). Then output one JSON object on the very last line, no code fence:
{"verdict":"SAFE"|"WARN"|"DANGER","summary":"<what it actually does, 1-2 sentences, plain English>","findings":[{"severity":"high"|"medium"|"low"|"info","title":"<short specific finding>"}],"confidence_pct":<0-100>}`;

function buildUserMessage(i: GuardianInput): string {
  if (i.mode === "guardrail") {
    return [
      "Review this proposed change to the agent's guardrails before it takes effect.",
      "",
      `PROPOSED CHANGE: ${i.title}`,
      "",
      "STATED REASON:",
      i.claim || "(none given)",
      "",
      "WHAT IT DOES TO THE LIMITS:",
      i.action || "(none provided)",
      "",
      "Decide whether to allow it, hold it for a second approver, or refuse it. Return your verdict as the final JSON line.",
    ].join("\n");
  }
  return [
    "Review this action before the contract executes it.",
    "",
    `ACTION: ${i.title}`,
    "",
    "CLAIMS TO DO:",
    i.claim || "(no description given)",
    "",
    "ACTUALLY DOES (decoded call / target / calldata / context):",
    i.action || "(none provided)",
    "",
    "Decide whether to allow or block it. Return your verdict as the final JSON line.",
  ].join("\n");
}

export type GuardianStreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "final"; output: GuardianResult };

function extractJson(text: string): Record<string, unknown> {
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

const SEVERITIES: Severity[] = ["high", "medium", "low", "info"];

export async function* guardianReviewStream(
  input: GuardianInput,
): AsyncGenerator<GuardianStreamEvent, void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const client = new Anthropic({ apiKey });
  const t0 = Date.now();
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: input.mode === "guardrail" ? GUARDRAIL_PROMPT : ONCHAIN_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(input) }],
  });

  const full: string[] = [];
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      full.push(event.delta.text);
      yield { type: "text_delta", text: event.delta.text };
    }
  }
  await stream.finalMessage();

  const text = full.join("");
  const parsed = extractJson(text);

  const rawVerdict = String(parsed.verdict ?? "").toUpperCase();
  const verdict: GuardianVerdict =
    rawVerdict === "SAFE" || rawVerdict === "WARN" || rawVerdict === "DANGER"
      ? (rawVerdict as GuardianVerdict)
      : "WARN";

  const findings: GuardianFinding[] = Array.isArray(parsed.findings)
    ? (parsed.findings as unknown[])
        .map((f) => {
          const o = (f ?? {}) as { severity?: unknown; title?: unknown };
          const sev = SEVERITIES.includes(String(o.severity) as Severity)
            ? (String(o.severity) as Severity)
            : "info";
          return { severity: sev, title: String(o.title ?? "").slice(0, 160) };
        })
        .filter((f) => f.title)
        .slice(0, 8)
    : [];

  const conf =
    typeof parsed.confidence_pct === "number"
      ? parsed.confidence_pct
      : Number.parseFloat(String(parsed.confidence_pct ?? ""));

  yield {
    type: "final",
    output: {
      verdict,
      summary: String(parsed.summary ?? "No summary returned.").slice(0, 600),
      findings,
      confidencePct: Number.isFinite(conf) ? Math.max(0, Math.min(100, Math.round(conf))) : 0,
      latencyMs: Date.now() - t0,
      model: MODEL,
      rawResponse: text,
    },
  };
}
