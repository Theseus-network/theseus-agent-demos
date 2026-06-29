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
import { AgentMark } from "./AgentMark";
import { basescanAddressUrl } from "@/lib/deployed-contracts";
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

const PANEL = "rounded-xl border border-white/[0.08] bg-white/[0.02]";
const INPUT =
  "mt-1.5 w-full rounded-lg border border-white/12 bg-white/[0.02] px-3.5 py-2.5 text-[13.5px] text-white outline-none transition-colors placeholder:text-[#6B7488] focus:border-white/35";
const BTN = "bg-[#4d8df0] text-white hover:bg-[#5f9bf5]";

interface Verdict {
  verdict: "RELEASE" | "REFUND" | "UNRESOLVABLE";
  confidencePct: number;
  reason: string;
  evidenceSummary: string;
  citations: { url: string; title: string }[];
}

function AgentSettlePanel({ id, spec, delivery, amountLabel, onSettled }: { id: number; spec: string; delivery: string; amountLabel: string; onSettled: () => void }) {
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [tx, setTx] = useState<{ txHash: string; url: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Sentinel: an independent appeals agent (different model, blind to the first
  // verdict). Agreement upholds; disagreement means a human takes over.
  const [sentinel, setSentinel] = useState<Verdict | null>(null);
  const [sLog, setSLog] = useState("");
  const [sRunning, setSRunning] = useState(false);

  async function appealSentinel() {
    setSRunning(true); setSentinel(null); setSLog("");
    try {
      const res = await fetch("/api/escrow/adjudicate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dealId: id, spec, delivery, amountLabel, role: "sentinel" }) });
      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const p of parts) {
          const dl = p.match(/^data: (.*)$/m)?.[1];
          if (!dl) continue;
          let d: Record<string, unknown>;
          try { d = JSON.parse(dl); } catch { continue; }
          if (d.type === "text_delta") setSLog((l) => l + String(d.text ?? ""));
          else if (d.type === "final") setSentinel(d.output as unknown as Verdict);
        }
      }
    } catch {
      /* leave sentinel null; the appeal can be retried */
    } finally {
      setSRunning(false);
    }
  }

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
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/12 bg-white/[0.05]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a5 5 0 0 1 5 5v1a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5zM5 21a7 7 0 0 1 14 0" /></svg>
        </span>
        <h3 className="text-[15px] font-semibold text-white">Agent settlement</h3>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-[#AAB2C5]">
        The Theseus agent reads the brief and the delivery, then commits a verdict. It pays the side
        the record supports, and refunds the buyer if it can&rsquo;t call it at 80% confidence.
      </p>
      {!verdict && !running && (
        <button onClick={settle} className={`mt-3 rounded-lg ${BTN} px-4 py-2.5 text-[13.5px] font-semibold`}>
          Have the agent settle this
        </button>
      )}
      {running && !verdict && <p className="mt-3 animate-pulse text-[12.5px] text-white/70">Agent is reading the deal…</p>}
      {log && <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-[11.5px] leading-relaxed text-[#AAB2C5]">{log}</pre>}
      {verdict && (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center gap-2">
            <span className={`text-[16px] font-bold ${tone}`}>{verdict.verdict}</span>
            {verdict.verdict !== "UNRESOLVABLE" && <span className="text-[12px] text-[#6B7488]">{verdict.confidencePct}% confidence</span>}
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-[#AAB2C5]">{verdict.evidenceSummary}</p>
          {tx && <a href={tx.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-mono text-[11.5px] text-white/70 hover:underline">view settlement ↗ {tx.txHash.slice(0, 10)}…</a>}

          {/* Sentinel: independent appeals agent */}
          <div className="mt-3 border-t border-white/10 pt-3">
            {!sentinel && !sRunning && (
              <>
                <p className="text-[12px] leading-relaxed text-[#8A93A6]">Don&rsquo;t want to take one agent&rsquo;s word for it? A second agent, a different model, blind to this verdict, can re-judge the deal from scratch.</p>
                <button onClick={appealSentinel} className="mt-2 rounded-lg border border-white/15 px-3 py-1.5 text-[12.5px] font-medium text-white/85 transition-colors hover:border-white/35">
                  Request independent appeal (Sentinel)
                </button>
              </>
            )}
            {sRunning && !sentinel && <p className="animate-pulse text-[12px] text-white/70">Sentinel is re-judging independently…</p>}
            {sLog && !sentinel && <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-[#AAB2C5]">{sLog}</pre>}
            {sentinel && (() => {
              const agree = sentinel.verdict === verdict.verdict;
              const sTone = sentinel.verdict === "RELEASE" ? "text-[#34D399]" : sentinel.verdict === "REFUND" ? "text-[#FBBF24]" : "text-[#9AA3B2]";
              return (
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-wide text-[#6B7488]">Sentinel</span>
                    <span className={`text-[14px] font-bold ${sTone}`}>{sentinel.verdict}</span>
                    {sentinel.verdict !== "UNRESOLVABLE" && <span className="text-[11px] text-[#6B7488]">{sentinel.confidencePct}%</span>}
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-[#AAB2C5]">{sentinel.evidenceSummary}</p>
                  <div className={`mt-2 rounded-lg border px-3 py-2 text-[12px] ${agree ? "border-[#34D399]/30 bg-[#34D399]/10 text-[#34D399]" : "border-[#FBBF24]/30 bg-[#FBBF24]/10 text-[#FBBF24]"}`}>
                    {agree
                      ? "Upheld, two independent agents, different models, reached the same verdict."
                      : "Split, the appeal disagrees with the arbiter. A contested call like this is held and escalated to a human instead of paying out."}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
      {err && <p className="mt-3 rounded-xl border border-[#F87171]/30 bg-[#F87171]/10 px-3 py-2 text-[12px] text-[#F87171]">{err}</p>}
    </div>
  );
}

function SentinelVerify({ id, spec, delivery, amountLabel, onchain }: { id: number; spec: string; delivery: string; amountLabel: string; onchain: "RELEASE" | "REFUND" | "UNRESOLVABLE" }) {
  const [sentinel, setSentinel] = useState<Verdict | null>(null);
  const [sLog, setSLog] = useState("");
  const [running, setRunning] = useState(false);

  async function verify() {
    setRunning(true); setSentinel(null); setSLog("");
    try {
      const res = await fetch("/api/escrow/adjudicate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dealId: id, spec, delivery, amountLabel, role: "sentinel" }) });
      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const p of parts) {
          const dl = p.match(/^data: (.*)$/m)?.[1];
          if (!dl) continue;
          let d: Record<string, unknown>;
          try { d = JSON.parse(dl); } catch { continue; }
          if (d.type === "text_delta") setSLog((l) => l + String(d.text ?? ""));
          else if (d.type === "final") setSentinel(d.output as unknown as Verdict);
        }
      }
    } catch {
      /* retryable */
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mt-3 border-t border-white/[0.07] pt-3">
      {!sentinel && !running && (
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-white"><AgentMark name="sentinel" className="h-4 w-4 text-[#4d8df0]" />Sentinel <span className="font-mono text-[10px] font-normal text-[#6B7488]">model B · independent</span></span>
            <p className="mt-0.5 text-[11.5px] text-[#7E8696]">Optional: re-verify with a second model, blind to the verdict.</p>
          </div>
          <button onClick={verify} className="shrink-0 rounded-md border border-white/15 px-2.5 py-1 text-[11.5px] font-medium text-white/85 transition-colors hover:border-white/35">Re-verify →</button>
        </div>
      )}
      {running && !sentinel && <p className="animate-pulse text-[12px] text-white/70">Sentinel is re-judging from scratch, blind to the verdict…</p>}
      {sLog && !sentinel && <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-[#AAB2C5]">{sLog}</pre>}
      {sentinel && (() => {
        const agree = sentinel.verdict === onchain;
        const sTone = sentinel.verdict === "RELEASE" ? "#34D399" : sentinel.verdict === "REFUND" ? "#F87171" : "#9AA3B2";
        return (
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-[#6B7488]">SENTINEL · model B</span>
              <span className="font-mono text-[12.5px] font-semibold" style={{ color: sTone }}>{sentinel.verdict}</span>
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-[#AAB2C5]">{sentinel.evidenceSummary}</p>
            <div className="mt-2 rounded-lg border px-3 py-2 text-[12px]" style={{ borderColor: agree ? "#34D39940" : "#FBBF2440", background: agree ? "#34D39912" : "#FBBF2412", color: agree ? "#34D399" : "#FBBF24" }}>
              {agree ? "An independent second model, blind to the verdict, reached the same call." : "The independent model disagrees, a live deal in this state would be held for a human, not paid."}
            </div>
          </div>
        );
      })()}
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
        <Link href="/escrow" className="mt-3 inline-block text-[13px] text-white/70 hover:underline">← Back to escrow</Link>
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
    : "text-white/80 border-white/15 bg-white/5";
  const paidLabel = deal.status === STATUS.RELEASED ? "Released to the seller"
    : deal.status === STATUS.REFUNDED ? "Refunded to the buyer"
    : deal.status === STATUS.UNRESOLVABLE ? "Agent declined; refunded to the buyer" : "";

  return (
    <main className="mx-auto max-w-3xl px-4 pb-12 pt-8 sm:px-6">
      <Link href="/escrow" className="text-[13px] text-[#6B7488] transition-colors hover:text-white">← All deals</Link>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="font-mono text-[13px] text-[#6B7488]">Deal #{id}</span>
        <span className="font-mono text-[26px] font-bold text-white">{fmtUsdc(deal.amount)} {USDC_SYMBOL}</span>
        <span className={`ml-auto rounded-full border px-3 py-1 text-[12px] font-medium ${statusTone}`}>{STATUS_LABEL[deal.status]}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-7 gap-y-1 text-[12.5px]">
        {[
          { k: "Buyer", v: isBuyer ? "You" : shortAddr(deal.buyer) },
          { k: "Seller", v: isSeller ? "You" : shortAddr(deal.seller) },
          { k: "Deadline", v: `${dlText}${past ? " · passed" : ""}` },
        ].map((c) => (
          <span key={c.k} className="text-[#6B7488]">{c.k} <span className="ml-1 font-mono text-white/85">{c.v}</span></span>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2">
        {[
          { k: "Funded", done: true },
          { k: "Delivered", done: !!deal.delivery || deal.status >= STATUS.DELIVERED },
          { k: "Settled", done: terminal },
        ].map((s, i, arr) => (
          <div key={s.k} className="flex flex-1 items-center gap-2">
            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${s.done ? "bg-[#34D399]" : "border border-white/20"}`}>
              {s.done && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#0a0b0d" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>}
            </span>
            <span className={`text-[11.5px] ${s.done ? "text-white" : "text-[#6B7488]"}`}>{s.k}</span>
            {i < arr.length - 1 && <span className={`h-px flex-1 ${s.done ? "bg-[#34D399]/40" : "bg-white/10"}`} />}
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

      {terminal && (() => {
        const tHex = deal.status === STATUS.RELEASED ? "#34D399" : deal.status === STATUS.REFUNDED ? "#F87171" : "#9AA3B2";
        const arbiterVerdict = (deal.status === STATUS.RELEASED ? "RELEASE" : deal.status === STATUS.REFUNDED ? "REFUND" : "UNRESOLVABLE") as "RELEASE" | "REFUND" | "UNRESOLVABLE";
        return (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#7E8696]">Settlement record</h2>
              <span className="rounded-md border px-2.5 py-0.5 text-[11px] font-medium" style={{ color: tHex, borderColor: `${tHex}40`, background: `${tHex}14` }}>{paidLabel}</span>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-lg border px-3.5 py-3" style={{ borderColor: `${tHex}33`, background: `${tHex}10` }}>
              <div>
                <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-white"><AgentMark name="arbiter" className="h-4 w-4 text-[#8A93A6]" />Arbiter <span className="font-mono text-[10px] font-normal text-[#6B7488]">model A</span></span>
                <p className="mt-0.5 text-[11.5px] text-[#7E8696]">ruled on the brief and the delivery, on-chain</p>
              </div>
              <span className="rounded-md border px-2 py-1 font-mono text-[12px] font-bold leading-none" style={{ color: tHex, borderColor: `${tHex}59`, background: `${tHex}22` }}>{arbiterVerdict}</span>
            </div>
            <SentinelVerify id={id} spec={deal.spec} delivery={deal.delivery} amountLabel={`${fmtUsdc(deal.amount)} ${USDC_SYMBOL}`} onchain={arbiterVerdict} />
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-white/[0.07] pt-3 font-mono text-[11px] text-[#6B7488]">
              <span className="text-[#9AA3B2]">{deal.status === STATUS.RELEASED ? "Both agents agreed, so the contract paid out." : deal.status === STATUS.REFUNDED ? "The buyer was refunded." : "The buyer was refunded; a human takes over."}</span>
              <span className="mx-1">·</span>
              <span>contract <span className="text-white/75">{shortAddr(ESCROW_ADDRESS)}</span></span>
              <a href={basescanAddressUrl(ESCROW_ADDRESS)} target="_blank" rel="noopener noreferrer" className="text-white/75 underline decoration-white/20 hover:text-white">Basescan ↗</a>
            </div>
          </div>
        );
      })()}

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
                <button disabled={busy !== null || delivery.trim().length < 2} onClick={() => act("deliver", () => w("submitDelivery", [BigInt(id), delivery.trim()]))} className={`rounded-lg ${BTN} px-4 py-2.5 text-[13.5px] font-semibold disabled:opacity-40`}>
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
              <button disabled={busy !== null} onClick={() => act("dispute", () => w("dispute", [BigInt(id)]))} className="rounded-xl border border-[#F87171]/40 bg-[#F87171]/10 px-4 py-2.5 text-[13.5px] font-semibold text-[#F87171] disabled:opacity-50">
                {busy === "dispute" ? "Opening…" : "Dispute → agent"}
              </button>
              {deal.status === STATUS.FUNDED && past && (
                <button disabled={busy !== null} onClick={() => act("reclaim", () => w("reclaimUndelivered", [BigInt(id)]))} className="rounded-xl border border-white/12 px-4 py-2.5 text-[13.5px] font-medium text-[#AAB2C5] hover:text-white disabled:opacity-50">Reclaim (no delivery, past deadline)</button>
              )}
            </div>
          )}

          {isSeller && deal.status === STATUS.DELIVERED && (
            <div className="flex flex-wrap gap-2">
              <button disabled={busy !== null} onClick={() => act("dispute", () => w("dispute", [BigInt(id)]))} className="rounded-xl border border-[#F87171]/40 bg-[#F87171]/10 px-4 py-2.5 text-[13.5px] font-semibold text-[#F87171] disabled:opacity-50">Dispute → agent</button>
              {past && (
                <button disabled={busy !== null} onClick={() => act("claim", () => w("claimDelivered", [BigInt(id)]))} className="rounded-xl bg-[#34D399] px-4 py-2.5 text-[13.5px] font-semibold text-black hover:opacity-90 disabled:opacity-50">
                  {busy === "claim" ? "Claiming…" : "Claim (buyer didn't object, past deadline)"}
                </button>
              )}
            </div>
          )}

          {deal.status === STATUS.DISPUTED && <AgentSettlePanel id={id} spec={deal.spec} delivery={deal.delivery} amountLabel={`${fmtUsdc(deal.amount)} ${USDC_SYMBOL}`} onSettled={() => refetch()} />}

          {err && <p className="rounded-xl border border-[#F87171]/30 bg-[#F87171]/10 px-3 py-2 text-[12.5px] text-[#F87171]">{err}</p>}
        </div>
      )}
    </main>
  );
}
