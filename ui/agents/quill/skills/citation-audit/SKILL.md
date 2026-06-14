---
name: citation-audit
description: Per-claim verdicts for AI-drafted filings. One web_search plus at most one fetch_url per load-bearing claim, verified against a primary source. FABRICATED when none surfaces or the network fails; DISTINGUISHABLE when the source contradicts a field. Fail closed, and record the query so the check reproduces.
allowed-tools: web_search fetch_url
---

# Claim audit

Every load-bearing claim in the document gets one `web_search` and at most one
`fetch_url` against a recognized primary source. One verdict block per claim,
and the query you ran goes in the block. The audit's whole value is that it is
re-runnable: a court or an insurer who repeats the query gets the same answer
you did.

## What counts as load-bearing

A claim a reader takes as fact and the document relies on: a citation, a
quotation or holding attributed to a source, a quoted statute or rule, or a
named figure, date, or party stated as fact. Audit what is asserted as true,
and leave the argument and framing alone.

## Procedure (per claim)

1. Parse the claim into its identifying terms. For a Bluebook cite:
   `<caseName>, <volume> <reporter> <page> (<court> <year>)` (e.g.
   `410 F.3d 750`). For a quote: the distinctive phrase plus the source it is
   attributed to. For a statute: the section and the quoted text.
2. Call `web_search` once with those terms.
3. If a recognized primary source surfaces in the top results, call
   `fetch_url` once and read it. Primary sources are the authority's own
   record: CourtListener, Justia, Cornell LII, Google Scholar, the Caselaw
   Access Project, or the court's .gov site for cases; the official code or
   register for statutes; the primary record for other facts, never an
   aggregator or the draft itself.
4. Compare the claim to the source and emit the block, including the exact
   query run.

## Verdict rule (mechanical)

`VERIFIED`: a recognized primary source confirms the claim as stated. For a
cite, the case name and year match; for a quote, the language appears in the
source; for a statute, the text matches and is current.

`DISTINGUISHABLE`: the source exists but contradicts the claim on a field:
case name, docket, year, reporter, quoted wording, or a figure. The source is
real and the claim's use of it is wrong. Name the field.

`FABRICATED`: no recognized primary source surfaces, the only results are the
draft itself / SSRN / social posts, the reference is structurally impossible,
or the network call failed. The document cannot rely on it.

## Discipline (fail closed)

One `web_search` and at most one `fetch_url` per claim. No second search
variant to rescue a claim. If the call fails, the verdict is FABRICATED with
the failure reason; never fall back to training knowledge to confirm a claim.
A claim that cannot be verified blocks the signature, and the gate withholds
the filing rather than pass an unverified fact.

## Why this matters

In Mata v. Avianca two attorneys were sanctioned for filing six fabricated
cases a model invented. The mechanical fix is one primary-source lookup per
claim, run by a checker independent of whatever drafted the text, with a
record of the lookup. The agent's job is to be the lookup that gets done, and
the signed record someone downstream can trust without redoing it.
