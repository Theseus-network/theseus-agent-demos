/**
 * Phase 2 dossier signals. Each function below pulls one external lookup
 * the agent needs to evaluate a launch beyond "fresh pool + token
 * metadata": source verification, mint authority, deployer history, and
 * holder concentration.
 *
 * All four are best-effort. A network failure or empty response returns
 * null for that field; the calling research module surfaces nulls to
 * the LLM as "unknown" and lets the model weight remaining signals.
 */

import { type Address, type Hex } from "viem";
import { getMainnetClient } from "./indexer";
import { fetchGoPlusSecurity } from "./goplus";

/** Etherscan V2 multi-chain API. Same module/action shape as the legacy
 *  V1 endpoints, but you pass `chainid=8453` for Base and the same key
 *  works across all chains. Anonymous reads are rate-limited; the
 *  Sniper cron fires every 20 min, so a key isn't required at this
 *  volume. If ETHERSCAN_API_KEY is set we include it for the higher
 *  daily quota. */
const ETHERSCAN_V2_API = "https://api.etherscan.io/v2/api";
const BASE_CHAIN_ID = "8453";

/** Server-side timeout. Phase 2 already adds latency on top of the
 *  evaluator call, so we cap each lookup so the loop doesn't hang. */
const FETCH_TIMEOUT_MS = 8000;

function etherscanUrl(params: Record<string, string>): string {
  const u = new URL(ETHERSCAN_V2_API);
  u.searchParams.set("chainid", BASE_CHAIN_ID);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const key = process.env.ETHERSCAN_API_KEY ?? process.env.BASESCAN_API_KEY;
  if (key) u.searchParams.set("apikey", key);
  return u.toString();
}

async function fetchWithTimeout(url: string): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: ctrl.signal,
      next: { revalidate: 300 }, // 5 min cache
    });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface BasescanResponse<T> {
  status: string;
  message: string;
  result: T;
}

/** Etherscan V2 wraps every response in `{status, message, result}`. A
 *  failed call (rate limit, bad key, malformed query) still returns
 *  HTTP 200 with status === "0" and a string in `result`. We treat
 *  anything other than status === "1" as a soft failure. */
function isOkResponse<T>(json: BasescanResponse<T>): json is BasescanResponse<T> & { status: "1" } {
  return json.status === "1";
}

interface BasescanSourceCodeEntry {
  SourceCode: string;
  ABI: string;
  ContractName: string;
  CompilerVersion: string;
}

/** Returns { verified, compilerVersion } if Basescan recognizes the
 *  address as a contract. The classic shape: SourceCode === "" means
 *  unverified; non-empty means verified (Basescan returns the source). */
export async function fetchSourceVerification(
  address: Address,
): Promise<{ verified: boolean | null; compilerVersion: string | null }> {
  const url = etherscanUrl({
    module: "contract",
    action: "getsourcecode",
    address,
  });
  const res = await fetchWithTimeout(url);
  if (!res || !res.ok) return { verified: null, compilerVersion: null };
  try {
    const json = (await res.json()) as BasescanResponse<
      BasescanSourceCodeEntry[] | string
    >;
    if (!isOkResponse(json) || !Array.isArray(json.result)) {
      return { verified: null, compilerVersion: null };
    }
    const entry = json.result[0];
    if (!entry) return { verified: null, compilerVersion: null };
    const verified = entry.SourceCode.length > 0;
    return {
      verified,
      compilerVersion: verified ? entry.CompilerVersion : null,
    };
  } catch {
    return { verified: null, compilerVersion: null };
  }
}

/** Reads the standard Ownable `owner()` selector on-chain. Returns:
 *   - "renounced" if owner == 0x0
 *   - "active" if owner is non-zero
 *   - "no-owner" if the contract doesn't expose owner() (or it reverts)
 *   - null on RPC error
 *
 *  Note: this doesn't catch every authority pattern (AccessControl,
 *  MinterRole, custom). A "no-owner" return is genuinely unknown —
 *  the model should weight it as a yellow flag, not a green. */
export async function readMintAuthority(
  token: Address,
): Promise<"renounced" | "active" | "no-owner" | null> {
  const client = getMainnetClient();
  try {
    const owner = await client.readContract({
      address: token,
      abi: [
        {
          type: "function",
          name: "owner",
          stateMutability: "view",
          inputs: [],
          outputs: [{ type: "address" }],
        },
      ],
      functionName: "owner",
    });
    const zero = "0x0000000000000000000000000000000000000000";
    return (owner as string).toLowerCase() === zero ? "renounced" : "active";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Common case: contract has no `owner()` selector — the call reverts.
    // We treat that as a distinct "no-owner" signal, not a hard error.
    if (/reverted|execution reverted|function selector/i.test(msg)) {
      return "no-owner";
    }
    return null;
  }
}

/** Resolves the deployer EOA by reading the `from` address of the
 *  pool-creation tx. */
export async function resolveDeployer(txHash: Hex): Promise<Address | null> {
  const client = getMainnetClient();
  try {
    const tx = await client.getTransaction({ hash: txHash });
    return tx.from as Address;
  } catch {
    return null;
  }
}

/** Counts contract creations attributable to the deployer EOA in the
 *  last ~10k Base mainnet txs (Basescan returns up to 10000 per page).
 *  A contract creation is a tx with `to: null`. */
export async function fetchDeployerHistory(
  deployer: Address,
): Promise<number | null> {
  const url = etherscanUrl({
    module: "account",
    action: "txlist",
    address: deployer,
    startblock: "0",
    endblock: "99999999",
    page: "1",
    offset: "10000",
    sort: "desc",
  });
  const res = await fetchWithTimeout(url);
  if (!res || !res.ok) return null;
  try {
    const json = (await res.json()) as BasescanResponse<
      Array<{ to: string; contractAddress: string; isError: string }> | string
    >;
    if (!isOkResponse(json) || !Array.isArray(json.result)) return null;
    let creations = 0;
    for (const tx of json.result) {
      // Basescan reports contract creations with `to: ""` and a
      // populated contractAddress. Filter out failed deploys.
      const isCreation =
        (!tx.to || tx.to === "") &&
        typeof tx.contractAddress === "string" &&
        tx.contractAddress.length > 0 &&
        tx.isError === "0";
      if (isCreation) creations++;
    }
    return creations;
  } catch {
    return null;
  }
}

/** Top-10 holder concentration as a 0..1 fraction. Hits Basescan's
 *  token-holder-list endpoint (free-tier may rate-limit; null on
 *  failure). */
export async function fetchTopHolderConcentration(
  token: Address,
  totalSupply: bigint,
  decimals: number,
): Promise<number | null> {
  if (totalSupply === 0n) return null;
  const url = etherscanUrl({
    module: "token",
    action: "tokenholderlist",
    contractaddress: token,
    page: "1",
    offset: "10",
  });
  const res = await fetchWithTimeout(url);
  if (!res || !res.ok) return null;
  try {
    const json = (await res.json()) as BasescanResponse<
      Array<{ TokenHolderAddress: string; TokenHolderQuantity: string }> | string
    >;
    if (!isOkResponse(json) || !Array.isArray(json.result) || json.result.length === 0) return null;
    // Sum the top-10 (or however many were returned) in token-native units.
    let topSum = 0n;
    for (const h of json.result) {
      try {
        topSum += BigInt(h.TokenHolderQuantity);
      } catch {
        // Some entries arrive as decimals (e.g. "1.23e6"); fall back to
        // float parse, scale by decimals, then round.
        const f = Number(h.TokenHolderQuantity);
        if (Number.isFinite(f)) {
          topSum += BigInt(Math.round(f * Math.pow(10, decimals)));
        }
      }
    }
    // Compute share as float with reasonable precision.
    const share = Number(topSum) / Number(totalSupply);
    if (!Number.isFinite(share)) return null;
    return Math.max(0, Math.min(1, share));
  } catch {
    return null;
  }
}

import type { Phase2Signals, PoolCandidate, TokenMetadata } from "./types";

/** Run all four Phase 2 lookups in parallel and assemble the signals
 *  object. Each lookup is independent; one failure doesn't cancel the
 *  others. Returns null only if every lookup errored (typically: no
 *  network at all). */
export async function gatherPhase2(
  candidate: PoolCandidate,
  token: TokenMetadata,
): Promise<Phase2Signals | null> {
  const [
    { verified, compilerVersion },
    mintAuthorityState,
    deployerAddress,
    goplusRaw,
  ] = await Promise.all([
    fetchSourceVerification(candidate.token),
    readMintAuthority(candidate.token),
    resolveDeployer(candidate.txHash),
    fetchGoPlusSecurity(candidate.token),
  ]);

  // Deployer-dependent lookups can only run once we have the address.
  const deployerPriorDeploys = deployerAddress
    ? await fetchDeployerHistory(deployerAddress)
    : null;

  const top10Concentration = await fetchTopHolderConcentration(
    candidate.token,
    token.totalSupply,
    token.decimals,
  );

  const goplus = goplusRaw.unavailable ? null : goplusRaw;

  // If literally every lookup failed, return null so the caller can
  // surface "Phase 2 unavailable" rather than a wall of nulls.
  const everyFieldNull =
    verified === null &&
    mintAuthorityState === null &&
    deployerAddress === null &&
    deployerPriorDeploys === null &&
    top10Concentration === null &&
    goplus === null;
  if (everyFieldNull) return null;

  return {
    sourceVerified: verified,
    compilerVersion,
    mintAuthorityState,
    deployerAddress,
    deployerPriorDeploys,
    top10Concentration,
    goplus,
    fetchedAt: new Date().toISOString(),
  };
}
