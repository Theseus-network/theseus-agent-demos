/**
 * Call a deployed Theseus agent and wait for its run to finalize.
 *
 * Server-side only — uses `@polkadot/api` with a sr25519 signer to
 * submit the `pallet_agents.call` extrinsic. The signer's seed is
 * `process.env.THESEUS_SIGNER_SEED` (defaults to `//Alice` in dev).
 *
 * Returns the agent's final assistant message (the last entry in the
 * `messages` state field after the run reaches an End terminator).
 *
 * IMPORTANT: until the public Theseus chain is up + each demo's
 * agent is deployed at a known SS58, this function will refuse early
 * with `OnChainNotConfigured`. The caller should check
 * `isOnChainConfigured(slug)` before invoking and route to the
 * existing centralized demo path when the on-chain version isn't
 * available yet.
 */

import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import type { KeyringPair } from "@polkadot/keyring/types";
import { getTheseusConfig, isOnChainConfigured, type DemoSlug } from "./config";

export class OnChainNotConfigured extends Error {
  constructor(slug: DemoSlug) {
    super(
      `Theseus agent for "${slug}" is not deployed yet. Set the ` +
        `NEXT_PUBLIC_THESEUS_AGENT_${slug
          .toUpperCase()
          .replace(/-/g, "_")} env var to the deployed agent's SS58 ` +
        `to flip this demo to the on-chain path.`,
    );
    this.name = "OnChainNotConfigured";
  }
}

export interface AgentCallResult {
  /** The agent's final assistant message — the user-facing answer. */
  finalMessage: string;
  /** Run id assigned by the chain — `<agent_ss58>:<n>`. Useful for explorer links. */
  runId: string;
  /** Block hash that included the `agent_call` extrinsic. */
  callBlockHash: string;
  /** Block hash that finalized the run's last extrinsic (model result). */
  resultBlockHash: string;
}

/** Module-cached api instance keyed by RPC URL. */
let _apiByUrl = new Map<string, Promise<ApiPromise>>();

async function getApi(rpcUrl: string): Promise<ApiPromise> {
  const cached = _apiByUrl.get(rpcUrl);
  if (cached) return cached;
  const promise = (async () => {
    const provider = new WsProvider(rpcUrl);
    return await ApiPromise.create({ provider });
  })();
  _apiByUrl.set(rpcUrl, promise);
  return promise;
}

function getSigner(): KeyringPair {
  const seed = process.env.THESEUS_SIGNER_SEED ?? "//Alice";
  return new Keyring({ type: "sr25519" }).addFromUri(seed);
}

export interface CallAgentInput {
  slug: DemoSlug;
  prompt: string;
  /** Optional run timeout in ms. Default 90s (covers a 4-node tool loop). */
  timeoutMs?: number;
}

/**
 * Submits `pallet_agents.call(<ss58>, 0, encoded_input)` and waits for
 * the agent's run to complete, then returns the agent's final
 * assistant message.
 *
 * Implementation note: the chain side encodes input as a SCALE
 * `StructuredValue::String`. The exact codec is not yet exposed
 * through `@polkadot/api`'s built-in types — see the implementation
 * stub below. Until that's wired up, this function throws
 * `OnChainNotConfigured` even when the SS58 is set, so callers must
 * still fall back to the centralized path. Replace the stub with the
 * real submit + wait logic once the public chain RPC is reachable
 * and the SCALE shapes are confirmed against a live node.
 */
export async function callAgent(input: CallAgentInput): Promise<AgentCallResult> {
  const { slug } = input;

  if (!isOnChainConfigured(slug)) {
    throw new OnChainNotConfigured(slug);
  }

  const cfg = getTheseusConfig();
  const agentSs58 = cfg.agents[slug];

  // Connect to chain. This part is safe to enable now — the rest
  // below is the placeholder.
  const api = await getApi(cfg.rpcUrl);
  const signer = getSigner();

  void api;
  void signer;
  void agentSs58;

  // ===== TODO when public chain is live =====
  //
  // 1. Encode the user prompt as a `StructuredValue::String` via the
  //    `ship_types` SCALE schema. Until those types are registered
  //    with `@polkadot/api`, this requires either:
  //      a) regenerating types from chain metadata via subxt-cli
  //         and importing the generated typegen, or
  //      b) manual SCALE encoding (length-prefix + bytes for String).
  //
  // 2. Submit `api.tx.agents.call(agentSs58, 0, encodedInput)` with
  //    the signer, capture the resulting run_id from the
  //    `Agents.Called` event.
  //
  // 3. Subscribe to `Agents.RunCompleted { run_id, final_messages }`
  //    OR poll the agent's `messages` state field until the run is
  //    in a terminal state. Extract the last assistant message.
  //
  // 4. Return { finalMessage, runId, callBlockHash, resultBlockHash }.
  //
  // The shape above is what the demo UI needs. Reference: the CLI's
  // `theseus agent call` impl in theseus-chain/cli/src/commands/agent.rs.

  throw new OnChainNotConfigured(slug);
}
