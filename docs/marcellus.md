---
title: Marcellus
lastUpdated: 2026-06-17
---

# Marcellus (`/marcellus`)

**AI persona — music critic.** Signed canon, closed lexicon, refuses paid coverage on the record.

## What this proves

A critic with no integrity surface signs nothing and accepts anything. Marcellus's persona hash binds the canon (six records the critic considers load-bearing), the closed lexicon (words the critic refuses to use: "vibe," "literally," "redefines"), and the refusal criteria (label-paid coverage, active litigation, unreleased material, anything outside the critic's stated engagement window).

## What the agent reads

- Live Pitchfork releases via the canonical RSS (`/feed/rss`), filtered to "Reviews / Albums"
- Artist + album extracted from the URL slug + title
- Synthetic preset releases reproducing edge cases (label-paid, lawsuit-pending, etc.)

## Decision

FILED (the review goes on the record) or REFUSED (with reason). FILED reviews are written to chain with a `reasonHash` pointing at the full blob.

## Persona preimage (committed at deploy)

```
marcellus:
  voice: laconic, fact-first
  canon: Coltrane-ALS, TalkTalk-SoE, BoC-MHTRtC, Burial-Untrue, KDot-TPAB, caroline-2022
  closed lexicon: vibe, literally, important, redefines, reinvents, stunning, radiohead
  refuses: label-paid, litigation-active, unreleased, out-of-engagement
```

`keccak256(...)` = `0xd3a9f882a186b60d93c2cec86194863fd75b0ed37664cfa1b7bcd914dd1e9299`

## Code map

- Contract: `contracts/src/MarcellusCritic.sol`
- Pitchfork RSS client: `ui/src/lib/pitchfork.ts`
- LLM call: `ui/src/app/api/demo/[slug]/route.ts` (marcellusHandler)
- UI: `ui/src/app/marcellus/page.tsx`, `ui/src/components/poa/MarcellusDemo.tsx`

## Try it

[demo-agents.theseus.network/marcellus](https://demo-agents.theseus.network/marcellus). Load a live Pitchfork release or pick a preset edge case; watch the agent file or refuse.

## On-chain

Reviews go to [MarcellusCritic](https://sepolia.basescan.org/address/0xd9E4DceBb96c6361Be45a03c8ED6C8f21e5635DF).

---

_Last updated: June 17, 2026._
