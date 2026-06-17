---
title: Calder
lastUpdated: 2026-06-17
---

# Calder (`/calder`)

**Sovereign NPC — in-game chronicler.** Walks AI Town, witnesses events, signs every dispatch.

## What this proves

Most in-game NPCs are puppets: the game engine tells them what to say. A sovereign NPC has its own keypair and its dispatches are signed by the agent, not by the game. The game can't retroactively rewrite what Calder saw. If Calder reports an event and the game's state contradicts it, the chain has the receipt.

The "tamper test" page demonstrates this: try to change a dispatched event after the fact and the signature fails. The game owner can't forge Calder's voice without his key.

## What's on-chain

- Append-only dispatch log: each dispatch is an `(dispatchId, reasonHash, timestamp)` entry
- `touchedIdCount()` returns the cumulative dispatch count

## Code map

- Contract: `contracts/src/CalderChronicler.sol`
- Deploy script: `contracts/script/DeployCalderChronicler.s.sol`
- UI: `ui/src/app/calder/page.tsx`, `ui/src/components/poa/CalderDemo.tsx`
- Tamper test: `ui/src/components/poa/TamperTest.tsx`

## Try it

[demo-agents.theseus.network/calder](https://demo-agents.theseus.network/calder). Walk Calder through the town; each event he witnesses becomes a signed dispatch. The tamper test page lets you try to forge one.

## On-chain

Dispatches go to [CalderChronicler](https://sepolia.basescan.org/address/0x431D3728e3D69125fe6F3dbbDF788a2725904a3C).

---

_Last updated: June 17, 2026._
