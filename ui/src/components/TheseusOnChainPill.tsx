"use client";

/**
 * Status pill showing whether the demo has a real on-chain Theseus
 * agent deployed.
 *
 * - **Configured**: the demo's `NEXT_PUBLIC_THESEUS_AGENT_<slug>`
 *   env var is set to a deployed SS58. Renders a link to the chain
 *   explorer + the truncated SS58.
 * - **Pending**: env var unset (the default state until the public
 *   Theseus chain is up). Renders "Real Theseus agent — coming soon"
 *   with a tooltip naming the env var so deployers know what to set.
 *
 * Doesn't change the demo's behavior — the centralized
 * `/api/demo/<slug>` flow still drives the visible UX. This is a
 * truth-in-advertising surface: visitors see the demo IS centralized
 * today, and will be replaced by a real on-chain run once the
 * Theseus deployment lands.
 */

import { getOnChainStatus, type DemoSlug } from "@/lib/theseus-onchain";

interface Props {
  slug: DemoSlug;
  /** Optional class additions for layout. */
  className?: string;
}

function truncateSs58(ss58: string): string {
  if (ss58.length <= 14) return ss58;
  return `${ss58.slice(0, 8)}…${ss58.slice(-4)}`;
}

export function TheseusOnChainPill({ slug, className }: Props) {
  const status = getOnChainStatus(slug);

  const baseClass =
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium leading-none";

  if (!status.configured) {
    return (
      <span
        title={`Set ${status.envVar} to the deployed agent's SS58 to enable.`}
        className={`${baseClass} border-amber-300/40 bg-amber-300/[0.06] text-amber-200 ${className ?? ""}`}
      >
        <span aria-hidden>○</span>
        <span>Theseus on-chain · coming soon</span>
      </span>
    );
  }

  // When the public Theseus explorer exists, swap this for a real URL
  // pattern. Until then, link to the agent's RPC endpoint as the
  // truth-source.
  const explorerHref = `https://explorer.theseus.network/agent/${status.ss58}`;

  return (
    <a
      href={explorerHref}
      target="_blank"
      rel="noreferrer"
      className={`${baseClass} border-emerald-300/40 bg-emerald-300/[0.06] text-emerald-200 hover:bg-emerald-300/[0.12] transition-colors ${className ?? ""}`}
    >
      <span aria-hidden>●</span>
      <span>Theseus on-chain · {truncateSs58(status.ss58)}</span>
    </a>
  );
}
