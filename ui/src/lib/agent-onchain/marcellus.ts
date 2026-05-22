/**
 * Marcellus on-chain commit. Two decisions: FILED / REFUSED.
 */

import { type Hex } from "viem";
import {
  DEPLOYED_CONTRACTS,
  isContractDeployed,
} from "../deployed-contracts";
import { publishReasonBlob } from "./blob";
import { basescanTxUrl, getSepoliaWallet } from "./wallet";

const MARCELLUS_ABI = [
  {
    type: "function",
    name: "file",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "contentHash", type: "bytes32" },
      { name: "reasonHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "refuse",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "contentHash", type: "bytes32" },
      { name: "reasonHash", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

export interface MarcellusCommitInput {
  id: number;
  decision: "FILED" | "REFUSED";
  contentHash: Hex;
  blob: Record<string, unknown>;
}

export interface MarcellusCommitOutcome {
  txHash: Hex;
  txUrl: string;
  reasonHash: Hex;
  blobUrl: string | null;
}

export async function commitMarcellusVerdict(
  input: MarcellusCommitInput,
): Promise<MarcellusCommitOutcome | null> {
  if (!isContractDeployed(DEPLOYED_CONTRACTS.marcellusCritic)) {
    return null;
  }

  const { reasonHash, blobUrl } = await publishReasonBlob(
    "marcellus",
    input.blob,
  );

  const wallet = getSepoliaWallet();
  const txHash = await wallet.writeContract({
    address: DEPLOYED_CONTRACTS.marcellusCritic.address,
    abi: MARCELLUS_ABI,
    functionName: input.decision === "FILED" ? "file" : "refuse",
    args: [BigInt(input.id), input.contentHash, reasonHash],
  });

  return {
    txHash,
    txUrl: basescanTxUrl(txHash),
    reasonHash,
    blobUrl,
  };
}
