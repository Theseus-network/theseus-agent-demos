/**
 * Counterfactual: what happens to this certification change without an
 * independent second opinion. Under the FAA's ODA program the manufacturer's
 * own engineers sign off, so the change is certified as proposed and reaches
 * the fleet. The point of the demo isn't that the agent flagged it; it is that
 * without it the change ships as submitted.
 */

import type {
  AviationAgentVerdict,
  CertificationChange,
} from "./aviation-scenario";

export interface AviationCounterfactual {
  summary: string;
  severity: "low" | "med" | "high";
  divergesFromAgent: boolean;
}

export function aviationCounterfactual(
  change: CertificationChange,
  verdict: AviationAgentVerdict,
): AviationCounterfactual {
  const training =
    change.proposedTrainingClass === "simulator"
      ? "full-simulator"
      : change.proposedTrainingClass === "ipad"
        ? "iPad-course"
        : "no-training";
  const fleet = change.fleetSize.toLocaleString();

  if (verdict.decision === "REJECT") {
    return {
      summary: `No independent review: under the ODA program the manufacturer self-certifies, and the change is approved as a ${training} change, ${change.disclosedInFCOM ? "documented" : "undocumented"} in the manual the crew trained on. ${fleet} aircraft fly it. The 737 MAX's MCAS change was certified by this exact path.`,
      severity: "high",
      divergesFromAgent: true,
    };
  }
  if (verdict.decision === "CAUTION") {
    return {
      summary: `No independent review: the change is certified with no extra scrutiny, and ${fleet} aircraft fly it. The agent forces a closer look before delivery.`,
      severity: "med",
      divergesFromAgent: true,
    };
  }
  return {
    summary: `No independent review: also approved. The change is structurally low-risk and the agent agrees.`,
    severity: "low",
    divergesFromAgent: false,
  };
}
