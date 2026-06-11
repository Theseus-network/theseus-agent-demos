/**
 * Luna Failsafe demo state.
 *
 * Models the real Terra/LUNA stablecoin: 1 UST targets a $1 peg, backed by
 * mint/burn against LUNA at the LUNA/USD oracle price. The internal vault
 * fields keep their original ustd/lund names; the UI displays UST/LUNA.
 * Presets replay the May 2022 collapse day by day.
 *
 * Difference from a real on-chain protocol: an LLM agent gates every
 * mint / redeem call. The protocol invokes the agent first; if the
 * agent REFUSES, the action reverts. A smart contract running this
 * mechanism without an agent is exactly what melted in May 2022, and the
 * counterfactual badge on each row makes that visible.
 */

export type ActionKind = "MINT" | "REDEEM";

export interface VaultState {
  ustdSupply: number;
  lundSupply: number;
  lundPriceUsd: number;
  ustdMedianUsd: number;
  redemptionRate1h: number;
  lundSupplyGrowth24h: number;
  lundPriceChange24h: number;
  reserveCoverage: number;
  // --- optional framing, so the agent can judge coins other than UST/LUNA
  // and reserve-backed coins it should DEFER on. Defaults keep UST/LUNA. ---
  /** "reflexive" (default) reads the backing-token loop; "reserve" hands the
   *  agent an externally-backed coin it should recognize as out of scope. */
  kind?: "reflexive" | "reserve";
  /** Display/prompt name for the coin (default "UST"). */
  coinName?: string;
  /** Display/prompt name for the backing token (default "LUNA"). */
  backingName?: string;
  /** Free-text market/trajectory context fed to the agent, e.g. "majors down
   *  18-30% market-wide" or "drifting ~30bps/day for 5 days". A single
   *  snapshot can't carry trajectory; this can. */
  contextNote?: string;
  /** Qualifier on the redemption number, e.g. "flat for 10h" or "rising for
   *  72h". */
  redemptionNote?: string;
  // --- reserve-backed only (kind === "reserve") ---
  /** Reserve composition, e.g. "cash + short-term government bonds at
   *  custodian banks, attested monthly, no sister token". */
  reserveComposition?: string;
  /** Reserves as a fraction of outstanding at last attestation (e.g. 1.02). */
  reserveRatio?: number;
}

export interface AgentVerdict {
  decision: "ALLOW" | "CAUTION" | "REFUSE" | "DEFER";
  reason: string;
  reasoning: string;
  latencyMs?: number;
  model?: string;
  prompt?: { system: string; user: string };
  rawResponse?: string;
}

import type { OnChainCommit } from "./agent-onchain/types";

export type { OnChainCommit };

export interface TimelineEntry {
  block: number;
  action: ActionKind;
  ustdAmount: number;
  lundAmount: number;
  /** Undefined while the agent is reasoning; filled in when the LLM responds. */
  verdict?: AgentVerdict;
  pending?: boolean;
  /** Live partial reasoning text streamed from the LLM. Cleared when
   *  verdict lands. Renderers display this in place of the verdict's
   *  reasoning while the agent is still thinking. */
  streamingReasoning?: string;
  /** Populated once the API has posted the verdict to TerraFailsafe on
   *  Base Sepolia. Arrives as a `committed` SSE event a few seconds after
   *  the verdict itself. */
  commit?: OnChainCommit;
  /** Set when the commit attempt failed; verdict still stands in the UI. */
  commitError?: string;
  vaultSnapshot: VaultState;
  scenarioLabel?: string;
}

export interface TerraScenarioState {
  vault: VaultState;
  events: TimelineEntry[];
  blockOffset: number;
  pending: boolean;
  presetLabel: string;
}

// All presets replay the real Terra/LUNA collapse, May 2022. The vault
// uses the real coin names internally as ustd/lund fields, displayed as
// UST and LUNA. The load-bearing signal is the backing coverage: LUNA's
// market cap (lundSupply * lundPriceUsd) against UST's outstanding value
// (ustdSupply). When it crosses below 1, the backing is worth less than
// the debt and no bounce in the UST price recovers it.

/** LUNA's total market value: circulating supply times price. */
export function lunaMarketCap(v: VaultState): number {
  return v.lundSupply * v.lundPriceUsd;
}

/** Backing coverage: LUNA market cap as a fraction of UST outstanding.
 *  Below 1.0 means the backing token is worth less than the debt. */
export function backingCoverage(v: VaultState): number {
  return lunaMarketCap(v) / Math.max(v.ustdSupply, 1);
}

export const HEALTHY: VaultState = {
  ustdSupply: 18_000_000_000,
  lundSupply: 343_000_000,
  lundPriceUsd: 80,
  ustdMedianUsd: 1.0,
  redemptionRate1h: 0.001,
  lundSupplyGrowth24h: 1.0,
  lundPriceChange24h: 1.0,
  reserveCoverage: 0.28,
};

export const initialTerraScenario = (): TerraScenarioState => ({
  vault: { ...HEALTHY },
  events: [],
  blockOffset: 0,
  pending: false,
  presetLabel: "Healthy",
});

/** Preset vault states. Each one replays a real day of the May 2022
 *  Terra/LUNA collapse, from healthy through the death spiral. */
export const PRESETS: Record<string, { label: string; description: string; vault: VaultState }> = {
  healthy: {
    label: "May 7 · healthy",
    description:
      "Peg solid at $1. LUNA ~$80 with a market cap well above UST's outstanding supply. The mechanism is calm.",
    vault: { ...HEALTHY },
  },
  wobble: {
    label: "May 8 · slight depeg",
    description:
      "UST slips to $0.985 on a large Curve sale. LUNA down ~10% to $64, but its market cap still covers UST. Stressed, not broken.",
    vault: {
      ustdSupply: 18_000_000_000,
      lundSupply: 343_000_000,
      lundPriceUsd: 64,
      ustdMedianUsd: 0.985,
      redemptionRate1h: 0.01,
      lundSupplyGrowth24h: 1.0,
      lundPriceChange24h: 0.9,
      reserveCoverage: 0.26,
    },
  },
  cracking: {
    label: "May 9 · underwater",
    description:
      "UST breaks to $0.65. LUNA down 44% to $35, and its market cap has now fallen below UST's outstanding supply. The backing is worth less than the debt.",
    vault: {
      ustdSupply: 16_000_000_000,
      lundSupply: 350_000_000,
      lundPriceUsd: 35,
      ustdMedianUsd: 0.65,
      redemptionRate1h: 0.08,
      lundSupplyGrowth24h: 1.02,
      lundPriceChange24h: 0.56,
      reserveCoverage: 0.12,
    },
  },
  bankRun: {
    label: "May 10 · the bounce",
    description:
      "UST bounces back to $0.93 as LFG burns $750M of BTC to defend it. The price looks like recovery, while LUNA's market cap stays far below UST. The backing never recovered.",
    vault: {
      ustdSupply: 16_000_000_000,
      lundSupply: 350_000_000,
      lundPriceUsd: 30,
      ustdMedianUsd: 0.93,
      redemptionRate1h: 0.05,
      lundSupplyGrowth24h: 1.03,
      lundPriceChange24h: 0.86,
      reserveCoverage: 0.1,
    },
  },
  spiral: {
    label: "May 12 · death spiral",
    description:
      "UST at $0.10. LUNA hyperinflated past 1.4B and trading near $0.02. The backing is essentially worthless. The chain halted the next day.",
    vault: {
      ustdSupply: 15_000_000_000,
      lundSupply: 1_400_000_000,
      lundPriceUsd: 0.02,
      ustdMedianUsd: 0.1,
      redemptionRate1h: 0.15,
      lundSupplyGrowth24h: 3.0,
      lundPriceChange24h: 0.02,
      reserveCoverage: 0.005,
    },
  },
};

// =============================================================================
// Apply user actions
// =============================================================================

/** Push a pending placeholder onto the timeline. The agent fills in the
 *  verdict (and we re-apply the vault mutation if allowed) when the LLM
 *  responds. */
export function applyPendingAction(
  state: TerraScenarioState,
  action: ActionKind,
  ustdAmount: number,
): TerraScenarioState {
  const lundAmount = ustdAmount / Math.max(state.vault.lundPriceUsd, 0.0001);
  const block = 7_000_000 + state.blockOffset + 1;
  const entry: TimelineEntry = {
    block,
    action,
    ustdAmount,
    lundAmount,
    pending: true,
    vaultSnapshot: { ...state.vault },
    scenarioLabel: state.presetLabel,
  };
  return {
    ...state,
    events: [entry, ...state.events].slice(0, 30),
    blockOffset: state.blockOffset + 1,
    pending: true,
  };
}

/** Replace the head pending event with the agent's verdict. If allowed,
 *  also apply the vault mutation. */
export function applyAgentVerdict(
  state: TerraScenarioState,
  verdict: AgentVerdict,
): TerraScenarioState {
  if (state.events.length === 0 || !state.events[0].pending) {
    return { ...state, pending: false };
  }
  const head = state.events[0];
  const finalized: TimelineEntry = {
    ...head,
    pending: false,
    verdict,
    streamingReasoning: undefined,
  };

  let nextVault = state.vault;
  if (verdict.decision === "ALLOW") {
    if (head.action === "MINT") {
      nextVault = {
        ...state.vault,
        ustdSupply: state.vault.ustdSupply + head.ustdAmount,
        lundSupply: Math.max(0, state.vault.lundSupply - head.lundAmount),
      };
    } else {
      nextVault = {
        ...state.vault,
        ustdSupply: Math.max(0, state.vault.ustdSupply - head.ustdAmount),
        lundSupply: state.vault.lundSupply + head.lundAmount,
      };
    }
  }

  return {
    ...state,
    vault: nextVault,
    events: [finalized, ...state.events.slice(1)],
    pending: false,
  };
}

export function applyPreset(
  state: TerraScenarioState,
  presetKey: keyof typeof PRESETS,
): TerraScenarioState {
  const p = PRESETS[presetKey];
  return {
    ...state,
    vault: { ...p.vault },
    presetLabel: p.label,
    blockOffset: state.blockOffset + 1,
  };
}

export function setTerraPending(state: TerraScenarioState, pending: boolean): TerraScenarioState {
  return { ...state, pending };
}

/** Update the streaming reasoning on the head pending entry. */
export function setTerraPendingReasoning(
  state: TerraScenarioState,
  reasoning: string,
): TerraScenarioState {
  if (state.events.length === 0 || !state.events[0].pending) return state;
  const head = state.events[0];
  return {
    ...state,
    events: [
      { ...head, streamingReasoning: reasoning },
      ...state.events.slice(1),
    ],
  };
}

/** Attach the on-chain commit info to the most recent (head) verdict entry. */
export function applyTerraOnChainCommit(
  state: TerraScenarioState,
  commit: OnChainCommit,
): TerraScenarioState {
  if (state.events.length === 0) return state;
  const head = state.events[0];
  return {
    ...state,
    events: [{ ...head, commit }, ...state.events.slice(1)],
  };
}

/** Record a commit failure on the head entry without disturbing the
 *  verdict itself. */
export function applyTerraCommitError(
  state: TerraScenarioState,
  commitError: string,
): TerraScenarioState {
  if (state.events.length === 0) return state;
  const head = state.events[0];
  return {
    ...state,
    events: [{ ...head, commitError }, ...state.events.slice(1)],
  };
}
