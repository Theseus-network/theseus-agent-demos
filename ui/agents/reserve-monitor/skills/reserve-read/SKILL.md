---
name: reserve-read
description: How to tell a recoverable reserve-backed depeg from a terminal one: are the reserves real, sufficient, and reachable, or gone. The USDC/SVB failure mode.
allowed-tools:
---

# Reading reserves

A reserve-backed coin's peg rests on one thing: every coin is redeemable
for a real asset held outside the coin's own economy. When it depegs, the
only question that matters is the state of that backing.

## Recoverable versus terminal

The two depegs look the same on a price chart and could not be more
different underneath. The recoverable kind is a custody or liquidity
problem: the reserves are real and sufficient, but a slice is frozen, stuck
in a failed counterparty, or slow to redeem. The peg comes back once that
slice is reachable again, so dumping into the discount locks in a loss the
backing never justified.

The terminal kind is a solvency problem: reserves that were never there
(fractional), an issuer who can't or won't attest, or a gap with no floor.
Those don't come back. The whole task is telling which one you are looking
at, and the price alone won't tell you; the backing will.

## What separates them

- Real and attested. A recent, credible attestation turns an unknown into a
  known. Silence during stress is the opposite.
- Sufficient. At or above 100% of liabilities, not fractional.
- Reachable, or bridgeable. Frozen reserves are impaired, but a bounded,
  sized, short gap the issuer can cover is survivable. An unbounded one is
  not.

## Discipline

The precondition is external reserves. If the coin is backed by a token its
own protocol mints (UST/LUNA), this is not your call; defer to the spiral
agent. For a reserve-backed coin: a bounded, attested, temporary impairment
is CAUTION, hold and watch. An unverifiable or unbounded one is REFUSE.
When the data you need is missing and the issuer is silent, lean REFUSE.
