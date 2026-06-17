---
title: Terra Failsafe
lastUpdated: 2026-06-17
---

# Terra Failsafe (`/terra`)

**Gates mint and redeem on a Terra-shaped algorithmic stable.** The agent reviews the live vault state plus the live Frax peg and decides whether to honor the next mint or redeem. Refusal halts the mechanism until conditions clear.

## Failure shape

Terra/Luna, May 2022, ~$40B. The Anchor-fed minter kept honoring UST redemptions long after the peg was structurally broken. Each redemption minted more LUNA, which depressed LUNA price, which made the next redemption mint more LUNA. The contract had no way to decide whether the next redemption was *the* redemption that would tip the spiral.

## What the agent reads

- Live vault state (peg, reserve coverage, LUND supply growth, recent 1h redemption rate)
- Live Frax peg via CoinGecko (`/simple/price?ids=frax,frax-share`)
- Frax protocol supply via DefiLlama (best-effort)

## Decision

Synthetic presets reproduce specific death-spiral cells (calm / accelerating / late-stage / collapsed). The "live frax" preset feeds real numbers in. The agent's job: ALLOW, CAUTION, or REFUSE based on whether honoring the action would push the system across a stability threshold the dossier defines.

## Code map

- Contract: `contracts/src/TerraFailsafe.sol`
- Scenario state + live integration: `ui/src/lib/terra-scenario.ts`, `ui/src/lib/live-frax.ts`
- Live data route: `ui/src/app/api/terra/live-frax/route.ts`
- LLM prompt: `ui/src/lib/terra-llm.ts`
- UI: `ui/src/app/terra/page.tsx`, `ui/src/components/terra/TerraScenarioControls.tsx`

## Try it

[demo-agents.theseus.network/terra](https://demo-agents.theseus.network/terra). Click a preset to load synthetic state; click "live frax" to load real Frax/FXS numbers. Hit the action button to ask the agent to ALLOW or REFUSE the next mint/redeem.

## On-chain

Each decision becomes a `latestTimestamp(MINT)` or `latestTimestamp(REDEEM)` write on [TerraFailsafe](https://sepolia.basescan.org/address/0x0B59da3768CB0F1725A1C2183dD1Ad93058394d2). The contract stores latest-per-action rather than a full history; the agent signs the dossier hash on every decision.

---

_Last updated: June 17, 2026._
