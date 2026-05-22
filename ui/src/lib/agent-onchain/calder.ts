/**
 * Calder on-chain commit. Single path: file. Append-only — no
 * REFUSED state. Tamper detection happens off-chain by comparing
 * the centralized row to the on-chain dispatchHash.
 */

import { type Hex } from "viem";
import {
  DEPLOYED_CONTRACTS,
  isContractDeployed,
} from "../deployed-contracts";
import { publishReasonBlob } from "./blob";
import { basescanTxUrl, getSepoliaWallet } from "./wallet";

const CALDER_ABI = [
  {
    type: "function",
    name: "file",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "dispatchHash", type: "bytes32" },
      { name: "eventHash", type: "bytes32" },
      { name: "reasonHash", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

export interface CalderCommitInput {
  id: number;
  dispatchHash: Hex;
  eventHash: Hex;
  blob: Record<string, unknown>;
}

export interface CalderCommitOutcome {
  txHash: Hex;
  txUrl: string;
  reasonHash: Hex;
  blobUrl: string | null;
}

export async function commitCalderDispatch(
  input: CalderCommitInput,
): Promise<CalderCommitOutcome | null> {
  if (!isContractDeployed(DEPLOYED_CONTRACTS.calderChronicler)) {
    return null;
  }

  const { reasonHash, blobUrl } = await publishReasonBlob(
    "calder",
    input.blob,
  );

  const wallet = getSepoliaWallet();
  const txHash = await wallet.writeContract({
    address: DEPLOYED_CONTRACTS.calderChronicler.address,
    abi: CALDER_ABI,
    functionName: "file",
    args: [
      BigInt(input.id),
      input.dispatchHash,
      input.eventHash,
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
