/** Shared types for the launch sniper loop. */

import type { Address, Hex } from "viem";

/** A fresh pool candidate surfaced by the indexer. */
export interface PoolCandidate {
  pool: Address;
  /** The new (non-quote) token. The other side is USDC or WETH. */
  token: Address;
  /** Which quote token the pool is paired against. */
  quote: "USDC" | "WETH";
  /** Address of the quote-side token (USDC or WETH on Base mainnet). */
  quoteAddress: Address;
  /** Pool fee tier in hundredths of a bip (500 = 0.05%, 3000 = 0.3%). */
  feeTier: number;
  /** Block at which the PoolCreated event fired. */
  createdAtBlock: bigint;
  /** Tx hash of the PoolCreated event. */
  txHash: Hex;
}

/** Token metadata read directly via ERC-20 calls. */
export interface TokenMetadata {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
}

/** Phase 2 signals: external lookups that ground the agent's decision
 *  in real reporter data (Basescan source verification, on-chain mint
 *  authority, deployer history, holder concentration). Each field is
 *  best-effort; null means "the lookup ran but found nothing"; the
 *  containing object is null when the entire Phase 2 pass was skipped
 *  or failed (e.g. Basescan unreachable). */
export interface Phase2Signals {
  /** True iff Basescan returns a non-empty SourceCode field. */
  sourceVerified: boolean | null;
  /** Compiler version reported by Basescan, when verified. */
  compilerVersion: string | null;
  /** Result of reading `owner()` on the token:
   *   - "renounced"  → owner is 0x0 (mint authority renounced)
   *   - "active"     → owner is a non-zero EOA / contract (can mint, pause, etc.)
   *   - "no-owner"   → contract has no Ownable shape; can't tell
   *   - null         → read errored */
  mintAuthorityState: "renounced" | "active" | "no-owner" | null;
  /** The deployer EOA (the `from` of the pool-creation tx), if resolvable. */
  deployerAddress: Address | null;
  /** Count of contract creations attributable to the deployer EOA. A
   *  brand-new deployer is 1 (this token); a long-lived deployer might
   *  be 10+. A serial-scammer is often 50+ with most contracts dead. */
  deployerPriorDeploys: number | null;
  /** Top-10 holder share of total supply, 0..1. null on lookup failure. */
  top10Concentration: number | null;
  /** Wall-clock time the Phase 2 pass ran. */
  fetchedAt: string;
}

/** Live state read from the UniV3 pool. */
export interface PoolState {
  pool: Address;
  /** Mid price expressed as: 1 token = X quote, scaled by 1e18.
   *  Use Number(value)/1e18 for display. */
  priceQuotePerToken_1e18: bigint;
  /** Quote liquidity inside the active range, in quote-token native
   *  decimals (USDC = 6, WETH = 18). */
  quoteSideLiquidity: bigint;
  /** Whether the pool has been initialized at all (slot0 returns a
   *  non-zero sqrtPriceX96). */
  initialized: boolean;
}

/** Everything the LLM sees about a candidate. */
export interface ResearchDossier {
  candidate: PoolCandidate;
  token: TokenMetadata;
  pool: PoolState;
  /** Phase 2 grounding. Null when the lookup was skipped or failed
   *  entirely; the per-field nulls inside indicate partial misses. */
  phase2: Phase2Signals | null;
  /** Wall-clock time the dossier was assembled, in UTC ISO format. */
  assembledAt: string;
}

/** What the LLM emits. */
export interface AgentDecision {
  decision: "PASS" | "BUY";
  sizeUsdc: number; // in dollars (e.g. 50, 250); 0 for PASS
  checks: {
    source_verified: boolean | "unknown";
    mint_authority_renounced: boolean | "unknown";
    lp_locked: boolean | "unknown";
    deployer_clean: boolean | "unknown";
    top10_concentration: number | "unknown";
  };
  reason: string; // short tag
  reasoning: string; // one paragraph
}

/** What gets posted to the on-chain reason hash blob. */
export interface ReasonBlob {
  /** Schema version for the reason blob format. */
  schema: "launch-sniper/v1";
  dossier: ResearchDossier;
  decision: AgentDecision;
  paperFill?: {
    quote: "USDC" | "WETH";
    quoteAddress: Address;
    quoteAmountIn: string; // wei-style string
    tokenAmountOut: string; // wei-style string
    pricePaidQuotePerToken_1e18: string;
  };
  model: string;
  evaluatedAt: string; // ISO timestamp
}
