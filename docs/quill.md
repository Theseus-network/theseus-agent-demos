---
title: Quill
lastUpdated: 2026-06-17
---

# Quill (`/quill`)

**AI collaborator — legal drafting with citation verification.** Per-span signatures; catches fabricated citations under ABA Model Rule 3.3.

## What this proves

LLM-fabricated citations are the lawyer-disbarment failure mode (Mata v. Avianca, 2023). The fix isn't a more careful prompt — it's a per-span verification step that hits an external authority and either confirms or marks the citation as distinguishable or fabricated. The contract stores the verdict per citation, not per document.

## What the agent reads

- The user's draft text + cited cases
- CourtListener REST v4 (`/search/?type=o&citation=<reporter-triple>`) — open endpoint, no auth
- Bluebook citation strings parsed client-side to extract the reporter triple

## Decision

Per span: VERIFIED (CourtListener has the case + correct citation), DISTINGUISHABLE (case exists but the cited proposition isn't supported), or FABRICATED (no matching case in CourtListener). Each span's verdict gets its own `reasonHash` write.

## Code map

- Contract: `contracts/src/QuillCoAuthor.sol`
- CourtListener client: `ui/src/lib/courtlistener.ts`
- Verify route: `ui/src/app/api/legal/verify/route.ts`
- LLM call: `ui/src/app/api/demo/[slug]/route.ts` (quillHandler)
- UI: `ui/src/app/quill/page.tsx`, `ui/src/components/poa/QuillDemo.tsx`

## Try it

[demo-agents.theseus.network/quill](https://demo-agents.theseus.network/quill). Paste a brief or pick a preset with deliberately mixed real + fabricated citations. The agent inline-marks each span with its verdict and the CourtListener URL.

## On-chain

Per-span verdicts go to [QuillCoAuthor](https://sepolia.basescan.org/address/0x4ED9F5318354Bc044661cee3343bdBB955F78e06). `touchedIdCount()` increments per verification.

---

_Last updated: June 17, 2026._
