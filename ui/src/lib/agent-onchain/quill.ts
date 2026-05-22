/**
 * Quill on-chain commit. Three outcomes per verification:
 * VERIFIED (1) / DISTINGUISHABLE (2) / FABRICATED (3).
 */

import { type Hex } from "viem";
import {
  DEPLOYED_CONTRACTS,
  isContractDeployed,
} from "../deployed-contracts";
import { publishReasonBlob } from "./blob";
import { basescanTxUrl, getSepoliaWallet } from "./wallet";

const QUILL_ABI = [
  {
    type: "function",
    name: "verifyCitation",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "outcome", type: "uint8" },
      { name: "citationHash", type: "bytes32" },
      { name: "reasonHash", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

const OUTCOME = {
  UNINITIALIZED: 0,
  VERIFIED: 1,
  DISTINGUISHABLE: 2,
  FABRICATED: 3,
} as const;

export interface QuillCommitInput {
  id: number;
  outcome: "VERIFIED" | "DISTINGUISHABLE" | "FABRICATED";
  citationHash: Hex;
  blob: Record<string, unknown>;
}

export interface QuillCommitOutcome {
  txHash: Hex;
  txUrl: string;
  reasonHash: Hex;
  blobUrl: string | null;
}

export async function commitQuillVerdict(
  input: QuillCommitInput,
): Promise<QuillCommitOutcome | null> {
  if (!isContractDeployed(DEPLOYED_CONTRACTS.quillCoAuthor)) {
    return null;
  }

  const { reasonHash, blobUrl } = await publishReasonBlob("quill", input.blob);

  const wallet = getSepoliaWallet();
  const txHash = await wallet.writeContract({
    address: DEPLOYED_CONTRACTS.quillCoAuthor.address,
    abi: QUILL_ABI,
    functionName: "verifyCitation",
    args: [
      BigInt(input.id),
      OUTCOME[input.outcome],
      input.citationHash,
      reasonHash,
    ],
  });

  return {
    txHash,
    txUrl: basescanTxUrl(txHash),
    reasonHash,
    blobUrl,
  };
}
