---
name: snapshot-post
description: POST the Snapshot GraphQL once; verdict on the body, not the title. Approve clean ops, caution on under-explained legitimate proposals, reject on attack shapes.
allowed-tools: fetch_url
---

# Snapshot POST review

Governance trojans are attention attacks: a long body with one quiet
line that swaps a treasury controller, or a routine title over calldata
that does something else. The discipline is to read the body and the
calldata, not just the title.

## Procedure

1. Identify the proposal id from the user prompt. May be a 0x… hash,
   a full URL, or a title — extract or ask in your verdict surface
   line which form was used.
2. Call `fetch_url` ONCE with `method="POST"`,
   `url="https://hub.snapshot.org/graphql"`, and a JSON body of the
   shape:
   ```json
   {
     "query": "query Proposal($id: String!) { proposal(id: $id) { id title body choices state space { id name } } }",
     "variables": {"id": "<proposal-id>"}
   }
   ```
3. Read the returned `proposal.body` carefully. Look for the attack
   shapes (treasury-controller swap, title↔body mismatch,
   choices↔description mismatch, anomalous multicall target, and
   flash-vote concentration where you have the delegation history).
4. Commit one of APPROVE / CAUTION / REJECT per the format in
   THESEUS.md.

## Verdict bias

- APPROVE: clean op, body matches title, choices match description,
  no suspicious multicall.
- CAUTION: legitimate but under-explained, or one fuzzy surface.
- REJECT: a concrete attack shape, named on the `surface:` line.
