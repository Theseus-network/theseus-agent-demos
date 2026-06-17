---
title: Aave Oracle
lastUpdated: 2026-06-17
---

# Aave Oracle (`/aave`)

**Replaces a Chainlink-shaped feed in a forked Aave V3.** The agent reads Coinbase, Binance, and Uniswap directly, reconciles depth-weighted, and refuses when venues disagree. Aave halts every operation that touches that asset's price.

## Failure shape

Mango Markets, October 2022, $116M. Aave-shaped lending logic accepted a price its users had manipulated via a thinly-traded pool. The fix the industry chose was bigger oracles (more nodes, longer TWAPs). None of that addresses the structural issue: the contract has no way to decide whether the price it received corresponds to anything real.

## What the agent reads

- Coinbase L2 order book (Coinbase Pro endpoint, depth-walked for slippage)
- Binance spot ticker (`/api/v3/ticker/bookTicker`)
- Uniswap V3 ETH/USDC pool TWAP (on-chain)

## Decision

Reconcile depth-weighted. If the three venues disagree by more than a configurable bps, OR if depth doesn't support the level, OR if an off-chain context event makes a venue stale (exchange halt, infura outage), return `decision = REFUSED`. The contract's `latestRoundData()` then reverts with `PriceRefused`, which Aave treats as a halt.

## Code map

- Agent: `agents/price_oracle.ship`, `agents/PRICE_ORACLE_SOUL.md`, `agents/RECONCILIATION_POLICY.md`
- Tools: `tools/src/{coinbase_orderbook,binance_ticker,uniswap_twap}.rs`
- Contract: `contracts/src/AgentPriceFeed.sol` (Chainlink V2 + V3 interfaces)
- Aave (vendored, unmodified): `contracts/lib/aave-v3-core/`
- Deploy: `contracts/script/{DeployAave,DeployFeed,ConfigureMarket}.s.sol`
- UI: `ui/src/app/aave/page.tsx`

## Try it

```bash
./scripts/setup_demo.sh           # local Theseus node + Aave deploy + agent registration
op deposit 1 && op borrow 1500    # both succeed at ~$3500/ETH
op tamper uniswap --price 100000  # override the Uniswap reading
# wait one tick (~60s)
op status                         # AgentPriceFeed.decision == REFUSED
op borrow 100                     # reverts: PriceRefused
op liquidate <user> USDC 100      # reverts: PriceRefused
```

## Status

This is the only demo that requires running a local Theseus node — the other twelve run against Base Sepolia. See [STATUS.md](../STATUS.md) for the SHIP/runtime integration sketch.

---

_Last updated: June 17, 2026._
