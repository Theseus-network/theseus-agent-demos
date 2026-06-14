/**
 * Counterfactual: what the DAO's normal review (a delegate reads the pitch,
 * not the executable calldata) would have done with this proposal, and what
 * it would have cost. The point of the demo isn't that the agent rejected; it
 * is that without it the proposal goes to a vote on schedule.
 */

import type {
  GovernanceAgentVerdict,
  ProposalState,
} from "./governance-scenario";

export interface GovernanceCounterfactual {
  summary: string;
  severity: "low" | "med" | "high";
  divergesFromAgent: boolean;
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function governanceCounterfactual(
  proposal: ProposalState,
  verdict: GovernanceAgentVerdict,
): GovernanceCounterfactual {
  const atRisk = proposal.proposalValueAtRiskUsd;
  const drainsTreasury =
    atRisk / Math.max(proposal.treasuryUsd, 1) >= 0.9;

  if (verdict.decision === "REJECT") {
    return {
      summary: `No agent: the review reads the title, not the calldata, and the proposal goes to a vote on schedule. ${fmtUsd(atRisk)}${drainsTreasury ? ", the entire treasury," : ""} rides on an executable that does what the body never said. Beanstalk lost $182M to a proposal that cleared in exactly this window.`,
      severity: "high",
      divergesFromAgent: true,
    };
  }
  if (verdict.decision === "CAUTION") {
    return {
      summary: `No agent: it is waved through with no flag, and ${fmtUsd(atRisk)} moves on a proposal nobody decoded. The agent forces a human to look before the vote opens.`,
      severity: "med",
      divergesFromAgent: true,
    };
  }
  return {
    summary: `No agent: also approved. The calldata matches the body and nothing structurally suspicious fired; the agent and the room agree.`,
    severity: "low",
    divergesFromAgent: false,
  };
}
