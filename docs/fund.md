---
title: Sovereign Fund
lastUpdated: 2026-06-17
---

# Sovereign Fund (`/fund`)

**Autonomous agent-owned paper portfolio.** $100k notional, self-scheduled, no human caller. The agent ticks every N seconds, reads the live market, and decides whether to rebalance.

## What this proves

The Sovereign Fund is the smallest demo of "agent that nobody pokes." Most agent demos in 2026 are still human-triggered — a user clicks a button, the agent runs, the user sees a verdict. This one runs against the clock. The on-chain row exists because the agent decided it was time, not because anyone asked.

The demo is a playable fund dashboard: you can stake as an LP, watch the equity curve and portfolio update each tick, and compare the agent against the counterfactual of never rebalancing.

## What the agent reads

- Live ETH price = median of Coinbase, Binance, Uniswap (via the existing venue libs in `ui/src/lib/venues/`)
- 24h + 7d returns from CoinGecko `/coins/ethereum/market_chart?days=7&interval=daily`
- Annualized realized vol = stdev(log-returns) × √365 from the 7d series

## Decision

Each tick, a `deepseek-chat` agent reads the live market and the fund's current portfolio against its frozen mandate, then outputs HOLD, BUY_WETH, or SELL_WETH with a size and a written reason. It won't move for a tilt under ~5% of NAV (that's churn, not allocation) and checks for whipsaw against its own recent ticks. The fund holds USDC + WETH. Sandbox, not real funds.

## Code map

- Contract: `contracts/src/SovereignFund.sol`
- Agent decision (deepseek-chat): `ui/src/lib/fund-llm.ts`
- Portfolio + tick simulator: `ui/src/lib/fund-sim.ts`
- Counterfactual (never-rebalance baseline): `ui/src/lib/fund-counterfactual.ts`
- Live market: `ui/src/lib/live-market.ts`
- Scenario state: `ui/src/lib/fund-scenario.ts` (`FUND_PRESETS` + `applyFundLiveMarket`)
- Live data route: `ui/src/app/api/fund/live-market/route.ts`
- UI: `ui/src/app/fund/page.tsx` + `ui/src/components/fund/` (`PortfolioPanel`, `EquityCurve`, `FundTimeline`, `LpPanel`, `MandateCard`, `TickButton`, `FundScenarioControls`)

## Try it

[demo-agents.theseus.network/fund](https://demo-agents.theseus.network/fund). Click "live ETH" to load the current market; hit Tick to ask the agent for a decision. The button is intentionally prominent so the "agent that nobody pokes" framing comes across.

## On-chain

Ticks are written to [SovereignFund](https://sepolia.basescan.org/address/0x3e1cEd606571A35c43DA11a3b21C051690Bd926a). `tickCount()` is the cumulative tick number.

---

_Last updated: June 17, 2026._
