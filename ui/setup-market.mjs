// One-time: derive the requester + provider agent wallets from AGENT_PRIVATE_KEY
// (so no new secrets), fund them with gas, mint market eUSDC to the requester,
// and approve the market. Same derivation the runtime lib uses.
import { createWalletClient, createPublicClient, http, keccak256, stringToBytes, parseEther, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { readFileSync } from "fs";

const RPC = "https://base-sepolia-rpc.publicnode.com";
const MARKET = "0xf568d5C7aB29ACB16D02D0BDEF6A7bdAd5ace868";
const USDC = "0xAC755429040F395a322Eb778B3bf5F4fADf3294c";

const env = readFileSync(".env.local", "utf8");
const raw = (env.match(/^AGENT_PRIVATE_KEY=(.*)$/m)?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
const agentKey = raw.startsWith("0x") ? raw : `0x${raw}`;

const derive = (label) => keccak256(stringToBytes(`${agentKey}:${label}`));
const requester = privateKeyToAccount(derive("a2a-requester-v1"));
const provider = privateKeyToAccount(derive("a2a-provider-v1"));
const agent = privateKeyToAccount(agentKey);
console.log("agent    ", agent.address);
console.log("requester", requester.address);
console.log("provider ", provider.address);

const pub = createPublicClient({ chain: baseSepolia, transport: http(RPC) });
const agentW = createWalletClient({ account: agent, chain: baseSepolia, transport: http(RPC) });
const reqW = createWalletClient({ account: requester, chain: baseSepolia, transport: http(RPC) });
const gas = { maxFeePerGas: parseUnits("1", 9), maxPriorityFeePerGas: parseUnits("0.5", 9) };

const ERC20 = [
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
];

for (const addr of [requester.address, provider.address]) {
  const bal = await pub.getBalance({ address: addr });
  if (bal < parseEther("0.0015")) {
    const h = await agentW.sendTransaction({ to: addr, value: parseEther("0.004"), ...gas });
    await pub.waitForTransactionReceipt({ hash: h });
    console.log("funded ETH", addr);
  } else console.log("ETH ok", addr);
}

const mh = await agentW.writeContract({ address: USDC, abi: ERC20, functionName: "mint", args: [requester.address, parseUnits("100000", 6)], ...gas });
await pub.waitForTransactionReceipt({ hash: mh });
console.log("minted 100k eUSDC to requester");

const ah = await reqW.writeContract({ address: USDC, abi: ERC20, functionName: "approve", args: [MARKET, parseUnits("1000000000", 6)], ...gas });
await pub.waitForTransactionReceipt({ hash: ah });
console.log("requester approved market");
console.log("DONE");
