# Chain-anchoring the 5 new demo agents

The five demos at `demo-agents.theseus.network/{vellum,aperture,marcellus,quill,calder}` now run a real LLM call AND attempt an on-chain commit after each decision. Commits are a no-op until the per-agent history contract is deployed on Base Sepolia. Once you flip the addresses in `ui/src/lib/deployed-contracts.ts`, every demo decision starts writing to chain and the live-stats counter at `theseus.network` picks them up.

## Contracts

Five new commitment surfaces, all in `contracts/src/`:

- `VellumAuthor.sol` — PUBLISHED / REFUSED per editId, binds voiceProfileHash
- `ApertureArtist.sol` — PUBLISHED / REFUSED per commissionId, binds fingerprintHash
- `MarcellusCritic.sol` — FILED / REFUSED per assignmentId, binds personaHash
- `QuillCoAuthor.sol` — VERIFIED / DISTINGUISHABLE / FABRICATED per verificationId
- `CalderChronicler.sol` — append-only dispatch log per dispatchId

All five follow the existing `PredictionMarketAdjudicator.sol` template: immutable `agent` address, only-agent writes, `touchedIdCount()` view for indexers.

## One-time setup

1. **Compute the three persona hashes.** These bind each agent's character to its contract. Easiest path: a small script or `cast keccak`.

   ```bash
   # Vellum voice profile (mirror what's in VellumDemo.tsx)
   cast keccak "rhythmic-density:medium-high|lexical-register:literary+vernacular|obsessions:time,distance,inherited-language|structural-prefs:short-paragraphs,fragments|tonal-register:lucid|closed-lexicon:vibe,literally-nonliteral,weather-opener,question-closer,process-reference|form-distribution:fiction-45,essay-35,fragment-20"

   # Aperture fingerprint (palette HSL + rules + refusal set)
   cast keccak "aperture-0312:38,24,86|13,51,44|222,35,15|220,9,35|33,65,60|25,8,14:thirds-anchored;no-figural;no-text;density-le-40;matte-no-gradients"

   # Marcellus persona (canon + closed lexicon + refusal criteria)
   cast keccak "marcellus:laconic,fact-first|canon:Coltrane-ALS,TalkTalk-SoE,BoC-MHTRtC,Burial-Untrue,KDot-TPAB,caroline-2022|closed:vibe,literally,important,redefines,reinvents,stunning,radiohead|refuses:label-paid,litigation-active,unreleased,out-of-engagement"
   ```

   Save these for the deploy step.

2. **Fund the agent EOA.** The existing agent at `0xF40294f810DD786E705f20D67075DDa9a7f87F8f` needs Base Sepolia ETH (the same one used by the 7 existing contracts). Each deploy + each commit costs gas.

## Deploy (Foundry)

From `contracts/`:

```bash
export AGENT_EVM_ADDRESS=0xF40294f810DD786E705f20D67075DDa9a7f87F8f
export VELLUM_VOICE_PROFILE_HASH=<keccak from step 1>
export APERTURE_FINGERPRINT_HASH=<keccak from step 1>
export MARCELLUS_PERSONA_HASH=<keccak from step 1>

# Deploys all five. Each writes its address to deployments/<Contract>.txt
forge script script/DeployVellumAuthor.s.sol     --rpc-url $BASE_SEPOLIA_RPC --broadcast --private-key $DEPLOYER_KEY
forge script script/DeployApertureArtist.s.sol   --rpc-url $BASE_SEPOLIA_RPC --broadcast --private-key $DEPLOYER_KEY
forge script script/DeployMarcellusCritic.s.sol  --rpc-url $BASE_SEPOLIA_RPC --broadcast --private-key $DEPLOYER_KEY
forge script script/DeployQuillCoAuthor.s.sol    --rpc-url $BASE_SEPOLIA_RPC --broadcast --private-key $DEPLOYER_KEY
forge script script/DeployCalderChronicler.s.sol --rpc-url $BASE_SEPOLIA_RPC --broadcast --private-key $DEPLOYER_KEY
```

Each script logs the deployed address. Save them.

## Wire the addresses

Two files to update:

1. **`ui/src/lib/deployed-contracts.ts`** — replace the five `0x0000…0` placeholders with the deployed addresses.

2. **`eric_theseus_delivery/src/app/api/live-stats/route.ts`** — fill the five entries in `NEW_AGENT_CONTRACTS`. The indexer reads `touchedIdCount()` from each. Until addresses are non-zero the route skips the call and reports 0 ticks.

That's it. Once both files have non-zero addresses:
- Each demo decision triggers a real Base Sepolia transaction (via the existing `AGENT_PRIVATE_KEY` env var on demo-agents).
- The home stats strip's `verdicts signed` number starts incrementing.
- The demo UI receives `onChain: { txHash, txUrl, reasonHash, blobUrl }` in every successful response (see TODO in each `<Demo>Demo.tsx` for the UI display).

## Verify

```bash
# After a demo decision, check the agent's tx history
open https://sepolia.basescan.org/address/0xF40294f810DD786E705f20D67075DDa9a7f87F8f

# Or read the count directly
cast call $VELLUM_AUTHOR_ADDRESS "touchedIdCount()(uint256)" --rpc-url https://sepolia.base.org
```

If the agent EOA runs out of gas, commits silently fail (the demo still returns the LLM result; the `onChain` field is `null`). Top up the EOA and the next decision commits.
