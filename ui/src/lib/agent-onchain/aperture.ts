/**
 * Aperture on-chain commit. Two decisions: PUBLISHED / REFUSED.
 */

import { type Hex } from "viem";
import {
  DEPLOYED_CONTRACTS,
  isContractDeployed,
} from "../deployed-contracts";
import { publishReasonBlob } from "./blob";
import { basescanTxUrl, getSepoliaWallet } from "./wallet";

const APERTURE_ABI = [
  {
    type: "function",
    name: "publish",
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

export interface ApertureCommitInput {
  id: number;
  decision: "PUBLISHED" | "REFUSED";
  contentHash: Hex;
  blob: Record<string, unknown>;
}

export interface ApertureCommitOutcome {
  txHash: Hex;
  txUrl: string;
  reasonHash: Hex;
  blobUrl: string | null;
}

export async function commitApertureVerdict(
  input: ApertureCommitInput,
): Promise<ApertureCommitOutcome | null> {
  if (!isContractDeployed(DEPLOYED_CONTRACTS.apertureArtist)) {
    return null;
  }

  const { reasonHash, blobUrl } = await publishReasonBlob(
    "aperture",
    input.blob,
  );

  const wallet = getSepoliaWallet();
  const txHash = await wallet.writeContract({
    address: DEPLOYED_CONTRACTS.apertureArtist.address,
    abi: APERTURE_ABI,
    functionName: input.decision === "PUBLISHED" ? "publish" : "refuse",
    args: [BigInt(input.id), input.contentHash, reasonHash],
  });

  return {
    txHash,
    txUrl: basescanTxUrl(txHash),
    reasonHash,
    blobUrl,
  };
}
