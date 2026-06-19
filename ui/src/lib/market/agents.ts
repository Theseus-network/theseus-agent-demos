// The two sovereign agent wallets that transact on the market. Derived
// deterministically from AGENT_PRIVATE_KEY (keccak of the key plus a label), so
// there are no extra secrets to manage and the addresses are stable. Funded
// once by setup-market.mjs. The same derivation the setup script used.
import { createWalletClient, http, keccak256, stringToBytes, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const RPC = process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";

function agentKey(): Hex {
  const raw = process.env.AGENT_PRIVATE_KEY;
  if (!raw) throw new Error("AGENT_PRIVATE_KEY not configured");
  return (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
}

const derive = (label: string): Hex => keccak256(stringToBytes(`${agentKey()}:${label}`));

export function getMarketAgents() {
  const requester = privateKeyToAccount(derive("a2a-requester-v1"));
  const provider = privateKeyToAccount(derive("a2a-provider-v1"));
  const reqWallet = createWalletClient({ account: requester, chain: baseSepolia, transport: http(RPC) });
  const provWallet = createWalletClient({ account: provider, chain: baseSepolia, transport: http(RPC) });
  return { requester, provider, reqWallet, provWallet };
}
