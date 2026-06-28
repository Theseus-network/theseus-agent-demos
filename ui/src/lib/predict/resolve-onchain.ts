// Writes the adjudicator's verdict on-chain: calls resolve() on the deployed
// TheseusPredictionMarket as the agent EOA (the contract's onlyAgent). Gated on
// both the contract address (NEXT_PUBLIC_PREDICT_MARKET) and the settler key
// (SETTLER_PRIVATE_KEY, server-only). Until both are set it returns null and the
// app settles off-chain as before.
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { OUTCOME, PREDICT_MARKET_ABI, PREDICT_MARKET_ADDRESS, onChainEnabled } from "./onchain";

export async function resolveOnChain(marketId: number, winner: "YES" | "NO"): Promise<string | null> {
  const key = process.env.SETTLER_PRIVATE_KEY;
  if (!key || !onChainEnabled()) return null;
  try {
    const account = privateKeyToAccount((key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`);
    const client = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(process.env.BASE_SEPOLIA_RPC ?? "https://sepolia.base.org"),
    });
    return await client.writeContract({
      address: PREDICT_MARKET_ADDRESS as `0x${string}`,
      abi: PREDICT_MARKET_ABI,
      functionName: "resolve",
      args: [BigInt(marketId), winner === "YES" ? OUTCOME.YES : OUTCOME.NO],
    });
  } catch (e) {
    console.error("resolveOnChain failed:", e);
    return null;
  }
}
