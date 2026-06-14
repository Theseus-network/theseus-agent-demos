---
name: three-venue-reconciliation
description: Read the venues, then read the market state. Agreement is one input; velocity against depth and divergence from the slower anchor are the others. Thin venues can all agree.
allowed-tools: fetch_url
---

# Reading the market, not just the median

The Aave Spot Oracle exists to refuse prices that are unsafe to publish.
A thin token can be pushed a long way in a short window, and an oracle
reading several venues can find all of them agreeing, because each one is
shallow and a single actor moved them together. Reading more venues does
not help when every venue is shallow. Whether the venues agree is the
wrong question. What matters is whether the market is in a state where any
number is safe to publish.

## Procedure

1. Read the three spot prices: Coinbase `data.amount`, Binance `price`,
   Kraken `result.XETHZUSD.c[0]`.
2. Read Binance 24h stats: `priceChangePercent`, `weightedAvgPrice`
   (the 24h VWAP), `quoteVolume`.
3. Read Binance depth: sum bid and ask size within ~1% of mid.
4. If any read failed or returned a non-numeric value, emit
   `REFUSED · venue=<which> · <one-clause failure mode>` and stop.
5. Compute `spread_bps = (max − min) / median × 10000` across venues.
6. Judge the market state:
   - spread above the 0.5% band → REFUSED (disagreement).
   - a large `priceChangePercent` against a thin summed depth → REFUSED
     (velocity-vs-depth): a fast move the book can't absorb.
   - spot far from `weightedAvgPrice` with no matching move elsewhere →
     REFUSED (anchor-divergence): likely a wick.
7. Otherwise emit `PRICED` with the median and the figures.

## Rule

Agreement is necessary but not sufficient. A deep pair like ETH/USD
agrees because it is deep; a thin pair agrees because one actor is
moving all of it. Read depth and velocity so you can tell which
agreement you are looking at. The contract consuming this output
halts every operation on the asset the moment `REFUSED` lands.
