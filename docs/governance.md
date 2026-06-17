---
title: Governance Reviewer
lastUpdated: 2026-06-17
---

# Governance Reviewer (`/governance`)

**Reads DAO proposals before voting opens.** The agent pulls a live Arbitrum DAO Snapshot proposal, reads the calldata + the rationale, and emits a verdict (APPROVE / CAUTION / REJECT).

## Failure shape

Most DAO governance attacks aren't social — they're attention. A complex multi-call proposal with one line that quietly upgrades a treasury controller passes because nobody read past the title. A reviewing agent that reads the actual calldata catches that line on the first pass.

## What the agent reads

- Live Arbitrum DAO Snapshot proposals (`hub.snapshot.org/graphql`)
- The proposal's title, body, and calldata
- (Synthetic preset path) a hand-built proposal reproducing a "treasury controller swap" attack shape

## Decision

Traffic-light: APPROVE (green), CAUTION (amber), REJECT (red). The verdict block is intentionally large and color-bold so a reviewer scanning ten proposals can triage in seconds.

## Code map

- Contract: `contracts/src/GovernanceReviewer.sol`
- Snapshot client: `ui/src/lib/snapshot.ts`
- Scenario state: `ui/src/lib/governance-scenario.ts`
- LLM prompt: `ui/src/lib/governance-llm.ts`
- UI: `ui/src/app/governance/page.tsx`

## Try it

[demo-agents.theseus.network/governance](https://demo-agents.theseus.network/governance). The page loads a live recent Arbitrum proposal by default; switch presets to see the agent reject a known-bad shape.

## On-chain

Proposals reviewed are written to [GovernanceReviewer](https://sepolia.basescan.org/address/0xc9CCF578093603e419997358fa9646Bd891B018a). `touchedProposalCount()` increments per proposal reviewed.

---

_Last updated: June 17, 2026._
