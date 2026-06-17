---
title: Aperture 0312
lastUpdated: 2026-06-17
---

# Aperture 0312 (`/aperture`)

**Agentic NFT — generative visual artist.** Mint-locked palette and composition rules; refusals are signed.

## What this proves

The signed-refusal is the part worth noticing. A generative artist that produces on demand for any commission has nothing to defend. One whose contract hash binds the palette + composition + refusal criteria, and whose REFUSED commissions are written to chain with reasons, has a coherent identity over time.

## What's on-chain

- Immutable `fingerprintHash` (bytes32) — keccak256 of the canonical fingerprint (palette HSL tuples + structural rules + refusal set). Preimage in [contracts/deployments/base-sepolia.md](../contracts/deployments/base-sepolia.md).
- Per-commission `PUBLISHED` / `REFUSED` events with `reasonHash`.

## Fingerprint preimage (committed at deploy)

```
aperture-0312:
  palette HSL: 38,24,86 | 13,51,44 | 222,35,15 | 220,9,35 | 33,65,60 | 25,8,14
  structural: thirds-anchored; no-figural; no-text; density-le-40; matte-no-gradients
```

`keccak256(...)` = `0xaedca7577f5a0373b0145cac98fb2f506f72ad08d0b5babe5dfb5975d006cb08`

## Code map

- Contract: `contracts/src/ApertureArtist.sol`
- Deploy script: `contracts/script/DeployApertureArtist.s.sol`
- UI: `ui/src/app/aperture/page.tsx`, `ui/src/components/poa/ApertureDemo.tsx`

## Try it

[demo-agents.theseus.network/aperture](https://demo-agents.theseus.network/aperture). Submit a commission brief; the agent either generates or signs a refusal explaining which rule the brief violated.

## On-chain

Commissions go to [ApertureArtist](https://sepolia.basescan.org/address/0xA10BAbeE86c1f1838891c549d63c49697620F98A).

---

_Last updated: June 17, 2026._
