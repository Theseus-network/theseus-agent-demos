/**
 * Counterfactual: what a treasury run by a human (or by no one) does at this
 * tick. The fund's value isn't a clever call; it's that the mandate actually
 * gets executed, every tick, without a conviction to override it. Without the
 * agent, the plan sits on the forum.
 */

import type { FundAgentDecision, MarketSnapshot } from "./fund-scenario";

export interface FundCounterfactual {
  summary: string;
  severity: "low" | "med" | "high";
  divergesFromAgent: boolean;
}

export function fundCounterfactual(
  market: MarketSnapshot,
  decision: FundAgentDecision,
): FundCounterfactual {
  const ret24hPct = (market.ret24h - 1) * 100;

  if (decision.action === "SELL_WETH") {
    return {
      summary: `No agent: nobody executes the de-risk. The treasury holds its full WETH weight through a ${ret24hPct.toFixed(0)}% day, on a mandate that said to cut. DAO treasuries rode their own token down ninety percent with the rebalance plan sitting on the forum.`,
      severity: "high",
      divergesFromAgent: true,
    };
  }
  if (decision.action === "BUY_WETH") {
    return {
      summary: `No agent: the tilt to risk waits on a human choosing to act, on schedule, in a market that already moved. Most never rebalance into strength on time.`,
      severity: "med",
      divergesFromAgent: true,
    };
  }
  if (decision.action === "SKIP") {
    return {
      summary: `No agent: the tick trades on a feed it shouldn't trust instead of standing down. The skip is signed, so the record shows the agent ran and chose not to act on bad data.`,
      severity: "med",
      divergesFromAgent: true,
    };
  }
  // HOLD
  return {
    summary: `No agent: also nothing this tick. The difference is that the agent's HOLD is signed, so the record shows "deliberately held" rather than "failed to run."`,
    severity: "low",
    divergesFromAgent: false,
  };
}
