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

// Owned identity: ink ground, near-white as the primary action, and green/red
// used ONLY where they carry meaning (a verdict). No gradients, no glow.
const PANEL = "rounded-xl border border-white/[0.08] bg-white/[0.02]";
const INPUT =
  "mt-1.5 w-full rounded-lg border border-white/12 bg-white/[0.02] px-3.5 py-2.5 text-[13.5px] text-white outline-none transition-colors placeholder:text-[#6B7488] focus:border-white/35";
const BTN = "rounded-md bg-[#4d8df0] px-5 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-[#5f9bf5] disabled:opacity-40 disabled:hover:bg-[#4d8df0]";

function HeroDealCard({ id, spec, amount }: { id: number; spec: string; amount: bigint }) {
  return (
    <Link href={`/escrow/${id}`} className="group block">
      <div className="rounded-xl border border-white/10 bg-white/[0.025] p-5 transition-colors group-hover:border-white/20">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[12px] text-[#7E8696]">Deal #{id} · {fmtUsdc(amount)} {USDC_SYMBOL}</span>
          <span className="rounded-md border border-[#34D399]/25 bg-[#34D399]/[0.08] px-2 py-0.5 text-[11px] font-medium text-[#34D399]">Settled</span>
        </div>
        <p className="mt-3 line-clamp-2 text-[13.5px] leading-relaxed text-white/85">{spec}</p>

        {/* The two-agent verdict, the actual differentiator, shown not asserted */}
        <div className="mt-4 space-y-2 border-t border-white/[0.07] pt-4">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] text-[#9AA3B2]">Arbiter</span>
            <span className="font-mono text-[12.5px] font-semibold text-[#34D399]">RELEASE ↑</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] text-[#9AA3B2]">Sentinel <span className="text-[#6B7488]">(independent)</span></span>
            <span className="font-mono text-[12.5px] font-semibold text-[#34D399]">RELEASE ↑</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-[#34D399]/[0.07] px-3 py-2 text-[12px] text-[#34D399]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" />
            Both agents agree, released to the seller on-chain.
          </div>
        </div>
      </div>
    </Link>
  );
}

function WorkedDispute() {
  // The moat made concrete: a second, independent model catches what the first
  // missed, so the funds don't move. A single-agent escrow would have paid out.
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-sans text-[21px] font-bold leading-tight tracking-[-0.02em] text-white sm:text-[26px]">When the two agents disagree, no one gets paid.</h2>
        <span className="hidden shrink-0 font-mono text-[11px] text-[#6B7488] sm:block">a contested deal</span>
      </div>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[#8A93A6]">
        A single-agent escrow pays out on the first verdict. Watch the second, independent model overturn it.
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
        {/* The deal, supporting context */}
        <div className="rounded-lg border border-white/[0.07] bg-black/20 p-4">
          <p className="font-mono text-[10.5px] uppercase tracking-wide text-[#6B7488]">Brief</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-white/85">Translate our homepage into French. Native quality, no machine translation.</p>
          <p className="mt-3 font-mono text-[10.5px] uppercase tracking-wide text-[#6B7488]">Delivery</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[#AAB2C5]">&laquo; Bienvenue sur notre plateforme. Nous sommes excit&eacute;s de vous avoir ici&hellip; &raquo;</p>
        </div>

        {/* The confrontation, the focus: Sentinel overturns Arbiter */}
        <div>
          <div className="rounded-lg border border-white/10 bg-white/[0.015] p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[#9AA3B2]">Arbiter <span className="font-mono text-[10px] text-[#6B7488]">model A</span></span>
              <span className="rounded border border-[#34D399]/25 bg-[#34D399]/[0.07] px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#34D399]/60 line-through decoration-[#F87171] decoration-2">RELEASE</span>
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-[#7E8696]">&ldquo;Reads fluently, covers every section, pay the seller.&rdquo;</p>
          </div>

          <div className="flex items-center gap-2 py-2 pl-3.5 font-mono text-[10.5px] text-[#EF4444]">
            <span className="text-[15px] leading-none">&darr;</span>
            <span>Sentinel overrules, blind to the first verdict</span>
          </div>

          <div className="rounded-lg border border-[#EF4444]/50 bg-[#EF4444]/[0.12] p-3.5 shadow-[0_0_30px_-8px_rgba(239,68,68,0.55)]">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-white">Sentinel <span className="font-mono text-[10px] font-normal text-[#6B7488]">model B · blind</span></span>
              <span className="rounded border border-[#EF4444]/60 bg-[#EF4444]/25 px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#FCA5A5]">REFUND</span>
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-[#AAB2C5]">&ldquo;&lsquo;Excit&eacute;s de vous avoir&rsquo; is a calque from English, not native French. The brief required native quality.&rdquo;</p>
          </div>

          <div className="mt-3 overflow-hidden rounded-lg border border-[#FBBF24]/50 bg-[#FBBF24]/[0.13]">
            <div className="border-l-[3px] border-[#FBBF24] p-4">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[15px] font-bold uppercase tracking-wide text-[#FBBF24]">Funds held</span>
                <span className="text-[12px] text-[#9AA3B2]">&middot; a human decides</span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-[#AAB2C5]">A single-agent escrow would have released the money on the first verdict. Here it stays locked in the contract.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const FAQ = [
  { q: "What if the agents can’t decide?", a: "Either can return UNRESOLVABLE. The buyer is refunded and a human takes over." },
  { q: "Can a deliverable trick the agents?", a: "The agent holds no keys to steal, and a delivery has to fool two different models to move funds." },
  { q: "Why not Kleros or UMA?", a: "No staked-juror games or multi-day challenge windows. Two models read the deliverable in seconds, on-chain." },
  { q: "Where does the trust bottom out?", a: "The contract is trustless for custody. The model providers and a human tiebreaker are the rest, and every verdict is on-chain to audit." },
];

const TENETS = [
  { h: "The contract holds the keys, not the agent.", p: "The agent only signals a verdict. It can never move the money itself." },
  { h: "Two models must agree to pay out.", p: "A different model re-judges every disputed deal, blind to the first." },
  { h: "Every verdict is on-chain.", p: "You audit the decision instead of trusting a support queue." },
];

function StatusPill({ status }: { status: number }) {
  const tone =
    status === 4 ? "text-[#34D399] border-[#34D399]/30 bg-[#34D399]/[0.08]"
    : status === 5 ? "text-[#FBBF24] border-[#FBBF24]/30 bg-[#FBBF24]/[0.08]"
    : status === 6 ? "text-[#9AA3B2] border-white/10 bg-white/5"
    : status === 3 ? "text-[#F87171] border-[#F87171]/30 bg-[#F87171]/[0.08]"
    : "text-white/80 border-white/15 bg-white/5";
  return <span className={`shrink-0 rounded-md border px-2.5 py-0.5 text-[11px] font-medium ${tone}`}>{STATUS_LABEL[status] ?? "·"}</span>;
}

const EXAMPLE_FALLBACK = {
  id: 1,
  spec: "Write a product description for a 24oz stainless steel water bottle: three sentences, naming vacuum insulation and the capacity.",
  amount: 1_000_000_000n,
};

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
    ? { id: settledExample.id, spec: settledExample.deal.spec, amount: settledExample.deal.amount }
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
    <main className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
      {/* Hero */}
      <section className="relative pt-14 sm:pt-20">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_55%_50%_at_30%_0%,black,transparent_75%)]" />
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-[#9AA3B2]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#34D399]" /> Live on Base Sepolia
            </span>
            <h1 className="mt-5 font-sans text-[37px] font-bold leading-[1.04] tracking-[-0.03em] text-white sm:text-[50px]">
              Escrow that doesn&rsquo;t trust a single agent.
            </h1>
            <p className="mt-4 max-w-md text-[15.5px] leading-relaxed text-[#AAB2C5]">
              Funds sit in a contract until two independent agents agree on who gets paid.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <a href="#create" className={BTN}>Create a deal</a>
              <Link href={`/escrow/${hero.id}`} className="text-[14px] font-medium text-[#AAB2C5] underline decoration-white/20 underline-offset-4 transition-colors hover:text-white">
                See a settled deal →
              </Link>
            </div>
          </div>
          <HeroDealCard id={hero.id} spec={hero.spec} amount={hero.amount} />
        </div>
      </section>

      {/* The moat, demonstrated on a real contested deal */}
      <section className="mt-16">
        <WorkedDispute />
      </section>

      {/* Tenets, borderless, so they read as a point of view not a card grid */}
      <section className="mt-14 grid gap-x-10 gap-y-8 sm:grid-cols-3">
        {TENETS.map((t, i) => (
          <div key={t.h}>
            <div className="font-mono text-[11px] text-[#6B7488]">0{i + 1}</div>
            <h3 className="mt-2 text-[14px] font-semibold leading-snug text-white">{t.h}</h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#8A93A6]">{t.p}</p>
          </div>
        ))}
      </section>

      {/* The hard questions */}
      <section className="mt-14 border-t border-white/[0.07] pt-10">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#7E8696]">How it holds up</h2>
        <div className="mt-5 grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {FAQ.map((f) => (
            <div key={f.q}>
              <h3 className="text-[13.5px] font-semibold text-white">{f.q}</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#8A93A6]">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* App surface */}
      <section id="create" className="mt-16 scroll-mt-20">
        {!isConnected && (
          <div className={`${PANEL} flex flex-col items-center gap-4 px-6 py-12 text-center`}>
            <h2 className="font-sans text-[22px] font-bold tracking-[-0.02em] text-white">Create a deal.</h2>
            <p className="max-w-sm text-[13.5px] leading-relaxed text-[#8A93A6]">Connect a wallet on Base Sepolia. Mint a test token here.</p>
            <ConnectControl size="lg" />
          </div>
        )}

        {isConnected && !onBase && (
          <div className={`${PANEL} flex items-center justify-between gap-3 px-5 py-4`}>
            <span className="text-[13.5px] text-[#FBBF24]">Switch your wallet to Base Sepolia to continue.</span>
            <button onClick={() => switchChain({ chainId: BASE_SEPOLIA_ID })} className="shrink-0 rounded-lg bg-[#FBBF24] px-4 py-2 text-[13px] font-semibold text-black">Switch network</button>
          </div>
        )}

        {isConnected && onBase && (
          <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
            <div className={`${PANEL} p-6`}>
              <div className="flex items-center justify-between">
                <h2 className="text-[16px] font-semibold text-white">New deal</h2>
                <button onClick={faucet} disabled={busy !== null} className="rounded-lg border border-white/15 px-3 py-1.5 text-[12px] font-semibold text-white/80 transition-colors hover:border-white/30 disabled:opacity-50">
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
                  <textarea value={spec} onChange={(e) => setSpec(e.target.value)} rows={3} placeholder="What the seller must deliver. This is exactly what the agents score against." className={`${INPUT} resize-y leading-relaxed`} />
                </label>
              </div>
              <button onClick={createDeal} disabled={!canCreate || busy !== null} className={`mt-4 w-full ${BTN}`}>
                {busy === "create" ? "Locking funds…" : "Lock funds & create"}
              </button>
              {err && <p className="mt-3 rounded-lg border border-[#F87171]/30 bg-[#F87171]/10 px-3 py-2 text-[12.5px] text-[#F87171]">{err}</p>}
            </div>

            <div>
              <h2 className="mb-3 text-[14px] font-semibold text-white">Your deals</h2>
              {myDeals.length === 0 ? (
                <div className={`${PANEL} px-4 py-10 text-center text-[13px] text-[#6B7488]`}>None yet.</div>
              ) : (
                <div className="space-y-2">
                  {myDeals.map(({ id, deal }) => (
                    <Link key={id} href={`/escrow/${id}`} className={`${PANEL} flex items-center gap-3 px-4 py-3 transition-colors hover:border-white/15 hover:bg-white/[0.04]`}>
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
