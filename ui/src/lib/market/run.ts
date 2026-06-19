// Runs one agent-to-agent job end to end, on chain, streaming each step:
//   requester funds a task  ->  provider delivers  ->  adjudicator verifies
//   and releases payment (or refunds the requester on bad work).
// Reuses the AgentEscrow contract (a second instance) for custody and the
// escrow adjudicator for verification. Three real wallets sign real txs.
import { keccak256, toBytes, parseUnits, parseEventLogs, type Hex } from "viem";
import { getSepoliaPublic, getSepoliaWallet, basescanTxUrl } from "../agent-onchain/wallet";
import { getMarketAgents } from "./agents";
import { produceWork, type ProviderMode } from "./provider";
import { escrowAdjudicateStream } from "../escrow/llm";
import { ESCROW_ABI, OUTCOME } from "../escrow/abi";
import { AGENT_MARKET } from "../deployed-contracts";

const MARKET = AGENT_MARKET.address as Hex;

// The public RPC is load-balanced across nodes with slightly different heights,
// so a write that depends on a just-mined state change can have its gas estimate
// run against a lagging node and revert before anything is sent. Estimate
// reverts send no tx, so retrying with a short delay (until the node catches up)
// is safe and resolves it.
async function retry<T>(fn: () => Promise<T>, tries = 6, delayMs = 1500): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

interface OnchainDealRow {
  seller: Hex;
  status: number;
}

// Reputation = finished jobs (terminal status) where this provider was the
// seller, and how many of those it got paid for. Polls until the just-settled
// deal is reflected, since the read RPC can lag the settlement tx.
async function readReputation(providerAddr: Hex, settledId: number) {
  const pub = getSepoliaPublic();
  const me = providerAddr.toLowerCase();
  for (let attempt = 0; attempt < 5; attempt++) {
    const total = Number(await pub.readContract({ address: MARKET, abi: ESCROW_ABI, functionName: "dealCount" }));
    let jobs = 0;
    let paid = 0;
    let settledSeen = false;
    for (let i = 1; i <= total; i++) {
      const d = (await pub.readContract({ address: MARKET, abi: ESCROW_ABI, functionName: "getDeal", args: [BigInt(i)] })) as unknown as OnchainDealRow;
      if (d.seller.toLowerCase() !== me) continue;
      const s = Number(d.status);
      if (s >= 4) {
        // terminal: RELEASED(4), REFUNDED(5), UNRESOLVABLE(6)
        jobs++;
        if (s === 4) paid++;
        if (i === settledId) settledSeen = true;
      }
    }
    if (settledSeen || attempt === 4) return { jobs, paid };
    await new Promise((r) => setTimeout(r, 1200));
  }
  return { jobs: 0, paid: 0 };
}

export interface RunJobInput {
  task: string;
  budget: number;
  mode: ProviderMode;
}

export async function* runJob({ task, budget, mode }: RunJobInput): AsyncGenerator<Record<string, unknown>, void> {
  const pub = getSepoliaPublic();
  const { requester, provider, reqWallet, provWallet } = getMarketAgents();
  const adj = getSepoliaWallet();
  const amount = parseUnits(String(budget), AGENT_MARKET.usdcDecimals);

  yield { type: "posted", requester: requester.address, provider: provider.address, task, budget };

  // 1. Requester funds the job.
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 86_400);
  const h1 = await reqWallet.writeContract({ address: MARKET, abi: ESCROW_ABI, functionName: "createDeal", args: [provider.address, amount, deadline, task] });
  const receipt1 = await pub.waitForTransactionReceipt({ hash: h1 });
  // Read the id from the DealCreated event in the receipt, not a follow-up
  // dealCount() read: the load-balanced public RPC can answer that from a node
  // that hasn't seen the new block yet and return a stale 0.
  const created = parseEventLogs({ abi: ESCROW_ABI, logs: receipt1.logs, eventName: "DealCreated" });
  const dealId = Number((created[0]?.args as { id?: bigint } | undefined)?.id ?? 0n);
  if (!dealId) throw new Error("could not read new deal id from receipt");
  yield { type: "funded", txHash: h1, url: basescanTxUrl(h1), dealId, budget };

  // 2. Provider does the work and submits it.
  yield { type: "working" };
  const work = await produceWork(task, mode);
  yield { type: "work", work };
  const h2 = await retry(() => provWallet.writeContract({ address: MARKET, abi: ESCROW_ABI, functionName: "submitDelivery", args: [BigInt(dealId), work] }));
  await pub.waitForTransactionReceipt({ hash: h2 });
  yield { type: "delivered", txHash: h2, url: basescanTxUrl(h2) };

  // 3. Send it to the adjudicator for verification.
  const h3 = await retry(() => reqWallet.writeContract({ address: MARKET, abi: ESCROW_ABI, functionName: "dispute", args: [BigInt(dealId)] }));
  await pub.waitForTransactionReceipt({ hash: h3 });
  yield { type: "verifying" };

  let finalVerdict:
    | { verdict: "RELEASE" | "REFUND" | "UNRESOLVABLE"; confidencePct: number; evidenceSummary: string; reason: string }
    | null = null;
  for await (const ev of escrowAdjudicateStream({ dealId, spec: task, delivery: work, amountLabel: `${budget} ${AGENT_MARKET.usdcSymbol}` })) {
    if (ev.type === "text_delta") yield { type: "reasoning", text: ev.text };
    else if (ev.type === "final") finalVerdict = ev.output;
  }
  if (!finalVerdict) throw new Error("adjudicator returned no verdict");

  // 4. Adjudicator settles on chain.
  const outcome =
    finalVerdict.verdict === "RELEASE" ? OUTCOME.RELEASE : finalVerdict.verdict === "REFUND" ? OUTCOME.REFUND : OUTCOME.UNRESOLVABLE;
  const reasonHash = keccak256(toBytes(finalVerdict.evidenceSummary || finalVerdict.verdict));
  const h4 = await retry(() => adj.writeContract({ address: MARKET, abi: ESCROW_ABI, functionName: "resolve", args: [BigInt(dealId), outcome, Math.max(0, Math.min(100, finalVerdict.confidencePct)), reasonHash] }));
  await pub.waitForTransactionReceipt({ hash: h4 });

  const reputation = await readReputation(provider.address as Hex, dealId);
  yield {
    type: "settled",
    verdict: finalVerdict,
    paid: finalVerdict.verdict === "RELEASE",
    txHash: h4,
    url: basescanTxUrl(h4),
    reputation,
  };
  yield { type: "done" };
}
