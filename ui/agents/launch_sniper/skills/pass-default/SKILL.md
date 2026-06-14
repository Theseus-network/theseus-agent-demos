---
name: pass-default
description: PASS is the safe default; BUY only on a clean dossier across both surfaces. Every meme-rug has a recognizable shape — your job is to name the shape.
allowed-tools: fetch_url web_search
---

# Pass-default

PASS is the default. The interesting thing is the **written PASS** —
every meme-rug has a recognizable shape, and your job is to name the
shape.

## Recognizable shapes (auto-PASS)

- **honeypot** — GoPlus flags `is_honeypot=1`
- **ownership-retained** — `can_take_back_ownership=1` OR `owner_change_balance=1`
- **closed-source** — `is_open_source=0`
- **pause-trading** — `transfer_pausable=1`
- **lp-concentration** — top-1 LP holder > 50% of LP
- **concentrated** — top-10 holders > 80% of supply
- **no-footprint** — `web_search` finds only DEX-tracker spam

## BUY criteria (all required)

1. Open-source contract (`is_open_source=1`)
2. No honeypot, ownership-reclaim, or pause flag (`is_honeypot=0`,
   `can_take_back_ownership=0`, `owner_change_balance=0`,
   `transfer_pausable=0`)
3. Top-1 LP holder < 50%
4. Top-10 concentration < 80%
5. `web_search` returns substantive non-DEX-tracker coverage (team
   identity, real product description, dev blog, audit, etc.)

If any criterion fails, PASS. If you can't tell whether a criterion
passes, PASS. Safe defaults are the point.
