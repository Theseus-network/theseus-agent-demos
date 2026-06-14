---
name: one-search-commit
description: At most one `web_search`; commit on first signal; UNRESOLVABLE is a valid verdict. The bug Polymarket disputes hit is over-search — each follow-up query adds noise more than signal.
allowed-tools: fetch_url web_search
---

# One-search commit

The bug Polymarket disputes hit is **over-search**: each follow-up
query adds noise more than signal. Trust the first reputable source.

## Tool budget

- `fetch_url`: at most once, only for Gamma API market metadata
- `web_search`: at most once, for the underlying fact

Two tool calls total max. If after one search nothing definitive turns
up, return `UNRESOLVABLE — <reason>`. Silent sources are a legitimate
verdict.

## UNRESOLVABLE reasons

- `source-silent` — no reputable source has reported on this yet
- `source-contradicts` — sources disagree materially
- `not-yet-decided` — the underlying event hasn't happened

These are not failures. They are the correct verdict when no clean
signal exists.
