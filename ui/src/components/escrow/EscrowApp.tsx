"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useConfig,
} from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { ConnectControl } from "./ConnectControl";
import {
  ESCROW_ADDRESS,
  ESCROW_ABI,
  USDC_ADDRESS,
  USDC_SYMBOL,
  ERC20_ABI,
  BASE_SEPOLIA_ID,
  fmtUsdc,
  parseUsdc,
  shortAddr,
  sameAddr,
  normalizeDeal,
  STATUS_LABEL,
  TERMINAL,
  type Deal,
} from "@/lib/escrow/client";

const PANEL = "rounded-2xl border border-white/[0.07] bg-white/[0.03]";
const INPUT =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[13.5px] text-white outline-none transition-colors placeholder:text-[#6B7488] focus:border-[#6366F1]";

function Icon({ name }: { name: string }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "cheaper") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.5 9.5a2.5 2 0 0 1 5 0c0 1.2-1 1.6-2.5 2s-2.5.8-2.5 2a2.5 2 0 0 0 5 0" /></svg>;
  if (name === "faster") return <svg {...common}><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>;
  if (name === "fairer") return <svg {...common}><path d="M12 3v18M5 7h14M7 7l-3 6a3 3 0 0 0 6 0zM17 7l3 6a3 3 0 0 1-6 0z" /></svg>;
  return <svg {...common}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>;
}

function StatusPill({ status }: { status: number }) {
  const tone =
    status === 4 ? "text-[#34D399] border-[#34D399]/30 bg-[#34D399]/10"
    : status === 5 ? "text-[#FBBF24] border-[#FBBF24]/30 bg-[#FBBF24]/10"
    : status === 6 ? "text-[#9AA3B2] border-white/10 bg-white/5"
    : status === 3 ? "text-[#F87171] border-[#F87171]/30 bg-[#F87171]/10"
    : "text-[#A5B0FF] border-[#6366F1]/30 bg-[#6366F1]/10";
  return <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tone}`}>{STATUS_LABEL[status] ?? "—"}</span>;
}

const EXAMPLE_FALLBACK = {
  id: 1,
  spec: "Write a product description for a 24oz stainless steel water bottle: at least three sentences, mentioning vacuum insulation and the capacity in ounces.",
  amount: 1_000_000_000n,
  confidencePct: 99,
};

function HeroDealCard({ id, spec, amount, confidencePct }: { id: number; spec: string; amount: bigint; confidencePct: number }) {
  const steps = ["Funded", "Delivered", "Disputed", "Settled"];
  return (
    <Link href={`/escrow/${id}`} className="group relative block">
      <div className="absolute -inset-3 rounded-[28px] bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.25),transparent_70%)] blur-xl" />
      <div className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-5 shadow-2xl transition-transform group-hover:-translate-y-0.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[12px] text-[#9AA3B2]">Deal #{id}</span>
          <span className="rounded-full border border-[#34D399]/30 bg-[#34D399]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#34D399]">Settled</span>
        </div>
        <p className="mt-3 line-clamp-2 text-[13.5px] leading-relaxed text-white/90">{spec}</p>

        <div className="mt-4 flex items-center gap-1.5">
          {steps.map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-1.5">
              <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#34D399]">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#0A0E1A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
              </div>
              {i < steps.length - 1 && <div className="h-px flex-1 bg-gradient-to-r from-[#34D399]/60 to-[#34D399]/20" />}
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[9.5px] uppercase tracking-wide text-[#6B7488]">
          {steps.map((s) => <span key={s}>{s}</span>)}
        </div>

        <div className="mt-4 rounded-xl border border-[#6366F1]/20 bg-[#6366F1]/[0.07] p-3.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10.5px] uppercase tracking-wide text-[#A5B0FF]">Agent verdict</span>
            <span className="text-[11px] text-[#9AA3B2]">{confidencePct}% confidence</span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-[18px] font-bold text-[#34D399]">RELEASE</span>
            <span className="text-[12.5px] text-[#AAB2C5]">{fmtUsdc(amount)} {USDC_SYMBOL} to the seller</span>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#8A93A6]">Three sentences, names vacuum insulation, states the capacity in ounces. Every clause met.</p>
        </div>
      </div>
    </Link>
  );
}

const WHY = [
  { icon: "cheaper", h: "Cheaper", p: "A few cents of gas to settle, with no percentage cut. Escrow services and arbiters take 1 to 5% of the deal, or bill by the hour." },
  { icon: "faster", h: "Faster", p: "The agent reads the work and rules in seconds, at any hour. A human dispute desk runs days or weeks of back-and-forth." },
  { icon: "fairer", h: "Fairer", p: "Judged against the brief by the same published rules every time, with the reasoning and confidence on chain. No human discretion." },
  { icon: "transparent", h: "Transparent", p: "The funds, the brief, the delivery, and the verdict all live on chain, so anyone can audit how a deal settled. Ordinary escrow is a black box." },
];

const STEPS = [
  { n: "01", h: "Lock the payment", p: "The buyer funds a deal against a written brief. The money sits in the contract, not with either side." },
  { n: "02", h: "Deliver the work", p: "The seller submits the deliverable on chain, where both parties and the agent can read it." },
  { n: "03", h: "Release in one click", p: "If the buyer is happy, the funds go to the seller. If the seller backs out, they return the money." },
  { n: "04", h: "Or call the agent", p: "If they disagree, either side disputes. The agent reads the work and pays the side the record supports." },
];

export default function EscrowApp() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const config = useConfig();
  const { writeContractAsync } = useWriteContract();
  const onBase = chainId === BASE_SEPOLIA_ID;

  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const { data: balData, refetch: refetchBal } = useReadContract({
    address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "balanceOf",
    args: address ? [address] : undefined, chainId: BASE_SEPOLIA_ID,
    query: { enabled: !!address, refetchInterval: 8000 },
  });

  const { data: countData, refetch: refetchCount } = useReadContract({
    address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: "dealCount",
    chainId: BASE_SEPOLIA_ID, query: { refetchInterval: 8000 },
  });
  const count = Number(countData ?? 0n);

  const { data: dealsData, refetch: refetchDeals } = useReadContracts({
    contracts: Array.from({ length: count }, (_, i) => ({
      address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: "getDeal" as const,
      args: [BigInt(i + 1)] as const, chainId: BASE_SEPOLIA_ID,
    })),
    query: { enabled: count > 0, refetchInterval: 8000 },
  });

  const allDeals = (dealsData ?? [])
    .map((r, i) => ({ id: i + 1, deal: normalizeDeal(r.result) as Deal | null }))
    .filter((x): x is { id: number; deal: Deal } => !!x.deal && x.deal.status !== 0);

  const myDeals = allDeals.filter((x) => sameAddr(x.deal.buyer, address) || sameAddr(x.deal.seller, address)).reverse();
  const settledExample = [...allDeals].reverse().find((x) => x.deal.status === 4);
  const totalLocked = allDeals.filter((x) => !TERMINAL.includes(x.deal.status)).reduce((s, x) => s + x.deal.amount, 0n);
  const settledCount = allDeals.filter((x) => x.deal.status === 4 || x.deal.status === 5).length;

  const hero = settledExample
    ? { id: settledExample.id, spec: settledExample.deal.spec, amount: settledExample.deal.amount, confidencePct: settledExample.deal.confidencePct || 99 }
    : EXAMPLE_FALLBACK;

  async function run(label: string, fn: () => Promise<void>) {
    setErr(null); setBusy(label);
    try { await fn(); }
    catch (e) { setErr((e instanceof Error ? e.message : "transaction failed").split("\n")[0].slice(0, 160)); }
    finally { setBusy(null); }
  }

  async function faucet() {
    if (!address) return;
    await run("faucet", async () => {
      const h = await writeContractAsync({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "mint", args: [address, parseUsdc("5000")], chainId: BASE_SEPOLIA_ID });
      await waitForTransactionReceipt(config, { hash: h });
      refetchBal();
    });
  }

  const [seller, setSeller] = useState("");
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("7");
  const [spec, setSpec] = useState("");
  const validSeller = /^0x[0-9a-fA-F]{40}$/.test(seller) && !sameAddr(seller, address);
  const canCreate = onBase && validSeller && parseUsdc(amount) > 0n && spec.trim().length > 8 && Number(days) > 0;

  async function createDeal() {
    if (!canCreate) return;
    await run("create", async () => {
      const amt = parseUsdc(amount);
      const ah = await writeContractAsync({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "approve", args: [ESCROW_ADDRESS, amt], chainId: BASE_SEPOLIA_ID });
      await waitForTransactionReceipt(config, { hash: ah });
      const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(days) * 86400);
      const ch = await writeContractAsync({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: "createDeal", args: [seller as `0x${string}`, amt, deadline, spec.trim()], chainId: BASE_SEPOLIA_ID });
      await waitForTransactionReceipt(config, { hash: ch });
      setSeller(""); setAmount(""); setSpec("");
      refetchCount(); refetchDeals(); refetchBal();
    });
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      {/* Hero */}
      <section className="relative overflow-hidden pt-12 sm:pt-16">
        <div className="pointer-events-none absolute -top-32 left-0 h-[520px] w-[760px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.16),transparent_65%)]" />
        <div className="relative grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[#AAB2C5]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#34D399]" /> Live on Base Sepolia
            </span>
            <h1 className="mt-5 max-w-xl font-serif text-[40px] font-medium leading-[1.04] tracking-tight text-white sm:text-[54px]">
              Escrow that settles its own disputes.
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-[#AAB2C5]">
              A buyer locks the payment against a brief and the seller delivers. When they disagree
              about the work, a Theseus agent reads the deliverable against the brief and settles it
              on chain in seconds. Cheaper, fairer, more transparent, and faster than any arbiter.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a href="#create" className="rounded-xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] px-5 py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_30px_rgba(99,102,241,0.35)] transition-shadow hover:shadow-[0_8px_44px_rgba(99,102,241,0.6)]">
                Create a deal
              </a>
              <Link href={`/escrow/${hero.id}`} className="rounded-xl border border-white/12 bg-white/[0.03] px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-white/[0.07]">
                See a live deal →
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
              {[
                { v: String(count), l: "deals created" },
                { v: String(settledCount), l: "settled by the agent" },
                { v: `${fmtUsdc(totalLocked)} ${USDC_SYMBOL}`, l: "currently in escrow" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="font-mono text-[20px] font-semibold text-white">{s.v}</div>
                  <div className="text-[11.5px] text-[#6B7488]">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          <HeroDealCard id={hero.id} spec={hero.spec} amount={hero.amount} confidencePct={hero.confidencePct} />
        </div>
      </section>

      {/* Why it's better */}
      <section className="mt-16 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {WHY.map((w) => (
          <div key={w.h} className={`${PANEL} p-5`}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#6366F1]/20 to-[#8B5CF6]/10 text-[#A5B0FF]">
              <Icon name={w.icon} />
            </div>
            <h3 className="mt-3 text-[15px] font-semibold text-white">{w.h}</h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#8A93A6]">{w.p}</p>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section id="how" className="mt-16 scroll-mt-20">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.15em] text-[#6B7488]">How a deal works</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className={`${PANEL} relative p-5`}>
              <span className="font-mono text-[24px] font-bold text-white/10">{s.n}</span>
              <h3 className="mt-1 text-[14.5px] font-semibold text-white">{s.h}</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#8A93A6]">{s.p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* App surface */}
      <section id="create" className="mt-16 scroll-mt-20">
        {!isConnected && (
          <div className={`${PANEL} flex flex-col items-center gap-4 px-6 py-12 text-center`}>
            <h2 className="text-[20px] font-semibold text-white">Take a deal start to finish</h2>
            <p className="max-w-md text-[13.5px] leading-relaxed text-[#AAB2C5]">
              Connect a wallet on Base Sepolia to create a deal or act on one. You&rsquo;ll need a little
              Base Sepolia ETH for gas from any public faucet, and you can mint {USDC_SYMBOL} once connected.
            </p>
            <ConnectControl size="lg" />
          </div>
        )}

        {isConnected && !onBase && (
          <div className={`${PANEL} flex items-center justify-between gap-3 px-5 py-4`}>
            <span className="text-[13.5px] text-[#FBBF24]">This app runs on Base Sepolia. Switch your wallet&rsquo;s network to continue.</span>
            <button onClick={() => switchChain({ chainId: BASE_SEPOLIA_ID })} className="shrink-0 rounded-xl bg-[#FBBF24] px-4 py-2 text-[13px] font-semibold text-black">Switch network</button>
          </div>
        )}

        {isConnected && onBase && (
          <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
            {/* Create */}
            <div className={`${PANEL} p-6`}>
              <div className="flex items-center justify-between">
                <h2 className="text-[16px] font-semibold text-white">Create a deal</h2>
                <button onClick={faucet} disabled={busy !== null} className="rounded-lg border border-[#6366F1]/30 bg-[#6366F1]/10 px-3 py-1.5 text-[12px] font-semibold text-[#A5B0FF] disabled:opacity-50">
                  {busy === "faucet" ? "Minting…" : `Faucet · +5,000 ${USDC_SYMBOL}`}
                </button>
              </div>
              <p className="mt-1 text-[12.5px] text-[#8A93A6]">
                You&rsquo;re the buyer · balance{" "}
                <span className="font-mono text-white">{fmtUsdc(balData as bigint | undefined)} {USDC_SYMBOL}</span>
              </p>
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-[12px] text-[#8A93A6]">Seller address</span>
                  <input value={seller} onChange={(e) => setSeller(e.target.value)} placeholder="0x…" className={`${INPUT} font-mono`} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-[12px] text-[#8A93A6]">Amount ({USDC_SYMBOL})</span>
                    <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="1000" className={`${INPUT} font-mono`} />
                  </label>
                  <label className="block">
                    <span className="text-[12px] text-[#8A93A6]">Deadline (days)</span>
                    <input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" className={`${INPUT} font-mono`} />
                  </label>
                </div>
                <label className="block">
                  <span className="text-[12px] text-[#8A93A6]">Brief / acceptance criteria</span>
                  <textarea value={spec} onChange={(e) => setSpec(e.target.value)} rows={3} placeholder="What the seller must deliver for the funds to release. Be specific; this is exactly what the agent scores against." className={`${INPUT} resize-y leading-relaxed`} />
                </label>
              </div>
              <button onClick={createDeal} disabled={!canCreate || busy !== null} className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] px-5 py-3 text-[14px] font-semibold text-white shadow-[0_8px_30px_rgba(99,102,241,0.3)] transition-shadow hover:shadow-[0_8px_40px_rgba(99,102,241,0.5)] disabled:opacity-40 disabled:shadow-none">
                {busy === "create" ? "Locking funds…" : "Lock funds & create deal"}
              </button>
              {err && <p className="mt-3 rounded-xl border border-[#F87171]/30 bg-[#F87171]/10 px-3 py-2 text-[12.5px] text-[#F87171]">{err}</p>}
            </div>

            {/* Your deals */}
            <div>
              <h2 className="mb-3 text-[14px] font-semibold text-white">Your deals</h2>
              {myDeals.length === 0 ? (
                <div className={`${PANEL} px-4 py-10 text-center text-[13px] text-[#6B7488]`}>
                  No deals yet. Create one, or have someone create one with your address as the seller.
                </div>
              ) : (
                <div className="space-y-2">
                  {myDeals.map(({ id, deal }) => (
                    <Link key={id} href={`/escrow/${id}`} className={`${PANEL} flex items-center gap-3 px-4 py-3 transition-colors hover:border-white/15 hover:bg-white/[0.05]`}>
                      <span className="font-mono text-[12px] text-[#6B7488]">#{id}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] text-white/90">{deal.spec || "(no brief)"}</p>
                        <p className="mt-0.5 text-[11px] text-[#6B7488]">{sameAddr(deal.buyer, address) ? "You" : shortAddr(deal.buyer)} → {sameAddr(deal.seller, address) ? "you" : shortAddr(deal.seller)}</p>
                      </div>
                      <span className="font-mono text-[12.5px] text-white">{fmtUsdc(deal.amount)}</span>
                      <StatusPill status={deal.status} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
