---
name: spiral-read
description: How to spot a reflexive stablecoin entering its death spiral: backing-token supply inflating into a falling price while redemptions accelerate. The Terra/LUNA failure mode.
allowed-tools:
---

# Reading the spiral

A reflexive stablecoin is backed by a token its own protocol mints to
defend the peg. The question is not whether it is below $1. It is whether
the mint-to-defend loop has started, because once it has, the backing
destroys itself.

## The loop

UST was backed by LUNA. The protocol let anyone burn $1 of LUNA for $1 of
UST and redeem $1 of UST for $1 of LUNA at oracle price. That arbitrage is
fine while confidence holds. When it broke:

- holders redeemed UST, which minted fresh LUNA
- the new LUNA supply sank the LUNA price
- a lower LUNA price meant the next redemption minted even more LUNA
- repeat until the backing token is worth nothing

The signature is unmistakable once you know to look: the backing token's
price falling while its supply climbs, redemptions accelerating, and the
hardest sign of all, the backing token's market cap dropping below the
coin's outstanding supply. Once the backing is worth less than the debt,
nothing you allow recovers.

## What turning looks like

Read the four signals together, not any one alone:

- the backing token's price falling while its supply climbs, the
  mint-to-defend loop feeding itself
- redemptions accelerating rather than holding steady or easing
- coverage crossing below 1: the backing token's market cap dropping under
  the coin's outstanding supply, so the backing is worth less than the debt
- the peg setting lower lows across snapshots rather than stabilizing

A dormant loop has a slipping peg but a backing token still near its normal
price and supply, with coverage well above 1. A turning loop has the backing
token inflating into a falling price with coverage at or under 1.

## The same shape elsewhere

The sister-token loop is the sharpest case, but the pattern is general: the
backing loses value exactly as it is drawn down, and the drawdown feeds
itself. Watch for it wherever collateral can decouple from what it realizes.
A liquid-staking or restaking token below its redeemable value, with a
growing withdrawal queue and a thinning exit bid, is the same read. A looped
position where each liquidation moves the price into the next one is the same
read. The signals do not change: realizable backing against the debt, the
exit trajectory, and whether the move is feeding itself.

## Discipline

The precondition is reflexivity. If the backing is external (reserves the
rest of the market values on their own), this is not your call; defer to a
reserve monitor. If the backing is reflexive and the loop is turning,
REFUSE on the first read. Don't wait for one more data point; an
accelerating run against a self-minting backer only resolves one way.
