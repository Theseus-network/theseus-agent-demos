"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useReadContract,
  useWriteContract,
  useConfig,
} from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { ConnectControl } from "./ConnectControl";
import {
  ESCROW_ADDRESS,
  ESCROW_ABI,
  USDC_SYMBOL,
  BASE_SEPOLIA_ID,
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

const PANEL = "rounded-2xl border border-white/[0.07] bg-white/[0.03]";
const INPUT =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[13.5px] text-white outline-none transition-colors placeholder:text-[#6B7488] focus:border-[#6366F1]";
const GRAD = "bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] shadow-[0_8px_30px_rgba(99,102,241,0.3)]";

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
      const res = await fetch("/api/escrow/resolve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dealId: id }) });
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

  const tone = verdict?.verdict === "RELEASE" ? "text-[#34D399]" : verdict?.verdict === "REFUND" ? "text-[#FBBF24]" : "text-[#9AA3B2]";

  return (
    <div className="rounded-2xl border border-[#6366F1]/25 bg-[#6366F1]/[0.06] p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#6366F1] to-[#8B5CF6]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a5 5 0 0 1 5 5v1a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5zM5 21a7 7 0 0 1 14 0" /></svg>
        </span>
        <h3 className="text-[15px] font-semibold text-white">Agent settlement</h3>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-[#AAB2C5]">
        The Theseus agent reads the brief and the delivery, then commits a verdict. It pays the side
        the record supports, and refunds the buyer if it can&rsquo;t call it at 80% confidence.
      </p>
      {!verdict && !running && (
        <button onClick={settle} className={`mt-3 rounded-xl ${GRAD} px-4 py-2.5 text-[13.5px] font-semibold text-white`}>
          Have the agent settle this
        </button>
      )}
      {running && !verdict && <p className="mt-3 animate-pulse text-[12.5px] text-[#A5B0FF]">Agent is reading the deal…</p>}
      {log && <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-[11.5px] leading-relaxed text-[#AAB2C5]">{log}</pre>}
      {verdict && (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center gap-2">
            <span className={`text-[16px] font-bold ${tone}`}>{verdict.verdict}</span>
            {verdict.verdict !== "UNRESOLVABLE" && <span className="text-[12px] text-[#6B7488]">{verdict.confidencePct}% confidence</span>}
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-[#AAB2C5]">{verdict.evidenceSummary}</p>
          {tx && <a href={tx.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-mono text-[11.5px] text-[#A5B0FF] hover:underline">view settlement ↗ {tx.txHash.slice(0, 10)}…</a>}
        </div>
      )}
      {err && <p className="mt-3 rounded-xl border border-[#F87171]/30 bg-[#F87171]/10 px-3 py-2 text-[12px] text-[#F87171]">{err}</p>}
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
    address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: "getDeal",
    args: [BigInt(id)], chainId: BASE_SEPOLIA_ID, query: { refetchInterval: 6000 },
  });
  const deal = normalizeDeal(data) as Deal | null;

  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [delivery, setDelivery] = useState("");

  async function act(label: string, fn: () => Promise<`0x${string}`>) {
    setErr(null); setBusy(label);
    try { const h = await fn(); await waitForTransactionReceipt(config, { hash: h }); refetch(); }
    catch (e) { setErr((e instanceof Error ? e.message : "transaction failed").split("\n")[0].slice(0, 160)); }
    finally { setBusy(null); }
  }
  const w = (functionName: string, args: readonly unknown[]) =>
    writeContractAsync({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName, args, chainId: BASE_SEPOLIA_ID } as never);

  if (isLoading && !deal) {
    return <main className="mx-auto max-w-3xl px-4 py-20 text-center text-[14px] text-[#6B7488]">Loading deal #{id}…</main>;
  }
  if (!deal || deal.status === STATUS.NONE) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-[15px] text-white">Deal #{id} doesn&rsquo;t exist.</p>
        <Link href="/escrow" className="mt-3 inline-block text-[13px] text-[#A5B0FF] hover:underline">← Back to escrow</Link>
      </main>
    );
  }

  const isBuyer = sameAddr(deal.buyer, address);
  const isSeller = sameAddr(deal.seller, address);
  const { text: dlText, past } = deadlineLabel(deal.deadline);
  const terminal = TERMINAL.includes(deal.status);
  const statusTone = deal.status === 4 ? "text-[#34D399] border-[#34D399]/30 bg-[#34D399]/10"
    : deal.status === 5 ? "text-[#FBBF24] border-[#FBBF24]/30 bg-[#FBBF24]/10"
    : deal.status === 6 ? "text-[#9AA3B2] border-white/10 bg-white/5"
    : deal.status === 3 ? "text-[#F87171] border-[#F87171]/30 bg-[#F87171]/10"
    : "text-[#A5B0FF] border-[#6366F1]/30 bg-[#6366F1]/10";
  const paidLabel = deal.status === STATUS.RELEASED ? "Released to the seller"
    : deal.status === STATUS.REFUNDED ? "Refunded to the buyer"
    : deal.status === STATUS.UNRESOLVABLE ? "Agent declined; refunded to the buyer" : "";

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-8 sm:px-6">
      <Link href="/escrow" className="text-[13px] text-[#6B7488] transition-colors hover:text-white">← All deals</Link>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="font-mono text-[13px] text-[#6B7488]">Deal #{id}</span>
        <span className="font-mono text-[26px] font-bold text-white">{fmtUsdc(deal.amount)} {USDC_SYMBOL}</span>
        <span className={`ml-auto rounded-full border px-3 py-1 text-[12px] font-medium ${statusTone}`}>{STATUS_LABEL[deal.status]}</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { k: "Buyer", v: isBuyer ? "You" : shortAddr(deal.buyer) },
          { k: "Seller", v: isSeller ? "You" : shortAddr(deal.seller) },
          { k: "Deadline", v: `${dlText}${past ? " · passed" : ""}` },
        ].map((c) => (
          <div key={c.k} className={`${PANEL} px-4 py-3`}>
            <p className="text-[11px] uppercase tracking-wide text-[#6B7488]">{c.k}</p>
            <p className="mt-0.5 font-mono text-[13.5px] text-white">{c.v}</p>
          </div>
        ))}
      </div>

      <section className={`${PANEL} mt-4 p-5`}>
        <p className="text-[11px] uppercase tracking-wide text-[#6B7488]">Brief</p>
        <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-white/90">{deal.spec || "(none)"}</p>
        {deal.delivery && (
          <>
            <div className="my-4 h-px bg-white/[0.07]" />
            <p className="text-[11px] uppercase tracking-wide text-[#6B7488]">Delivery</p>
            <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-[#AAB2C5]">{deal.delivery}</p>
          </>
        )}
      </section>

      {terminal && (
        <div className="mt-4 rounded-2xl border border-[#34D399]/25 bg-[#34D399]/[0.06] px-5 py-4 text-[14px] text-white">
          <span className="font-semibold">{paidLabel}.</span>
          {deal.confidencePct > 0 && deal.status !== STATUS.UNRESOLVABLE ? <span className="text-[#AAB2C5]"> Agent confidence {deal.confidencePct}%.</span> : null}
        </div>
      )}

      {!isConnected && !terminal && (
        <div className={`${PANEL} mt-4 flex items-center justify-between gap-3 px-5 py-4`}>
          <span className="text-[13.5px] text-[#AAB2C5]">Connect your wallet to act on this deal.</span>
          <ConnectControl />
        </div>
      )}
      {isConnected && !onBase && !terminal && (
        <button onClick={() => switchChain({ chainId: BASE_SEPOLIA_ID })} className="mt-4 rounded-xl bg-[#FBBF24] px-4 py-2 text-[13px] font-semibold text-black">Switch to Base Sepolia</button>
      )}

      {isConnected && onBase && !terminal && (
        <div className="mt-4 space-y-4">
          {isSeller && deal.status === STATUS.FUNDED && (
            <div className={`${PANEL} p-5`}>
              <h3 className="text-[14.5px] font-semibold text-white">Submit your delivery</h3>
              <textarea value={delivery} onChange={(e) => setDelivery(e.target.value)} rows={4} placeholder="Paste your deliverable or a link to it. This is what the agent scores against the brief." className={`${INPUT} resize-y leading-relaxed`} />
              <div className="mt-3 flex flex-wrap gap-2">
                <button disabled={busy !== null || delivery.trim().length < 2} onClick={() => act("deliver", () => w("submitDelivery", [BigInt(id), delivery.trim()]))} className={`rounded-xl ${GRAD} px-4 py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-40 disabled:shadow-none`}>
                  {busy === "deliver" ? "Submitting…" : "Submit delivery"}
                </button>
                <button disabled={busy !== null} onClick={() => act("refund", () => w("refundBuyer", [BigInt(id)]))} className="rounded-xl border border-white/12 px-4 py-2.5 text-[13.5px] font-medium text-[#AAB2C5] hover:text-white disabled:opacity-50">Cancel & refund buyer</button>
              </div>
            </div>
          )}

          {isBuyer && (deal.status === STATUS.FUNDED || deal.status === STATUS.DELIVERED) && (
            <div className="flex flex-wrap gap-2">
              <button disabled={busy !== null} onClick={() => act("release", () => w("approveRelease", [BigInt(id)]))} className="rounded-xl bg-[#34D399] px-4 py-2.5 text-[13.5px] font-semibold text-black hover:opacity-90 disabled:opacity-50">
                {busy === "release" ? "Releasing…" : "Accept & release funds"}
              </button>
              <button disabled={busy !== null} onClick={() => act("dispute", () => w("dispute", [BigInt(id)]))} className="rounded-xl bg-[#F87171] px-4 py-2.5 text-[13.5px] font-semibold text-black hover:opacity-90 disabled:opacity-50">
                {busy === "dispute" ? "Opening…" : "Dispute → agent"}
              </button>
              {deal.status === STATUS.FUNDED && past && (
                <button disabled={busy !== null} onClick={() => act("reclaim", () => w("reclaimUndelivered", [BigInt(id)]))} className="rounded-xl border border-white/12 px-4 py-2.5 text-[13.5px] font-medium text-[#AAB2C5] hover:text-white disabled:opacity-50">Reclaim (no delivery, past deadline)</button>
              )}
            </div>
          )}

          {isSeller && deal.status === STATUS.DELIVERED && (
            <div className="flex flex-wrap gap-2">
              <button disabled={busy !== null} onClick={() => act("dispute", () => w("dispute", [BigInt(id)]))} className="rounded-xl bg-[#F87171] px-4 py-2.5 text-[13.5px] font-semibold text-black hover:opacity-90 disabled:opacity-50">Dispute → agent</button>
              {past && (
                <button disabled={busy !== null} onClick={() => act("claim", () => w("claimDelivered", [BigInt(id)]))} className="rounded-xl bg-[#34D399] px-4 py-2.5 text-[13.5px] font-semibold text-black hover:opacity-90 disabled:opacity-50">
                  {busy === "claim" ? "Claiming…" : "Claim (buyer didn't object, past deadline)"}
                </button>
              )}
            </div>
          )}

          {deal.status === STATUS.DISPUTED && <AgentSettlePanel id={id} onSettled={() => refetch()} />}

          {err && <p className="rounded-xl border border-[#F87171]/30 bg-[#F87171]/10 px-3 py-2 text-[12.5px] text-[#F87171]">{err}</p>}
        </div>
      )}
    </main>
  );
}
