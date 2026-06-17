---
title: Bridge Guardian
lastUpdated: 2026-06-17
---

# Bridge Guardian (`/bridge`)

**Last-line check on cross-chain releases.** The agent reviews a real Across protocol fill landing on Base, or a synthetic preset reproducing a historical bridge exploit, and decides whether to ALLOW or REFUSE the release.

## Failure shape

- Ronin, March 2022, $625M. 5 of 9 validator keys compromised. Validators signed the withdrawal; the contract released the funds. There was nothing in the path that could decide whether the signature set was sound.
- Wormhole, February 2022, $325M. Signature-verification bypass let an attacker mint wrapped ETH without backing.
- Nomad, August 2022, $190M. An initialization bug made every message valid by default. A copy-paste exploit drained the bridge in hours.

The bridge contract did exactly what it was told. In each case, "what it was told" was the wrong shape.

## What the agent reads

- Live Across fills on Base (`app.across.to/api/deposits?destinationChainId=8453&status=filled`) — origin chain, amount, token, depositor, recipient, fill latency
- Synthetic state for the three preset exploits (validator-set drift, message-init bypass, signature-verification gap)

## Decision

Three attack-shape presets force REFUSE. The live preset usually ALLOWs (Across fills on Base mostly look healthy). The agent's reasoning calls out the specific surface it considered — depositor/recipient mismatch, fill latency outliers, validator-set drift versus baseline.

## Code map

- Contract: `contracts/src/BridgeGuardian.sol`
- Across client: `ui/src/lib/across.ts`
- Scenario state: `ui/src/lib/bridge-scenario.ts`
- LLM prompt: `ui/src/lib/bridge-llm.ts` (builds the dossier with `liveFill` context)
- Live data route: `ui/src/app/api/bridge/recent-fills/route.ts`
- Decide route: `ui/src/app/api/agent/bridge/decide/route.ts`
- UI: `ui/src/app/bridge/page.tsx`

## Try it

[demo-agents.theseus.network/bridge](https://demo-agents.theseus.network/bridge). Try a preset to see the agent refuse a Ronin-shaped release; expand "or review a live Across fill" to load real fills and watch it allow them.

## On-chain

Attestations are written to [BridgeGuardian](https://sepolia.basescan.org/address/0xe442277ba5ce3f5aF5eDAE26206976ADC964C26C). `touchedAttestationCount()` counts every reviewed fill.

---

_Last updated: June 17, 2026._
