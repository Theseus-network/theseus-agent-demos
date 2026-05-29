/**
 * Theseus on-chain agent registry.
 *
 * Each demo on this site has a centralized off-chain implementation
 * today (the `/api/demo/<slug>` route calls DeepSeek directly, writes a
 * verdict to a Base Sepolia contract). When a Theseus chain is
 * actually running and the 13 demo templates have been deployed on it,
 * this registry maps each demo slug to the deployed agent's SS58
 * address.
 *
 * Until then everything below is **placeholder**. The integration
 * code (`agent-call.ts`) is wired up and ready; setting these env
 * vars flips the demos from "off-chain mock" to "real Theseus run."
 *
 * To flip the switch (when the chain + agents are deployed):
 *
 *   NEXT_PUBLIC_THESEUS_RPC=wss://testnet.theseus.network
 *   NEXT_PUBLIC_THESEUS_AGENT_VELLUM=5GWDguafNCTtyd2Ckttyu…  (real SS58)
 *   NEXT_PUBLIC_THESEUS_AGENT_AAVE=5D9Cs5k4fbjnt…
 *   …one per demo slug…
 *
 * The UI auto-detects which demos have real agents configured and
 * shows a "Run on Theseus" affordance only for those. The others
 * keep their existing off-chain demo flow.
 */

/** All 13 demo slugs in the canonical order used elsewhere. */
export const DEMO_SLUGS = [
  "vellum",
  "calder",
  "marcellus",
  "aperture",
  "quill",
  "aave",
  "terra",
  "bridge",
  "governance",
  "aviation",
  "fund",
  "adjudicate",
  "launch-sniper",
] as const;

export type DemoSlug = (typeof DEMO_SLUGS)[number];

/** Sentinel: agent isn't deployed yet. Keep it obviously fake so any
 *  code path that accidentally uses it surfaces the unset state. */
export const PLACEHOLDER_SS58 = "5PLACEHOLDER000000000000000000000000000000000000";

/** Default RPC URL when `NEXT_PUBLIC_THESEUS_RPC` isn't set. Matches
 *  the local dev playground stack so devs running both apps locally
 *  get connected for free. */
const DEFAULT_RPC_URL = "ws://127.0.0.1:9944";

/** Per-slug env var name. `vellum` → `NEXT_PUBLIC_THESEUS_AGENT_VELLUM`. */
function envVarFor(slug: DemoSlug): string {
  return `NEXT_PUBLIC_THESEUS_AGENT_${slug.toUpperCase().replace(/-/g, "_")}`;
}

/** Read one slug's SS58 from env. Returns the placeholder if unset. */
function readAgentSs58(slug: DemoSlug): string {
  // Next.js bundles NEXT_PUBLIC_* at build time, so we can't do
  // dynamic lookups via process.env[name]. List them explicitly.
  const map: Record<DemoSlug, string | undefined> = {
    vellum: process.env.NEXT_PUBLIC_THESEUS_AGENT_VELLUM,
    calder: process.env.NEXT_PUBLIC_THESEUS_AGENT_CALDER,
    marcellus: process.env.NEXT_PUBLIC_THESEUS_AGENT_MARCELLUS,
    aperture: process.env.NEXT_PUBLIC_THESEUS_AGENT_APERTURE,
    quill: process.env.NEXT_PUBLIC_THESEUS_AGENT_QUILL,
    aave: process.env.NEXT_PUBLIC_THESEUS_AGENT_AAVE,
    terra: process.env.NEXT_PUBLIC_THESEUS_AGENT_TERRA,
    bridge: process.env.NEXT_PUBLIC_THESEUS_AGENT_BRIDGE,
    governance: process.env.NEXT_PUBLIC_THESEUS_AGENT_GOVERNANCE,
    aviation: process.env.NEXT_PUBLIC_THESEUS_AGENT_AVIATION,
    fund: process.env.NEXT_PUBLIC_THESEUS_AGENT_FUND,
    adjudicate: process.env.NEXT_PUBLIC_THESEUS_AGENT_ADJUDICATE,
    "launch-sniper": process.env.NEXT_PUBLIC_THESEUS_AGENT_LAUNCH_SNIPER,
  };
  return map[slug] ?? PLACEHOLDER_SS58;
}

export interface TheseusOnChainConfig {
  /** WS RPC URL of the Theseus chain. */
  rpcUrl: string;
  /** Per-slug agent SS58 addresses. Placeholder when not yet configured. */
  agents: Record<DemoSlug, string>;
}

export function getTheseusConfig(): TheseusOnChainConfig {
  const agents = Object.fromEntries(
    DEMO_SLUGS.map((slug) => [slug, readAgentSs58(slug)]),
  ) as Record<DemoSlug, string>;
  return {
    rpcUrl: process.env.NEXT_PUBLIC_THESEUS_RPC ?? DEFAULT_RPC_URL,
    agents,
  };
}

/** True when the on-chain integration is fully configured for this demo. */
export function isOnChainConfigured(slug: DemoSlug): boolean {
  const ss58 = readAgentSs58(slug);
  return ss58 !== PLACEHOLDER_SS58 && ss58.length > 0;
}

/** Human-readable status surface for the UI. */
export interface OnChainStatus {
  slug: DemoSlug;
  configured: boolean;
  ss58: string;
  rpcUrl: string;
  envVar: string;
}

export function getOnChainStatus(slug: DemoSlug): OnChainStatus {
  const cfg = getTheseusConfig();
  const ss58 = cfg.agents[slug];
  return {
    slug,
    configured: ss58 !== PLACEHOLDER_SS58 && ss58.length > 0,
    ss58,
    rpcUrl: cfg.rpcUrl,
    envVar: envVarFor(slug),
  };
}
