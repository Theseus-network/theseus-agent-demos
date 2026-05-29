/**
 * Public surface for the Theseus on-chain integration.
 *
 * This is the layer between the demo pages (which today call
 * centralized OpenAI/Anthropic via `/api/demo/<slug>`) and a future
 * world where every demo dispatches its run to a real Theseus agent.
 *
 * Until the public chain is up and the demo agents are deployed,
 * `isOnChainConfigured()` returns false for every slug; the UI
 * surfaces a "coming soon" affordance instead of a real call button.
 * Setting `NEXT_PUBLIC_THESEUS_AGENT_<SLUG>` env vars flips the
 * switch — no code changes needed.
 */

export {
  DEMO_SLUGS,
  PLACEHOLDER_SS58,
  getTheseusConfig,
  getOnChainStatus,
  isOnChainConfigured,
  type DemoSlug,
  type OnChainStatus,
  type TheseusOnChainConfig,
} from "./config";

export {
  callAgent,
  OnChainNotConfigured,
  type AgentCallResult,
  type CallAgentInput,
} from "./agent-call";
