---
name: attack-shapes
description: Bridge-release pattern recognition. Each shape is tied to a measurable signal, not vibes. One fetch, one verdict.
allowed-tools: fetch_url
---

# Attack shapes

Four release shapes define the pattern matches. Each is bound to a
specific measurable signal so the refusal carries an operator-defensible
reason. The shape label is what you output; the operator's audit table
maps it to the matching precedent.

## Replay

Withdrawal proofs can be replayable: a verifier checks Merkle
validity but not whether the withdrawal hash has already been
processed, so the same proof drains the vault N times.

**Signal**: the withdrawal hash is in the prior-release log already.
**Shape**: `replay`.

## Validator quorum drop

Validator-key compromise: validators sign the withdrawal and the
contract releases the funds, and nothing in the verification path can
decide whether the signing set was sound.

**Signal**: >1/3 of the active validator set rotated in the trailing
24h without an announced key rotation. Or the signing set on this
release doesn't match any prior release's signing set with any
overlap. Either is anomalous.
**Shape**: `validator-quorum-drop`.

## Impossible fill

Signature-verification bypass: a crafted input passes validation
without actually proving the origin lock event.

**Signal**: `fillDeadline − quoteTimestamp < 6 seconds` on a
release. Base block time is 2s. An origin-side lock event needs at
least 3 blocks of finality. Sub-6s end-to-end means proof verification
was skipped or short-circuited.
**Shape**: `impossible-fill`.

## Proof verifier init

Init-bug: the verifier is initialized with `0x0` as the trusted
root, so every message verified against `0x0` is accepted. A single
message works, then the same calldata is copied with a different
address swapped in.

**Signal**: the verifier's stored root is `0x0`, OR the message
batch contains the same source-root as the prior batch with no
inclusion proof advancement.
**Shape**: `proof-verifier-init`.

## Discipline

One `fetch_url` per run. The Across response or the user-provided
dossier IS the surface. If a signal isn't checkable from what's in
front of you, name that limitation in the refusal text and bias to
`REFUSE`. The cost of a wrong `ALLOW` is the entire vault.
