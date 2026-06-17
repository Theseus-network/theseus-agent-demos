---
title: Polymarket Adjudicator
lastUpdated: 2026-06-17
---

# Polymarket Adjudicator (`/adjudicate`)

**Resolves prediction markets from the primary record, not a token vote.** The agent reads a market's question and rules, runs live web search for evidence, and commits a verdict only when the record clears an 80% confidence bar. Below that, it returns UNRESOLVABLE instead of guessing.

## Failure shape

UMA-style optimistic oracles resolve disputed markets by token vote, so whoever holds the most tokens can move the answer. In 2025–2026 this settled several large markets on the wrong outcome: a $7M Ukraine minerals market a whale forced to YES on a deal that was never signed by the deadline; a Strategy bitcoin-sale market a few large holders swung to NO despite an 8-K confirming the sale closed inside the window; a ~$237M market on whether Zelenskyy wore a suit that UMA finalized on a no-consensus reading. A resolver that reads the primary record returns what the record supports, and no token balance can vote it down.

## What the agent reads

- A curated market (question, options, verbatim Polymarket resolution rules, deadline) or a live Polymarket market via the Gamma API
- Whatever it finds through live web search, prioritizing primary sources (filings, official statements, the publication of record)

## Decision

Claude Sonnet 4.6 with web search. It walks the rules in order: check the deadline (a market whose deadline hasn't passed is UNRESOLVABLE, "not-yet-decided"); match the criterion literally; weigh source quality. Then it returns one of:

- **RESOLVED** (YES or NO) with a winning option, but only at **≥80 confidence** — the criterion is clearly met or clearly not met and the primary record settles it.
- **UNRESOLVABLE** when the record is silent ("source-silent"), credible sources genuinely contradict each other or the criterion is too subjective to settle ("source-contradicts"), or the deadline hasn't passed ("not-yet-decided").

The 80 bar is enforced in both the system prompt and post-processing: a sub-80 RESOLVED is downgraded to UNRESOLVABLE, so "resolved" always means the record genuinely settled it. Every verdict ships with an evidence summary and the source URLs it consulted.

## On chain

The agent is deployed sovereign on the Theseus alpha testnet: it holds its own keys and publishes its verbatim system prompt on chain, so anyone can read the exact rules it judges by. Profile: [explorer.theseus.network/agents/5DCSpFkH…](https://explorer.theseus.network/agents/5DCSpFkHzKd6G9LZ5ytjKLyPiUMYrofxpkEjuhNXTreRDfwq). There is no second settlement chain; the verdict streams to the client and the agent's identity lives on Theseus.

## Code map

- LLM call + verdict logic: `ui/src/lib/adjudicator-llm.ts`
- Curated markets (verbatim Polymarket rules): `ui/src/lib/adjudicator-markets.ts`
- Live Polymarket client: `ui/src/lib/polymarket.ts`
- API route (SSE streaming): `ui/src/app/api/agent/adjudicate/route.ts`
- UI: `ui/src/app/adjudicate/page.tsx`

## Try it

[demo-agents.theseus.network/adjudicate](https://demo-agents.theseus.network/adjudicate). Pick one of the three real UMA disputes or load a live Polymarket market; the agent streams its search and reasoning, then leads with the verdict and confidence.

---

_Last updated: June 17, 2026._
