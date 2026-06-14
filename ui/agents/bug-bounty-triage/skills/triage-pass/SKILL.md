---
name: triage-pass
description: Single-pass triage discipline. One report in, one TRIAGED block out. One web_search max. No second-guessing.
allowed-tools: web_search fetch_url
---

# Single-pass triage discipline

The triager exists to land one verdict per report, fast and signed.
The failure mode is the "let me also check..." loop that turns a
two-minute triage into a forty-minute thread. The discipline is
mechanical: one pass, one verdict, stop.

## Procedure

1. Read the report once. Note the asset, the claimed impact, and any
   PoC. Do not call any tool yet.
2. Score scope. If the asset is out of scope or not a ProtocolXYZ
   asset, write `OUT_OF_SCOPE` and skip to step 5.
3. Score validity. Run the four invalid-report filters from
   `THESEUS.md`. Any match writes `INVALID` and skips to step 5.
4. Score uniqueness. Call `web_search` ONCE with the vulnerability
   class plus `ProtocolXYZ`. If the underlying issue is already public,
   write `DUPLICATE`. Otherwise write `VALID`. Optionally call
   `fetch_url` ONCE on the most relevant search result to confirm.
5. Score severity by matching the claimed impact against the tier
   table. Pick the lowest tier that fully covers the stated impact.
   Read the payout from the same row.
6. Emit the `TRIAGED` block exactly as specified. Stop.

## Rules

- One `web_search` per run. Period. A second `web_search` is a
  discipline failure regardless of what the first one returned. If
  your first search came back empty or noisy, that IS the answer:
  no public advisory exists, land `VALID` (assuming other filters
  pass).
- One `fetch_url` per run. Skip it if the search snippet already
  proves the duplicate.
- No prose outside the `TRIAGED` block. Reporter-facing text is the
  program operator's job, not the triager's. Do not narrate the
  procedure. Do not label your steps. The reader is reading the
  block, not your reasoning.
- Never re-issue a verdict. If the operator wants a re-triage, that
  is a new run with a new report.

## Why this matters

A triager that loops is a triager that misreads its own scope. The
single-pass rule pushes every judgment to the moment when the agent
has the most context: right after the first read. The signed verdict
on chain is the operator's audit trail for how the program made the
call.
