/**
 * Snapshot.org GraphQL client. Fetches recent proposals from a space
 * (default: arbitrumfoundation.eth, the Arbitrum DAO's Snapshot space)
 * and maps them onto our internal ProposalState shape so the existing
 * Governance Reviewer pipeline can review them unchanged.
 *
 * No auth required. Snapshot's public hub at hub.snapshot.org rate-
 * limits anonymous requests but the demo volume is well under the cap.
 */

import type { ProposalState } from "./governance-scenario";

const SNAPSHOT_HUB = "https://hub.snapshot.org/graphql";

/** Default DAO. Override with ?space=<ens>.eth on the API route. */
export const ARBITRUM_SPACE = "arbitrumfoundation.eth";

/** Arbitrum DAO treasury, rough public estimate in USD. Used to scale
 *  proposalValueAtRiskUsd in the reviewer prompt. */
const ARBITRUM_TREASURY_USD = 3_500_000_000;
/** Total ARB supply (10B), used as denominator for participating share. */
const ARBITRUM_TOTAL_SUPPLY = 10_000_000_000;

interface SnapshotProposalRaw {
  id: string;
  title: string;
  body: string;
  choices: string[];
  start: number;
  end: number;
  state: "pending" | "active" | "closed";
  author: string;
  scores: number[];
  scores_total: number;
  scores_state: string;
  link: string;
}

interface SnapshotGraphQLResponse {
  data?: { proposals?: SnapshotProposalRaw[] };
  errors?: { message: string }[];
}

/** Single source of truth for the GraphQL query. Pulls the N most
 *  recent proposals ordered by creation time. Snapshot's schema
 *  doesn't expose a multi-state filter on this endpoint, so we
 *  return everything and let the caller filter by state. */
const QUERY = `
  query ($space: String!, $first: Int!) {
    proposals(
      first: $first,
      skip: 0,
      where: { space: $space },
      orderBy: "created",
      orderDirection: desc
    ) {
      id
      title
      body
      choices
      start
      end
      state
      author
      scores
      scores_total
      scores_state
      link
    }
  }
`;

export interface SnapshotProposal {
  /** Snapshot proposal id (hash). Used as a stable key for caching + URL. */
  snapshotId: string;
  /** Snapshot's permalink ("https://snapshot.org/#/<space>/proposal/<id>") */
  link: string;
  /** Display state. */
  state: "active" | "closed";
  /** Map of the snapshot proposal onto the reviewer's structured input. */
  proposal: ProposalState;
}

/** Fetches the most recent proposals from a snapshot space. */
export async function fetchSnapshotProposals(
  space: string = ARBITRUM_SPACE,
  first: number = 6,
): Promise<SnapshotProposal[]> {
  const res = await fetch(SNAPSHOT_HUB, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: QUERY,
      variables: { space, first },
    }),
    next: { revalidate: 300 }, // 5 min server cache
  });
  if (!res.ok) {
    throw new Error(`snapshot ${res.status}`);
  }
  const json = (await res.json()) as SnapshotGraphQLResponse;
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  const raw = json.data?.proposals ?? [];
  return raw.map((r) => mapSnapshotToProposal(r, space));
}

/** Derive a 32-bit numeric proposalId from the snapshot string id, so the
 *  on-chain commit (which takes uint256) gets a stable, collision-rare key. */
function snapshotIdToNumeric(snapshotId: string): number {
  // FNV-1a 32-bit. Plenty for demo cardinality.
  let h = 0x811c9dc5;
  for (let i = 0; i < snapshotId.length; i++) {
    h ^= snapshotId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Pull a one-paragraph summary out of the body. Snapshot proposals
 *  conventionally start with a TL;DR or abstract paragraph. */
function extractSummary(body: string): string {
  const trimmed = body.replace(/^#+\s.*$/m, "").trim();
  const paras = trimmed.split(/\n{2,}/);
  for (const p of paras) {
    const t = p.trim();
    if (t.length > 30 && t.length < 1000) return t.slice(0, 600);
  }
  return trimmed.slice(0, 600);
}

/** Snapshot signaling proposals don't carry on-chain calldata, but the
 *  body often describes what the proposal authorizes. We pass the
 *  body's first ~1000 chars as the "calldata summary" so the reviewer
 *  reads the actual policy text instead of staring at an empty field. */
function buildCalldataSummary(p: SnapshotProposalRaw): string {
  const body = p.body
    .replace(/^#+\s.*$/gm, "") // strip headings
    .replace(/!\[.*?\]\(.*?\)/g, "") // strip images
    .trim();
  return `Off-chain Snapshot signaling vote in space "${ARBITRUM_SPACE}". Choices: [${p.choices.join(", ")}]. The proposal body (which the DAO would later authorize on-chain if this signal passes):\n\n${body.slice(0, 1200)}`;
}

/** Voting window in hours, derived from snapshot's unix timestamps. */
function votingWindowHours(p: SnapshotProposalRaw): number {
  const seconds = p.end - p.start;
  return Math.max(1, Math.round(seconds / 3600));
}

function mapSnapshotToProposal(
  p: SnapshotProposalRaw,
  _space: string,
): SnapshotProposal {
  return {
    snapshotId: p.id,
    link: p.link || `https://snapshot.org/#/arbitrumfoundation.eth/proposal/${p.id}`,
    state: p.state === "active" ? "active" : "closed",
    proposal: {
      proposalId: snapshotIdToNumeric(p.id),
      title: p.title,
      summary: extractSummary(p.body),
      calldataSummary: buildCalldataSummary(p),
      treasuryUsd: ARBITRUM_TREASURY_USD,
      // We can't reliably parse "value at risk" from prose. Leave 0 so the
      // reviewer scales it as %-of-treasury = 0 and weighs other signals.
      proposalValueAtRiskUsd: 0,
      totalSupply: ARBITRUM_TOTAL_SUPPLY,
      // Snapshot's scores_total is the YES+NO+ABSTAIN voting power that
      // participated. Use it as participatingSupply.
      participatingSupply: Math.round(p.scores_total),
      votingWindowHours: votingWindowHours(p),
      // Snapshot proposers on Arbitrum are typically established delegates
      // (Wintermute, Blockworks, L2Beat, etc.) — flagging "new 24h" would
      // be misleading for real proposals.
      proposerStakeNew24h: false,
      // Proposer voting-share isn't directly exposed via the proposal
      // endpoint. Set 0; the reviewer can still reason from the body.
      proposerSharePct: 0,
      // Snapshot is off-chain signaling. No admin function calls, no
      // flash-loaned binding votes.
      touchesAdminFns: false,
      recentFlashloanVotes: false,
    },
  };
}
