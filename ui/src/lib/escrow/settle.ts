// Server-side settlement: read a disputed deal from the contract and, once the
// agent has a verdict, post resolve() from the agent EOA. The contract enforces
// that only the agent can call resolve, so this is the one place a verdict turns
// into a payout.

import { keccak256, toBytes, type Hex } from "viem";
import { getSepoliaPublic, getSepoliaWallet } from "../agent-onchain/wallet";
import { ESCROW_ABI, OUTCOME } from "./abi";
import { ESCROW } from "../deployed-contracts";
import type { EscrowVerdict } from "./llm";

export interface OnChainDeal {
  buyer: Hex;
  seller: Hex;
  amount: bigint;
  deadline: bigint;
  status: number;
  spec: string;
  delivery: string;
  confidencePct: number;
  reasonHash: Hex;
}

export async function readDeal(dealId: number): Promise<OnChainDeal> {
  const pub = getSepoliaPublic();
  const d = (await pub.readContract({
    address: ESCROW.address as Hex,
    abi: ESCROW_ABI,
    functionName: "getDeal",
    args: [BigInt(dealId)],
  })) as unknown as {
    buyer: Hex;
    seller: Hex;
    amount: bigint;
    deadline: bigint;
    status: number;
    spec: string;
    delivery: string;
    confidencePct: number;
    reasonHash: Hex;
  };
  return {
    buyer: d.buyer,
    seller: d.seller,
    amount: d.amount,
    deadline: d.deadline,
    status: Number(d.status),
    spec: d.spec,
    delivery: d.delivery,
    confidencePct: Number(d.confidencePct),
    reasonHash: d.reasonHash,
  };
}

const OUTCOME_OF: Record<EscrowVerdict, number> = {
  RELEASE: OUTCOME.RELEASE,
  REFUND: OUTCOME.REFUND,
  UNRESOLVABLE: OUTCOME.UNRESOLVABLE,
};

export async function resolveOnChain(
  dealId: number,
  verdict: EscrowVerdict,
  confidencePct: number,
  reasonText: string,
): Promise<Hex> {
  const wallet = getSepoliaWallet();
  const pub = getSepoliaPublic();
  const reasonHash = keccak256(toBytes(reasonText || verdict));
  const hash = await wallet.writeContract({
    address: ESCROW.address as Hex,
    abi: ESCROW_ABI,
    functionName: "resolve",
    args: [BigInt(dealId), OUTCOME_OF[verdict], Math.max(0, Math.min(100, confidencePct)), reasonHash],
  });
  await pub.waitForTransactionReceipt({ hash });
  return hash;
}
