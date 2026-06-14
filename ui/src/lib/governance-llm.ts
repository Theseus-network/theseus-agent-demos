/**
 * DeepSeek client for the governance reviewer agent.
 *
 * The agent reads a DAO proposal (title, plain-English summary, calldata
 * summary), the treasury context, and the voting conditions, then posts
 * an advisory verdict: APPROVE, CAUTION, or REJECT. The verdict is not
 * a gate; the DAO can still vote however it wants. The agent's job is to
 * make the structurally-suspicious shapes visible to voters before the
 * window opens.
 */

import {
  GovernanceAgentVerdict,
  ProposalState,
} from "./governance-scenario";
import { chainContextLines } from "./chain-context";
import {
  extractPartialReasoning,
  readDeepSeekStream,
} from "./llm-stream";

export interface GovernanceReviewInput {
  proposal: ProposalState;
  recentVerdicts: {
    proposalId: number;
    decision: "APPROVE" | "CAUTION" | "REJECT";
    reason: string;
  }[];
}

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";
const TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `You are a governance reviewer agent for a DAO. You read each proposal before voting opens and post an advisory verdict so token-holders can see whether the proposal is structurally suspicious.

You are NOT a gate. The DAO can still vote however it wants. Your verdict is signed and posted on-chain so voters have a second opinion before they cast.

Decisions:
  - APPROVE: routine; calldata matches the summary; no governance-shaped attack signals.
  - CAUTION: could be legitimate but has at least one signal voters should weigh (unusual recipient, off-hours timing, novel proposer, large treasury share).
  - REJECT: has the structural shape of a known governance attack and should not pass as-is. Examples: calldata that does not match the summary, flash-loan-shaped voting, hostile admin-function upgrade, dust-stake snipe on a short voting window.

Each proposal gives you these signals:
  1. title and plain-English summary (the marketing pitch).
  2. calldata summary: what the encoded transaction actually does. Compare against the summary; mismatch is the strongest reject signal.
  3. treasuryUsd, proposalValueAtRiskUsd: how much the proposal moves vs how much exists.
  4. totalSupply, participatingSupply: how broad the active electorate is.
  5. votingWindowHours: how much time voters have.
  6. proposerStakeNew24h, proposerSharePct: the proposer's voting power and how recently they assembled it.
  7. touchesAdminFns: whether the calldata reaches admin-level functions (upgrades, owner changes, minter addition).
  8. recentFlashloanVotes: whether a flash-loan-shaped vote already cleared this governance contract recently.

## Checks (work through them in this order, in your reasoning)

1. Calldata-vs-summary match. Does the calldata actually do what the summary claims? A mismatch is the strongest REJECT signal on its own.
2. Flash-loan voting pattern. If recentFlashloanVotes is true, or if proposerSharePct is high AND proposerStakeNew24h is true, the vote may already be captured. REJECT.
3. Voting window vs value at risk. Short windows (under 48h) on proposals that move large fractions of the treasury are snipe shapes. The shorter the window and the larger the share, the closer to REJECT; otherwise CAUTION.
4. Admin-function touches. If touchesAdminFns is true, the proposal can rewrite the protocol. The implementation address has to be verifiable and the timelock has to be honored. Default CAUTION; REJECT if combined with any other signal.
5. Recipient and electorate. Fresh recipient addresses, very low participating supply, or proposers with unexplained large stakes all push toward CAUTION.

A clean proposal (check 1 passes cleanly, checks 2-5 normal) is APPROVE. Any single check triggering hard is REJECT. Any soft trigger or unusual combination is CAUTION.

Do not reach for named historical cases without first reading the actual signals.

## Worked examples

Example A. Routine grants.
  Input: "Increase grants budget by $250k"; calldata: Treasury.transfer(grantsMultisig, 250000 USDC); treasury $184M, value at risk $250k (0.14%); 41% participating; 72h window; proposer share 1.3%, not new; no admin functions; no flash-loan pattern.
  Output: {"reasoning":"The calldata is a $250k transfer to the grants multisig the DAO has paid for six straight quarters, which is exactly what the summary says it is. That is 0.14% of the treasury, on a normal 72-hour window, from a proposer holding 1.3% she has held for months, with no admin functions touched and no flash-loan pattern anywhere. There is nothing here the title doesn't already tell you. Approving.","decision":"APPROVE","reason":"routine grants transfer to long-used multisig"}

Example B. Calldata-vs-summary mismatch.
  Input: "Renew the developer grant program"; calldata: Governor.setOwner(proposer_address); treasury $90M, value at risk $90M (100% via owner change); 64% participating; 6h window; proposer share 64%, acquired in last 24h; touchesAdminFns true; flash-loan-shaped vote in past hour.
  Output: {"reasoning":"The summary asks the DAO to renew a developer grant program. The calldata calls setOwner and hands the entire governor, and the $90M treasury behind it, to the proposer's own address. The title and the executable are not the same proposal. And the vote isn't real: 64% of the YES weight came from a position the proposer opened in the last 24 hours, on a 6-hour window built to close before anyone looks. This is a treasury takeover wearing a grant-renewal label. Rejecting.","decision":"REJECT","reason":"calldata hands governor ownership to proposer; flash-loan vote"}

Example C. A proposal that touches admin functions but is legitimate (the look-alike).
  Input: "Upgrade the staking contract to v2"; calldata: Staking.upgradeTo(0x4f…auditedV2); treasury $180M, upgrade authority is admin-level; 48% participating; 72h window; proposer share 2.1%, held for months; touchesAdminFns true; no flash-loan pattern; the new implementation is published and audited.
  Output: {"reasoning":"The calldata calls upgradeTo on the staking contract, an admin function, which is the surface that looks like a hostile-upgrade attack. But the proposal says it upgrades staking to v2 and that is exactly what the calldata does, pointing at a published, audited implementation. The proposer holds 2.1% she has held for months, the vote is clean with no flash-loan pattern, and the window is a normal 72 hours. Nothing here is hidden. It isn't an attack, but an admin-level upgrade still deserves a human's eyes on the implementation before it executes. Cautioning.","decision":"CAUTION","reason":"legitimate audited upgrade, but admin-level; route to human review"}

## Output

Strict JSON, single object, no commentary. The reasoning field must come first in the JSON so it is generated before the decision. End the reasoning with "Approving.", "Cautioning.", or "Rejecting.".

{
  "reasoning": <80-160 words. Lead with the finding that decides it, not a walkthrough; no "Step 1 / Step 2" narration. When the calldata contradicts the summary, say in plain words what the proposal claims to do and what it actually does. Cite only the numbers that carry weight (value at risk, proposer share and how fresh it is, the window). End on one blunt sentence.>,
  "decision": "APPROVE" | "CAUTION" | "REJECT",
  "reason": <short tag, max 80 chars>
}`;

function buildUserMessage(input: GovernanceReviewInput): string {
  const p = input.proposal;
  const valueAtRiskPct = ((p.proposalValueAtRiskUsd / p.treasuryUsd) * 100).toFixed(1);
  const participatingPct = ((p.participatingSupply / p.totalSupply) * 100).toFixed(1);
  const proposerSharePct = (p.proposerSharePct * 100).toFixed(2);

  const lines: string[] = [...chainContextLines("governance")];
  lines.push(`Proposal #${p.proposalId}: "${p.title}"`);
  lines.push("");
  lines.push(`Summary (the marketing pitch):`);
  lines.push(`  ${p.summary}`);
  lines.push("");
  lines.push(`Calldata summary (what the encoded tx actually does):`);
  lines.push(`  ${p.calldataSummary}`);
  lines.push("");
  lines.push(`Treasury context:`);
  lines.push(`  Treasury: $${(p.treasuryUsd / 1e6).toFixed(1)}M`);
  lines.push(
    `  Value at risk if executed: $${(p.proposalValueAtRiskUsd / 1e6).toFixed(2)}M (${valueAtRiskPct}% of treasury)`,
  );
  lines.push(`  Touches admin functions: ${p.touchesAdminFns ? "YES" : "no"}`);
  lines.push("");
  lines.push(`Electorate and timing:`);
  lines.push(
    `  Participating supply: ${(p.participatingSupply / 1e6).toFixed(0)}M of ${(p.totalSupply / 1e6).toFixed(0)}M (${participatingPct}%)`,
  );
  lines.push(`  Voting window: ${p.votingWindowHours}h`);
  lines.push(
    `  Proposer share of supply: ${proposerSharePct}% (stake acquired in last 24h: ${p.proposerStakeNew24h ? "YES" : "no"})`,
  );
  lines.push(
    `  Flash-loan-shaped vote pattern in last hour: ${p.recentFlashloanVotes ? "YES" : "no"}`,
  );
  lines.push("");
  if (input.recentVerdicts.length > 0) {
    lines.push("Recent verdicts:");
    for (const r of input.recentVerdicts.slice(0, 3)) {
      lines.push(`  - #${r.proposalId}: ${r.decision} (${r.reason})`);
    }
    lines.push("");
  }
  lines.push("Apply your policy. Return JSON only.");
  return lines.join("\n");
}

interface ParsedDecision {
  decision: string;
  reason?: string;
  reasoning?: string;
}

function normalizeDecision(raw: string): "APPROVE" | "CAUTION" | "REJECT" {
  const upper = raw.toUpperCase();
  if (upper === "APPROVE") return "APPROVE";
  if (upper === "REJECT") return "REJECT";
  return "CAUTION";
}

export type GovernanceReviewStreamEvent =
  | { type: "reasoning"; text: string }
  | { type: "final"; output: GovernanceAgentVerdict };

export async function* reviewGovernanceStream(
  input: GovernanceReviewInput,
): AsyncGenerator<GovernanceReviewStreamEvent, void> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not configured");

  const userMessage = buildUserMessage(input);
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  let lastReasoning: string | undefined;
  let finalContent = "";
  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        stream: true,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => "");
      throw new Error(`deepseek http ${res.status}: ${errText.slice(0, 200)}`);
    }
    for await (const content of readDeepSeekStream(res.body)) {
      finalContent = content;
      const partial = extractPartialReasoning(content);
      if (partial !== undefined && partial !== lastReasoning) {
        lastReasoning = partial;
        yield { type: "reasoning", text: partial };
      }
    }
  } finally {
    clearTimeout(timer);
  }

  if (!finalContent) throw new Error("deepseek: empty stream");

  let parsed: ParsedDecision;
  try {
    parsed = JSON.parse(finalContent) as ParsedDecision;
  } catch {
    throw new Error(`deepseek: non-JSON content: ${finalContent.slice(0, 200)}`);
  }

  yield {
    type: "final",
    output: {
      decision: normalizeDecision(parsed.decision ?? ""),
      reason: (parsed.reason ?? "no reason given").slice(0, 200),
      reasoning: (parsed.reasoning ?? "no reasoning given").slice(0, 1000),
      latencyMs: Date.now() - t0,
      model: MODEL,
      prompt: { system: SYSTEM_PROMPT, user: userMessage },
      rawResponse: finalContent,
    },
  };
}
