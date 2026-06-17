---
title: Aviation Safety Reviewer
lastUpdated: 2026-06-17
---

# Aviation Safety Reviewer (`/aviation`)

**Independent second opinion on aircraft type-certification changes.** The agent reads a live FAA Airworthiness Directive and emits FILED or REFUSED with a written critique.

## Failure shape

Boeing 737 MAX MCAS, 2018–2019, 346 deaths. The certification process trusted the manufacturer's framing of the system change. An independent reviewer with access to the underlying engineering memos — and an explicit job description of "find the failure mode the OEM didn't disclose" — would have refused to file.

## What the agent reads

- Live FAA Airworthiness Directives via the Federal Register API (`federalregister.gov/api/v1/documents.json?agencies=federal-aviation-administration&type=RULE`)
- Filtered to titles containing "airworthiness directive"
- Aircraft family extracted from the post-semicolon phrase in the AD title

## Decision

FILED (green) or REFUSED (red). The agent's role is the independent reviewer — its written rationale is the part that matters more than the binary verdict.

## Code map

- Contract: `contracts/src/AviationSafetyReviewer.sol`
- FAA client: `ui/src/lib/faa-feed.ts`
- Scenario state + apply helper: `ui/src/lib/aviation-scenario.ts` (`applyAviationChange`)
- Live data route: `ui/src/app/api/aviation/recent-ads/route.ts`
- UI: `ui/src/app/aviation/page.tsx`

## Try it

[demo-agents.theseus.network/aviation](https://demo-agents.theseus.network/aviation). Expand "or review a live FAA Airworthiness Directive" to load real recent ADs and watch the agent review each.

## On-chain

Reviews are written to [AviationSafetyReviewer](https://sepolia.basescan.org/address/0x453cE65E5D6eBc6C71f3e420e720d2C2E1D03bce). `touchedChangeCount()` increments per AD reviewed.

---

_Last updated: June 17, 2026._
