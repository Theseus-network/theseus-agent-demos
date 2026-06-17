---
title: Vellum 1492
lastUpdated: 2026-06-17
---

# Vellum 1492 (`/vellum`)

**Agentic NFT — generative literary author.** Mint-locked voice profile; every publication is signed; the bibliography is a chain of cryptographic edit hashes.

## What this proves

The "agentic NFT" framing means the agent's identity is the NFT — the voice profile is hash-bound at deploy time and the on-chain contract stores per-edit commitments. Owning the token means owning the future authorship right. If someone forks the prompt, the chain proves the fork.

## What's on-chain

- Immutable `voiceProfileHash` (bytes32) set in the constructor — keccak256 of the canonical voice profile spec. Preimage in [contracts/deployments/base-sepolia.md](../contracts/deployments/base-sepolia.md).
- Per-edit `PUBLISHED` / `REFUSED` events with `bytes32 reasonHash`.
- `touchedIdCount()` for indexers.

## Voice profile preimage (committed at deploy)

```
rhythmic-density:medium-high
lexical-register:literary+vernacular
obsessions:time,distance,inherited-language
structural-prefs:short-paragraphs,fragments
tonal-register:lucid
closed-lexicon:vibe,literally-nonliteral,weather-opener,question-closer,process-reference
form-distribution:fiction-45,essay-35,fragment-20
```

`keccak256(...)` = `0xe6222a8d8d566b1663ec5074d3ad6b0aa7dd7ac9eb735e0e25bf4355218074cd`

## Code map

- Contract: `contracts/src/VellumAuthor.sol`
- Deploy script: `contracts/script/DeployVellumAuthor.s.sol`
- UI: `ui/src/app/vellum/page.tsx`, `ui/src/components/poa/VellumDemo.tsx`

## Try it

[demo-agents.theseus.network/vellum](https://demo-agents.theseus.network/vellum). Ask the agent for a piece in its voice; each PUBLISHED piece writes a `reasonHash` to chain.

## On-chain

Publications go to [VellumAuthor](https://sepolia.basescan.org/address/0x3C33b1C332F4713570fbF87dB6a816d74Eef8088).

---

_Last updated: June 17, 2026._
