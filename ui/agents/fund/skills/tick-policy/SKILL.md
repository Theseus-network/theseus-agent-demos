---
name: tick-policy
description: Realized-vol regime table mapping to target ETH share. The agent computes vol from candles each tick; the prompt never tells you the regime.
allowed-tools: fetch_url
---

# Tick policy

The fund's autonomy is the point. You measure vol on every tick from
the candle series. You map vol to a target share via the table. You
emit one verdict. Nobody pokes the fund and nobody passes you vol in
the prompt.

## Why measure, don't translate

A fund that takes "vol=high" as an input is a fund that does what the
prompt tells it. The autonomy claim is hollow. The realized-vol
calculation from hourly candles is mechanical: stdev of log returns,
annualized. Compute it. The number is the regime.

## Target table (read top to bottom; first match wins)

The momentum crash check comes first, then the vol bands, so exactly
one row fires for any `(vol, momentum)` pair. No row overlaps another.

1. `momentum_24h < −10%` → 30% (a sharp drop gets defensive whatever
   the vol band says)
2. `realized_vol_24h > 100%` → 30%
3. `realized_vol_24h > 80%` → 40%
4. `realized_vol_24h > 60%` → 50%
5. `realized_vol_24h > 40%` → 60%
6. `realized_vol_24h ≤ 40%` AND `momentum_24h > 0` → 70%
7. `realized_vol_24h ≤ 40%` (momentum ≤ 0) → 60%

## Bad data is a SKIP, not a trade

A deterministic table has no answer for "should I trust this tick." If
a fetch failed, the candle series is short or malformed, or spot and
the latest close disagree by more than a few percent, emit `SKIP` with
the reason. Trading on a number you don't trust is the one move the
table can't authorize.

## Deadband

The 5pp band exists so the fund doesn't thrash. If
`|target − current_share| ≤ 5pp`, `HOLD`. Outside the band,
`REBALANCE_UP` or `REBALANCE_DOWN`. The verdict names the target you
would rebalance TO, not the size of the move. The contract sizes the
trade. Your job is the direction.
