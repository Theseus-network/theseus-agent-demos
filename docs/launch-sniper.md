---
title: Launch Sniper
lastUpdated: 2026-06-17
---

# Launch Sniper (`/launch-sniper`)

**Watches Base for fresh Uniswap V3 launches. Reviews each one. Mostly passes.** The agent builds a multi-source dossier on every new pool and decides BUY (paper) or PASS.

## What this proves

The interesting case for an autonomous trading agent isn't "make money" — it's "decline 99% of the time, with a written reason, and explain it." Every meme-rug since 2024 has a recognizable shape: contract verified somewhere but mint authority not renounced, deployer with a string of dead deploys, top-10 holder concentration above 95%, no public footprint beyond DEX-tracker spam.

## What the agent reads

Phase 1 — on-chain (always):
- `PoolCreated` event on Uniswap V3 factory (Base mainnet)
- ERC-20 metadata via direct contract reads (name, symbol, decimals, totalSupply)
- Pool slot0 (price, sqrtPriceX96, liquidity, initialized)

Phase 2 — multi-source dossier (gated by Phase 1 not being an obvious rug):
- Etherscan V2 (`getsourcecode`): is source verified, which compiler
- On-chain: `owner()` selector — renounced / active / no-owner
- Deployer history: count of contract creations attributable to the deployer EOA
- Top-10 holder concentration via Basescan token holder list
- GoPlus Security (`api.gopluslabs.io/api/v1/token_security/8453`): honeypot, mintability, taxes, LP lock, top-3 holder tags
- Brave Search + DeepSeek narrative: gated by basic credibility check (skips if GoPlus says honeypot/closed-source/no-record); searches for team identity, coverage, red-flag reports

## Decision

Claude Haiku 4.5 evaluator with strict rules:
- GoPlus `is_honeypot=YES` or `can_take_back_ownership=YES` → automatic PASS
- Narrative `red_flag=YES` → automatic PASS
- Narrative `presence=substantial` → upgrades conviction
- Source unverified AND GoPlus closed-source → skip narrative fetch, surface as flag
- Default behavior on any incomplete dossier: PASS (safe default for a sniper)

## Code map

- Contract: `contracts/src/LaunchSniperFund.sol`
- Phase 1 indexer: `ui/src/lib/launch-sniper/indexer.ts`
- Phase 2 dossier: `ui/src/lib/launch-sniper/phase2.ts`
- GoPlus client: `ui/src/lib/launch-sniper/goplus.ts`
- Brave + DeepSeek narrative: `ui/src/lib/launch-sniper/{search,narrative}.ts`
- Evaluator (Claude Haiku 4.5): `ui/src/lib/launch-sniper/evaluator.ts`
- Executor (publishes reason blob + signs tick): `ui/src/lib/launch-sniper/executor.ts`
- Types: `ui/src/lib/launch-sniper/types.ts`
- UI: `ui/src/app/launch-sniper/page.tsx`

## Try it

[demo-agents.theseus.network/launch-sniper](https://demo-agents.theseus.network/launch-sniper). The cron fires every 20 minutes; the page shows the most recent decisions with the full dossier expandable.

## Env vars

The Phase 2 dossier degrades gracefully — if `ETHERSCAN_API_KEY` or `BRAVE_SEARCH_API_KEY` are unset, those fields surface to the LLM as "unknown" and the agent's safe default is PASS. To get the full surface, set both — both have free tiers that comfortably cover the cron's volume.

## On-chain

Ticks are written to [LaunchSniperFund](https://sepolia.basescan.org/address/0xa6FbaadeA4e7f58D812D989737D708B279E8bd21). Every tick — BUY or PASS — counts toward `tickCount()`.

---

_Last updated: June 17, 2026._
