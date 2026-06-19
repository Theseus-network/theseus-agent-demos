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
  type Deal,
} from "@/lib/escrow/client";

const PANEL = "rounded-2xl border border-white/[0.07] bg-white/[0.03]";
const INPUT =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[13.5px] text-white outline-none transition-colors placeholder:text-[#6B7488] focus:border-[#6366F1]";

function Icon({ name }: { name: string }) {
  const c = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "cheaper") return <svg {...c}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.5 9.5a2.5 2 0 0 1 5 0c0 1.2-1 1.6-2.5 2s-2.5.8-2.5 2a2.5 2 0 0 0 5 0" /></svg>;
  if (name === "faster") return <svg {...c}><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>;
  if (name === "fairer") return <svg {...c}><path d="M12 3v18M5 7h14M7 7l-3 6a3 3 0 0 0 6 0zM17 7l3 6a3 3 0 0 1-6 0z" /></svg>;
  return <svg {...c}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>;
}

function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:54px_54px] [mask-image:radial-gradient(ellipse_60%_60%_at_40%_0%,black,transparent_75%)]" />
      <div className="absolute -top-40 -left-28 h-[520px] w-[520px] rounded-full bg-[#6366F1]/25 blur-[130px]" />
      <div className="absolute -top-28 right-0 h-[460px] w-[460px] rounded-full bg-[#8B5CF6]/20 blur-[130px]" />
      <div className="absolute top-44 left-1/3 h-[380px] w-[380px] rounded-full bg-[#22D3EE]/10 blur-[140px]" />
    </div>
  );
}

function ConfidenceRing({ pct }: { pct: number }) {
  const r = 24;
  const circ = 2 * Math.PI * r;
  const off = circ * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return (
    <svg width="62" height="62" viewBox="0 0 62 62" className="shrink-0">
      <circle cx="31" cy="31" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
      <circle cx="31" cy="31" r={r} fill="none" stroke="url(#cring)" strokeWidth="5" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off} transform="rotate(-90 31 31)" />
      <defs>
        <linearGradient id="cring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34D399" />
          <stop offset="1" stopColor="#6EE7B7" />
        </linearGradient>
      </defs>
      <text x="31" y="36" textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff">{pct}</text>
    </svg>
  );
}

function FlowIcon({ name }: { name: string }) {
  const c = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "buyer") return <svg {...c}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
  if (name === "lock") return <svg {...c}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
  if (name === "agent") return <svg {...c}><rect x="5" y="7" width="14" height="12" rx="3" /><path d="M9 12h.01M15 12h.01M12 3v4M8.5 19l-1 2M15.5 19l1 2" /></svg>;
  return <svg {...c}><circle cx="10" cy="8" r="4" /><path d="M3.5 21a7 7 0 0 1 12-4.9" /><path d="M16 18l2 2 4-4" /></svg>;
}

function FlowNode({ name, label, sub }: { name: string; label: string; sub: string }) {
  return (
    <div className="flex w-16 flex-col items-center gap-2 text-center sm:w-24">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#A5B0FF]">
        <FlowIcon name={name} />
      </div>
      <div>
        <div className="text-[12.5px] font-semibold text-white">{label}</div>
        <div className="text-[10.5px] text-[#6B7488]">{sub}</div>
      </div>
    </div>
  );
}

function FlowDiagram() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] px-6 py-9">
      <div className="absolute left-1/2 top-6 h-36 w-36 -translate-x-1/2 rounded-full bg-[#6366F1]/15 blur-3xl" />
      <div className="relative mx-auto max-w-md">
        {/* The agent: the judge, above the money path */}
        <div className="flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#6366F1]/50 bg-gradient-to-br from-[#6366F1]/30 to-[#8B5CF6]/20 text-white shadow-[0_0_34px_rgba(99,102,241,0.45)]">
            <FlowIcon name="agent" />
          </div>
          <div className="mt-2 text-[12.5px] font-semibold text-white">Agent</div>
          <div className="text-[10.5px] text-[#6B7488]">the judge, settles disputes</div>
          <div className="mt-2 h-7 w-px bg-gradient-to-b from-[#6366F1]/60 to-white/5" />
        </div>
        {/* The money path */}
        <div className="flex items-start justify-between">
          <FlowNode name="buyer" label="Buyer" sub="funds the deal" />
          <div className="mt-7 h-[2px] flex-1 rounded-full bg-gradient-to-r from-white/10 to-[#6366F1]/40" />
          <FlowNode name="lock" label="Escrow" sub="holds the money" />
          <div className="mt-7 h-[2px] flex-1 rounded-full bg-gradient-to-r from-[#6366F1]/40 to-white/10" />
          <FlowNode name="seller" label="Seller" sub="gets paid" />
        </div>
      </div>
    </div>
  );
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
  spec: "Write a product description for a 24oz stainless steel water bottle: three sentences, naming vacuum insulation and the capacity.",
  amount: 1_000_000_000n,
  confidencePct: 99,
};

function HeroDealCard({ id, spec, amount, confidencePct }: { id: number; spec: string; amount: bigint; confidencePct: number }) {
  const steps = ["Funded", "Delivered", "Disputed", "Settled"];
  return (
    <Link href={`/escrow/${id}`} className="group relative block">
      <div className="absolute -inset-3 rounded-[28px] bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.28),transparent_70%)] blur-xl" />
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

        <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#6366F1]/20 bg-[#6366F1]/[0.07] p-3.5">
          <div className="flex-1">
            <span className="font-mono text-[10.5px] uppercase tracking-wide text-[#A5B0FF]">Agent verdict</span>
            <div className="mt-1 text-[18px] font-bold leading-none text-[#34D399]">RELEASE</div>
            <span className="mt-1 block text-[11.5px] text-[#AAB2C5]">{fmtUsdc(amount)} {USDC_SYMBOL} to the seller</span>
          </div>
          <div className="flex flex-col items-center">
            <ConfidenceRing pct={confidencePct} />
            <span className="mt-0.5 text-[9.5px] uppercase tracking-wide text-[#6B7488]">confidence</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

const WHY = [
  { icon: "cheaper", h: "Cheaper", p: "No percentage fee" },
  { icon: "faster", h: "Faster", p: "Settled in seconds" },
  { icon: "fairer", h: "Fairer", p: "One rulebook, every deal" },
  { icon: "transparent", h: "Transparent", p: "Shows its reasoning" },
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
      <section className="relative pt-14 sm:pt-20">
        <HeroBackdrop />
        <div className="relative grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[#AAB2C5]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#34D399]" /> Live on Base Sepolia
            </span>
            <h1 className="mt-5 font-serif text-[42px] font-medium leading-[1.03] tracking-tight text-white sm:text-[56px]">
              Escrow that settles its own disputes.
            </h1>
            <p className="mt-5 max-w-md text-[16px] leading-relaxed text-[#AAB2C5]">
              The money is held safely until the work is done. If the two sides disagree, an agent
              reads it against the brief and pays the fair side, in seconds.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#create" className="rounded-xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] px-5 py-3 text-[14px] font-semibold text-white shadow-[0_8px_30px_rgba(99,102,241,0.35)] transition-shadow hover:shadow-[0_8px_44px_rgba(99,102,241,0.6)]">
                Create a deal
              </a>
              <Link href={`/escrow/${hero.id}`} className="text-[14px] font-medium text-[#AAB2C5] transition-colors hover:text-white">
                See a live deal →
              </Link>
            </div>
          </div>
          <HeroDealCard id={hero.id} spec={hero.spec} amount={hero.amount} confidencePct={hero.confidencePct} />
        </div>
      </section>

      {/* Why it's better — one compact bar */}
      <section className="mt-14 grid grid-cols-2 divide-x divide-y divide-white/[0.07] overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] sm:grid-cols-4 sm:divide-y-0">
        {WHY.map((w) => (
          <div key={w.h} className="flex items-center gap-3 p-4 sm:p-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#6366F1]/20 to-[#8B5CF6]/10 text-[#A5B0FF]">
              <Icon name={w.icon} />
            </span>
            <div>
              <div className="text-[13.5px] font-semibold text-white">{w.h}</div>
              <div className="text-[11.5px] text-[#6B7488]">{w.p}</div>
            </div>
          </div>
        ))}
      </section>

      {/* Flow */}
      <section className="mt-6">
        <FlowDiagram />
      </section>

      {/* App surface */}
      <section id="create" className="mt-14 scroll-mt-20">
        {!isConnected && (
          <div className={`${PANEL} flex flex-col items-center gap-4 px-6 py-12 text-center`}>
            <h2 className="font-serif text-[24px] font-medium text-white">Run a real deal.</h2>
            <p className="text-[13.5px] text-[#8A93A6]">Connect on Base Sepolia. Mint a test token here, ETH for gas from any faucet.</p>
            <ConnectControl size="lg" />
          </div>
        )}

        {isConnected && !onBase && (
          <div className={`${PANEL} flex items-center justify-between gap-3 px-5 py-4`}>
            <span className="text-[13.5px] text-[#FBBF24]">Switch your wallet to Base Sepolia to continue.</span>
            <button onClick={() => switchChain({ chainId: BASE_SEPOLIA_ID })} className="shrink-0 rounded-xl bg-[#FBBF24] px-4 py-2 text-[13px] font-semibold text-black">Switch network</button>
          </div>
        )}

        {isConnected && onBase && (
          <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
            <div className={`${PANEL} p-6`}>
              <div className="flex items-center justify-between">
                <h2 className="text-[16px] font-semibold text-white">New deal</h2>
                <button onClick={faucet} disabled={busy !== null} className="rounded-lg border border-[#6366F1]/30 bg-[#6366F1]/10 px-3 py-1.5 text-[12px] font-semibold text-[#A5B0FF] disabled:opacity-50">
                  {busy === "faucet" ? "Minting…" : `Faucet +5,000`}
                </button>
              </div>
              <p className="mt-1 text-[12px] text-[#6B7488]">Balance <span className="font-mono text-white">{fmtUsdc(balData as bigint | undefined)} {USDC_SYMBOL}</span></p>
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-[12px] text-[#8A93A6]">Seller address</span>
                  <input value={seller} onChange={(e) => setSeller(e.target.value)} placeholder="0x…" className={`${INPUT} font-mono`} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-[12px] text-[#8A93A6]">Amount</span>
                    <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="1000" className={`${INPUT} font-mono`} />
                  </label>
                  <label className="block">
                    <span className="text-[12px] text-[#8A93A6]">Days</span>
                    <input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" className={`${INPUT} font-mono`} />
                  </label>
                </div>
                <label className="block">
                  <span className="text-[12px] text-[#8A93A6]">Brief</span>
                  <textarea value={spec} onChange={(e) => setSpec(e.target.value)} rows={3} placeholder="What the seller must deliver. This is what the agent scores against." className={`${INPUT} resize-y leading-relaxed`} />
                </label>
              </div>
              <button onClick={createDeal} disabled={!canCreate || busy !== null} className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] px-5 py-3 text-[14px] font-semibold text-white shadow-[0_8px_30px_rgba(99,102,241,0.3)] transition-shadow hover:shadow-[0_8px_40px_rgba(99,102,241,0.5)] disabled:opacity-40 disabled:shadow-none">
                {busy === "create" ? "Locking funds…" : "Lock funds & create"}
              </button>
              {err && <p className="mt-3 rounded-xl border border-[#F87171]/30 bg-[#F87171]/10 px-3 py-2 text-[12.5px] text-[#F87171]">{err}</p>}
            </div>

            <div>
              <h2 className="mb-3 text-[14px] font-semibold text-white">Your deals</h2>
              {myDeals.length === 0 ? (
                <div className={`${PANEL} px-4 py-10 text-center text-[13px] text-[#6B7488]`}>None yet.</div>
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
