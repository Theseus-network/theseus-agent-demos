"use client";

import { useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useReadContract,
  useWriteContract,
  useConfig,
} from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import {
  ESCROW_ADDRESS,
  ESCROW_ABI,
  USDC_SYMBOL,
  BASE_SEPOLIA_ID,
  EXPLORER,
  fmtUsdc,
  shortAddr,
  sameAddr,
  deadlineLabel,
  normalizeDeal,
  STATUS,
  STATUS_LABEL,
  TERMINAL,
  type Deal,
} from "@/lib/escrow/client";

interface Verdict {
  verdict: "RELEASE" | "REFUND" | "UNRESOLVABLE";
  confidencePct: number;
  reason: string;
  evidenceSummary: string;
  citations: { url: string; title: string }[];
}

function AgentSettlePanel({ id, onSettled }: { id: number; onSettled: () => void }) {
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [tx, setTx] = useState<{ txHash: string; url: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function settle() {
    setRunning(true); setLog(""); setVerdict(null); setTx(null); setErr(null);
    try {
      const res = await fetch("/api/escrow/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId: id }),
      });
      if (!res.body) throw new Error("no response stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const p of parts) {
          const ev = p.match(/^event: (.*)$/m)?.[1];
          const dl = p.match(/^data: (.*)$/m)?.[1];
          if (!ev || !dl) continue;
          let d: Record<string, unknown>;
          try { d = JSON.parse(dl); } catch { continue; }
          if (ev === "text_delta") setLog((l) => l + String(d.text ?? ""));
          else if (ev === "verdict") setVerdict(d as unknown as Verdict);
          else if (ev === "settled") { setTx(d as { txHash: string; url: string }); onSettled(); }
          else if (ev === "error" || ev === "settle_error") setErr(String(d.message ?? "failed"));
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "settlement failed");
    } finally {
      setRunning(false);
      onSettled();
    }
  }

  const tone = verdict?.verdict === "RELEASE" ? "text-green"
    : verdict?.verdict === "REFUND" ? "text-amber" : "text-fg-mute";

  return (
    <div className="rounded-xl border border-coral/40 bg-coral/5 p-5">
      <h3 className="text-[14px] font-semibold text-fg">Agent settlement</h3>
      <p className="mt-1 text-[12.5px] text-fg-dim">
        A Theseus agent reads the brief and the delivery, then commits a verdict on chain. It pays
        the side the record supports, and refunds the buyer if it can&rsquo;t call it at 80% confidence.
      </p>
      {!verdict && !running && (
        <button onClick={settle} className="mt-3 rounded-lg bg-coral px-4 py-2 text-[13px] font-semibold text-white hover:bg-coral-dim">
          Have the agent settle this
        </button>
      )}
      {running && !verdict && (
        <p className="mt-3 animate-pulse text-[12.5px] text-coral">Agent is reading the deal…</p>
      )}
      {log && (
        <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-bg p-3 font-mono text-[11.5px] leading-relaxed text-fg-dim">{log}</pre>
      )}
      {verdict && (
        <div className="mt-3 rounded-lg border border-border bg-bg p-4">
          <div className="flex items-center gap-2">
            <span className={`font-mono text-[14px] font-semibold ${tone}`}>{verdict.verdict}</span>
            {verdict.verdict !== "UNRESOLVABLE" && (
              <span className="text-[12px] text-fg-mute">{verdict.confidencePct}% confidence</span>
            )}
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-fg-dim">{verdict.evidenceSummary}</p>
          {tx && (
            <a href={tx.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-mono text-[11.5px] text-coral hover:underline">
              settled on chain ↗ {tx.txHash.slice(0, 10)}…
            </a>
          )}
        </div>
      )}
      {err && <p className="mt-3 rounded-lg border border-red/40 bg-red/10 px-3 py-2 text-[12px] text-red">{err}</p>}
    </div>
  );
}

export default function DealView({ id }: { id: number }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const onBase = chainId === BASE_SEPOLIA_ID;
  const config = useConfig();
  const { writeContractAsync } = useWriteContract();

  const { data, refetch, isLoading } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: ESCROW_ABI,
    functionName: "getDeal",
    args: [BigInt(id)],
    chainId: BASE_SEPOLIA_ID,
    query: { refetchInterval: 6000 },
  });
  const deal = normalizeDeal(data) as Deal | null;

  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [delivery, setDelivery] = useState("");

  async function act(label: string, fn: () => Promise<`0x${string}`>) {
    setErr(null); setBusy(label);
    try {
      const h = await fn();
      await waitForTransactionReceipt(config, { hash: h });
      refetch();
    } catch (e) {
      setErr((e instanceof Error ? e.message : "transaction failed").split("\n")[0].slice(0, 160));
    } finally {
      setBusy(null);
    }
  }

  const w = (functionName: string, args: readonly unknown[]) =>
    writeContractAsync({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName, args, chainId: BASE_SEPOLIA_ID } as never);

  if (isLoading && !deal) {
    return <main className="mx-auto max-w-3xl px-4 py-16 text-center text-[14px] text-fg-mute">Loading deal #{id}…</main>;
  }
  if (!deal || deal.status === STATUS.NONE) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-[15px] text-fg">Deal #{id} doesn&rsquo;t exist.</p>
        <Link href="/escrow" className="mt-3 inline-block text-[13px] text-coral hover:underline">← Back to escrow</Link>
      </main>
    );
  }

  const isBuyer = sameAddr(deal.buyer, address);
  const isSeller = sameAddr(deal.seller, address);
  const { text: dlText, past } = deadlineLabel(deal.deadline);
  const terminal = TERMINAL.includes(deal.status);

  const paidLabel = deal.status === STATUS.RELEASED ? "Released to the seller"
    : deal.status === STATUS.REFUNDED ? "Refunded to the buyer"
    : deal.status === STATUS.UNRESOLVABLE ? "Agent declined; refunded to the buyer" : "";

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-8 sm:px-5">
      <div className="flex items-center justify-between">
        <Link href="/escrow" className="text-[13px] text-fg-mute hover:text-fg">← Escrow</Link>
        <ConnectButton showBalance={false} chainStatus="icon" />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <span className="font-mono text-[13px] text-fg-mute">Deal #{id}</span>
        <span className="font-mono text-[20px] font-semibold text-fg">{fmtUsdc(deal.amount)} {USDC_SYMBOL}</span>
        <span className="ml-auto rounded-full border border-border bg-surface px-2.5 py-1 text-[11.5px] font-medium text-fg-dim">{STATUS_LABEL[deal.status]}</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { k: "Buyer", v: isBuyer ? "You" : shortAddr(deal.buyer) },
          { k: "Seller", v: isSeller ? "You" : shortAddr(deal.seller) },
          { k: "Deadline", v: `${dlText}${past ? " (passed)" : ""}` },
        ].map((c) => (
          <div key={c.k} className="rounded-lg border border-border bg-surface/40 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wide text-fg-mute">{c.k}</p>
            <p className="mt-0.5 text-[13.5px] text-fg">{c.v}</p>
          </div>
        ))}
      </div>

      <section className="mt-5 rounded-xl border border-border bg-surface/40 p-5">
        <p className="text-[11px] uppercase tracking-wide text-fg-mute">Brief</p>
        <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-fg">{deal.spec || "(none)"}</p>
        {deal.delivery && (
          <>
            <p className="mt-4 text-[11px] uppercase tracking-wide text-fg-mute">Delivery</p>
            <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-fg-dim">{deal.delivery}</p>
          </>
        )}
      </section>

      {terminal && (
        <div className="mt-5 rounded-xl border border-green/30 bg-green/5 px-4 py-3 text-[13.5px] text-fg">
          {paidLabel}.{deal.confidencePct > 0 && deal.status !== STATUS.UNRESOLVABLE ? ` Agent confidence ${deal.confidencePct}%.` : ""}
        </div>
      )}

      {!isConnected && (
        <p className="mt-5 rounded-xl border border-border bg-surface/40 px-4 py-3 text-[13px] text-fg-dim">Connect your wallet to act on this deal.</p>
      )}
      {isConnected && !onBase && (
        <button onClick={() => switchChain({ chainId: BASE_SEPOLIA_ID })} className="mt-5 rounded-lg bg-amber px-3 py-2 text-[12.5px] font-semibold text-black">Switch to Base Sepolia</button>
      )}

      {isConnected && onBase && !terminal && (
        <div className="mt-5 space-y-4">
          {/* Seller, awaiting delivery */}
          {isSeller && deal.status === STATUS.FUNDED && (
            <div className="rounded-xl border border-border bg-surface/40 p-5">
              <h3 className="text-[14px] font-semibold text-fg">Submit your delivery</h3>
              <textarea value={delivery} onChange={(e) => setDelivery(e.target.value)} rows={4} placeholder="Paste your deliverable or a link to it. This is what the agent scores against the brief." className="mt-2 w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-[13px] leading-relaxed text-fg outline-none focus:border-coral/60" />
              <div className="mt-3 flex flex-wrap gap-2">
                <button disabled={busy !== null || delivery.trim().length < 2} onClick={() => act("deliver", () => w("submitDelivery", [BigInt(id), delivery.trim()]))} className="rounded-lg bg-coral px-4 py-2 text-[13px] font-semibold text-white hover:bg-coral-dim disabled:opacity-50">
                  {busy === "deliver" ? "Submitting…" : "Submit delivery"}
                </button>
                <button disabled={busy !== null} onClick={() => act("refund", () => w("refundBuyer", [BigInt(id)]))} className="rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-fg-dim hover:text-fg disabled:opacity-50">
                  Cancel & refund buyer
                </button>
              </div>
            </div>
          )}

          {/* Buyer actions */}
          {isBuyer && (deal.status === STATUS.FUNDED || deal.status === STATUS.DELIVERED) && (
            <div className="flex flex-wrap gap-2">
              <button disabled={busy !== null} onClick={() => act("release", () => w("approveRelease", [BigInt(id)]))} className="rounded-lg bg-green px-4 py-2 text-[13px] font-semibold text-black hover:opacity-90 disabled:opacity-50">
                {busy === "release" ? "Releasing…" : "Accept & release funds"}
              </button>
              <button disabled={busy !== null} onClick={() => act("dispute", () => w("dispute", [BigInt(id)]))} className="rounded-lg border border-red/40 bg-red/10 px-4 py-2 text-[13px] font-semibold text-red disabled:opacity-50">
                {busy === "dispute" ? "Opening…" : "Dispute → agent"}
              </button>
              {deal.status === STATUS.FUNDED && past && (
                <button disabled={busy !== null} onClick={() => act("reclaim", () => w("reclaimUndelivered", [BigInt(id)]))} className="rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-fg-dim hover:text-fg disabled:opacity-50">
                  Reclaim (no delivery, past deadline)
                </button>
              )}
            </div>
          )}

          {/* Seller, after delivery */}
          {isSeller && deal.status === STATUS.DELIVERED && (
            <div className="flex flex-wrap gap-2">
              <button disabled={busy !== null} onClick={() => act("dispute", () => w("dispute", [BigInt(id)]))} className="rounded-lg border border-red/40 bg-red/10 px-4 py-2 text-[13px] font-semibold text-red disabled:opacity-50">
                Dispute → agent
              </button>
              {past && (
                <button disabled={busy !== null} onClick={() => act("claim", () => w("claimDelivered", [BigInt(id)]))} className="rounded-lg bg-green px-4 py-2 text-[13px] font-semibold text-black hover:opacity-90 disabled:opacity-50">
                  {busy === "claim" ? "Claiming…" : "Claim (buyer didn't object, past deadline)"}
                </button>
              )}
            </div>
          )}

          {/* Disputed -> agent */}
          {deal.status === STATUS.DISPUTED && (
            <AgentSettlePanel id={id} onSettled={() => refetch()} />
          )}

          {err && <p className="rounded-lg border border-red/40 bg-red/10 px-3 py-2 text-[12.5px] text-red">{err}</p>}
        </div>
      )}
    </main>
  );
}
