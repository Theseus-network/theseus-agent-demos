/**
 * Read the real vault state from Base Sepolia (TVL, share price, supply).
 * Cached briefly so the polled state endpoint doesn't hammer the RPC.
 */
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { VAULT_ADDRESS, VAULT_ABI, ASSET_DECIMALS } from "./contracts";

const RPC = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ?? "https://base-sepolia-rpc.publicnode.com";
const client = createPublicClient({ chain: baseSepolia, transport: http(RPC) });

export interface VaultState { tvl: number; shares: number; pricePerShare: number; redemptionsOpen: boolean; nextRedemptionOpen: number; }

let cache: { at: number; data: VaultState } | null = null;

export async function readVault(): Promise<VaultState | null> {
  if (cache && Date.now() - cache.at < 8000) return cache.data;
  try {
    const [ta, ts, pps, open, nextOpen] = await Promise.all([
      client.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "totalAssets" }),
      client.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "totalSupply" }),
      client.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "pricePerShare" }),
      client.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "redemptionsOpen" }),
      client.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "nextRedemptionOpen" }),
    ]);
    const d = 10 ** ASSET_DECIMALS;
    const data: VaultState = {
      tvl: Number(ta as bigint) / d,
      shares: Number(ts as bigint) / d,
      pricePerShare: Number(pps as bigint) / d,
      redemptionsOpen: open as boolean,
      nextRedemptionOpen: Number(nextOpen as bigint),
    };
    cache = { at: Date.now(), data };
    return data;
  } catch {
    return cache?.data ?? null;
  }
}
