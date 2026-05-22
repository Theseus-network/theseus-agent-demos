/**
 * Vellum on-chain commit. Two decisions: PUBLISHED / REFUSED, both
 * keyed by an off-chain assigned id (the edit attempt id or a piece
 * id). Each commit hashes the proposed body and the reasoning blob
 * onto the VellumAuthor contract.
 *
 * No-op if the contract is not deployed yet — the caller treats
 * `null` as "demo mode, skip the commit step."
 */

import { type Hex } from "viem";
import {
  DEPLOYED_CONTRACTS,
  isContractDeployed,
} from "../deployed-contracts";
import { publishReasonBlob } from "./blob";
import { basescanTxUrl, getSepoliaWallet } from "./wallet";

const VELLUM_ABI = [
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

export interface VellumCommitInput {
  id: number;
  decision: "PUBLISHED" | "REFUSED";
  contentHash: Hex;
  blob: Record<string, unknown>;
}

export interface VellumCommitOutcome {
  txHash: Hex;
  txUrl: string;
  reasonHash: Hex;
  blobUrl: string | null;
}

export async function commitVellumVerdict(
  input: VellumCommitInput,
): Promise<VellumCommitOutcome | null> {
  if (!isContractDeployed(DEPLOYED_CONTRACTS.vellumAuthor)) {
    return null;
  }

  const { reasonHash, blobUrl } = await publishReasonBlob(
    "vellum",
    input.blob,
  );

  const wallet = getSepoliaWallet();
  const txHash = await wallet.writeContract({
    address: DEPLOYED_CONTRACTS.vellumAuthor.address,
    abi: VELLUM_ABI,
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
