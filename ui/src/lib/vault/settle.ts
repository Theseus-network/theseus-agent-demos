/**
 * Close the decide-to-execute loop: mark the vault's NAV to the agent's real
 * allocation. Each settle applies the P&L of an X%-ETH portfolio over the
 * elapsed ETH move to the real vault — minting eUSDC into it on gains (backing
 * the higher NAV with real testnet tokens) and pulling eUSDC out on losses via
 * the manager role. Redemptions then pay out at the moved NAV.
 *
 * Server-only: uses SETTLER_PRIVATE_KEY (the vault's manager) from the env.
 */
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { VAULT_ADDRESS, EUSDC_ADDRESS } from "./contracts";

const RPC = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ?? "https://base-sepolia-rpc.publicnode.com";

const VAULT_MIN = [
  { type: "function", name: "totalAssets", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "markLoss", stateMutability: "nonpayable", inputs: [{ type: "uint256" }], outputs: [] },
  { type: "function", name: "sync", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;
const ERC_MINT = [
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [] },
] as const;

function signer() {
  let pk = process.env.SETTLER_PRIVATE_KEY;
  if (!pk) return null;
  if (!pk.startsWith("0x")) pk = "0x" + pk;
  const account = privateKeyToAccount(pk as `0x${string}`);
  const transport = http(RPC);
  return { account, pub: createPublicClient({ chain: baseSepolia, transport }), wal: createWalletClient({ account, chain: baseSepolia, transport }) };
}


/** Mark the vault to a given USD P&L delta: mint eUSDC into it on gains, pull
 *  eUSDC out (manager) on losses. Used by the prediction-market book. */
export async function settlePnlUsd(deltaUsd: number): Promise<boolean> {
  if (!Number.isFinite(deltaUsd) || Math.abs(deltaUsd) < 0.5) return false;
  const s = signer();
  if (!s) return false;
  try {
    const units = BigInt(Math.round(Math.abs(deltaUsd) * 1e6));
    if (deltaUsd > 0) {
      // Gain: mint the underlying into the vault, then sync() to charge fees.
      await s.wal.writeContract({ address: EUSDC_ADDRESS, abi: ERC_MINT, functionName: "mint", args: [VAULT_ADDRESS, units] });
      await s.wal.writeContract({ address: VAULT_ADDRESS, abi: VAULT_MIN, functionName: "sync", args: [] });
    } else {
      // Loss: burn assets out of the vault (to a dead address). Manager gets nothing.
      await s.wal.writeContract({ address: VAULT_ADDRESS, abi: VAULT_MIN, functionName: "markLoss", args: [units] });
    }
    return true;
  } catch {
    return false;
  }
}
