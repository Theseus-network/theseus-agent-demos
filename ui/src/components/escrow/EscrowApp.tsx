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
import { AgentMark } from "./AgentMark";
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

const BRIEF_LIMIT = 600;

// Starting points so a buyer doesn't face a blank box. The [brackets] are theirs
// to fill in. They can also ignore these and write their own.
const BRIEF_TEMPLATES: { label: string; text: string }[] = [
  { label: "Logo", text: "Design a logo for [brand]. Deliver three concepts, then the chosen one as SVG and PNG with a transparent background. Brand colors: [hex]. No stock icons." },
  { label: "Article", text: "Write a 900 to 1,100 word article on [topic] for a general audience. Clear headline, an intro, three to five sections with subheads, and at least three cited sources with links." },
  { label: "Landing page", text: "Build a one-page site for [product] from the copy I attach. Responsive, loads in under two seconds, deployed to a live URL. Match these brand colors: [hex]." },
  { label: "Translation", text: "Translate the attached text into [language]. Native quality, no machine translation. Keep the tone, and leave product names unchanged." },
  { label: "Code", text: "Write a [language] function that [does X]. Handle bad input, add a short docstring, and include one usage example." },
];

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
            <span className="flex items-center gap-1.5 text-[12.5px] text-[#9AA3B2]"><AgentMark name="arbiter" className="h-4 w-4 text-[#8A93A6]" />Arbiter</span>
            <span className="font-mono text-[12.5px] font-semibold text-[#34D399]">RELEASE ↑</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[12.5px] text-[#9AA3B2]"><AgentMark name="sentinel" className="h-4 w-4 text-[#8A93A6]" />Sentinel <span className="text-[#6B7488]">(independent)</span></span>
            <span className="font-mono text-[12.5px] font-semibold text-[#34D399]">RELEASE ↑</span>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-lg bg-[#34D399]/[0.07] px-3 py-2 text-[12px] text-[#34D399]">
            <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" />Both agents agree, paid the seller.</span>
            <span className="text-[#34D399]/70 opacity-0 transition-opacity group-hover:opacity-100">Open deal &rarr;</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// The other half of the story the hero card can't tell: the agent ruling against
// the seller and sending the money back. This is the verdict pattern, drawn from
// the worked dispute on the how-it-works page, not a specific on-chain receipt.
function RefundedReceipt() {
  return (
    <Link href="/escrow/how-it-works" className="group block">
      <div className="rounded-xl border border-white/10 bg-white/[0.025] p-5 transition-colors group-hover:border-white/20">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[12px] text-[#7E8696]">Translation deal · 1,200 {USDC_SYMBOL}</span>
          <span className="rounded-md border border-[#EF4444]/25 bg-[#EF4444]/[0.08] px-2 py-0.5 text-[11px] font-medium text-[#EF4444]">Refunded</span>
        </div>
        <p className="mt-3 text-[13.5px] leading-relaxed text-white/85">A native-quality French translation of the homepage. No machine translation.</p>

        <div className="mt-4 space-y-2 border-t border-white/[0.07] pt-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[12.5px] text-[#9AA3B2]"><AgentMark name="arbiter" className="h-4 w-4 text-[#8A93A6]" />Arbiter</span>
            <span className="font-mono text-[12.5px] font-semibold text-[#EF4444]">REFUND</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[12.5px] text-[#9AA3B2]"><AgentMark name="sentinel" className="h-4 w-4 text-[#8A93A6]" />Sentinel <span className="text-[#6B7488]">(independent)</span></span>
            <span className="font-mono text-[12.5px] font-semibold text-[#EF4444]">REFUND</span>
          </div>
          <p className="pt-0.5 text-[12px] italic leading-relaxed text-[#8A93A6]">&ldquo;&lsquo;Excit&eacute;s de vous avoir&rsquo; is a calque from English, not native French.&rdquo;</p>
          <div className="mt-1 flex items-center justify-between gap-2 rounded-lg bg-[#4d8df0]/[0.08] px-3 py-2 text-[12px] text-[#9DC1F5]">
            <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#4d8df0]" />Brief not met, refunded to the buyer.</span>
            <span className="text-[#7badf5] opacity-0 transition-opacity group-hover:opacity-100">Read the ruling &rarr;</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// A still of the actual create form, so the closing CTA mirrors the product cards
// above it instead of stranding the button in empty space.
function NewDealPreview() {
  const Field = ({ label, value }: { label: string; value: string }) => (
    <div>
      <div className="text-[11px] text-[#8A93A6]">{label}</div>
      <div className="mt-1 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 font-mono text-[12px] text-[#6B7488]">{value}</div>
    </div>
  );
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-white">New deal</span>
        <span className="rounded-md border border-white/12 px-2 py-0.5 text-[11px] text-[#9AA3B2]">Faucet +5,000</span>
      </div>
      <div className="mt-4 space-y-3">
        <Field label="Seller address" value="0x…" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount" value="1,000" />
          <Field label="Days" value="7" />
        </div>
        <div>
          <div className="text-[11px] text-[#8A93A6]">Brief</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {BRIEF_TEMPLATES.map((t) => (
              <span key={t.label} className="rounded-md border border-white/12 px-2 py-0.5 text-[11px] text-white/70">{t.label}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

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
    <main className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      {/* Hero */}
      <section className="relative pt-14 sm:pt-20">
        <div className="pointer-events-none absolute inset-x-0 -top-14 z-0 h-[460px] overflow-hidden sm:-top-20">
          <div className="absolute inset-0 bg-cover bg-center opacity-95" style={{ backgroundImage: "url('/hero-escrow.png')" }} />
          <div className="absolute inset-0 bg-gradient-to-b from-[#080a12]/60 via-transparent to-[#080a12]" />
        </div>
        <div className="relative z-10 grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="inline-flex items-center gap-2 text-[12px] text-[#8A93A6]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" /> Live on Base Sepolia
            </span>
            <h1 className="mt-5 font-sans text-[37px] font-bold leading-[1.04] tracking-[-0.03em] text-white sm:text-[50px]">
              Pay only when the work is right.
            </h1>
            <p className="mt-4 max-w-md text-[15.5px] leading-relaxed text-[#AAB2C5]">
              Your money is locked in the contract and releases only when the work matches your brief. If there&rsquo;s a dispute, an agent settles it in seconds for the cost of gas.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <a href="#create" className={BTN}>Create a deal</a>
              <Link href={`/escrow/${hero.id}`} className="text-[14px] font-medium text-[#AAB2C5] underline decoration-white/20 underline-offset-4 transition-colors hover:text-white">
                See a settled deal →
              </Link>
            </div>
            <p className="mt-4 text-[12.5px] text-[#6B7488]">Free to try on testnet. Connect a wallet and you can lock a deal in about a minute.</p>
            <p className="mt-2 text-[12.5px] text-[#6B7488]">escrow.com charges 3.25%. This costs about the price of gas.</p>
          </div>
          <HeroDealCard id={hero.id} spec={hero.spec} amount={hero.amount} />
        </div>
      </section>

      {/* Fair both ways, shown not asserted: the agent protecting the buyer */}
      <section className="mt-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_0.88fr]">
          <div>
            <h2 className="font-sans text-[25px] font-bold leading-[1.14] tracking-[-0.02em] text-white sm:text-[31px]">
              The agent pays out to whoever is right.
            </h2>
            <p className="mt-5 max-w-md text-[14.5px] leading-relaxed text-[#9AA3B2]">
              An agent reads the delivery against your brief, and a second, independent model checks the verdict before any
              money moves. Every ruling is written on-chain, so you can open one and read exactly why it landed where it did.
            </p>
            <p className="mt-4 max-w-md text-[14.5px] leading-relaxed text-[#9AA3B2]">
              When a brief is too vague to call fairly, the agent refuses to guess and your money comes back. Until a deal
              settles it sits in the contract, out of everyone&rsquo;s reach, for about the price of gas.
            </p>
            <Link href="/escrow/how-it-works" className="mt-6 inline-block text-[13.5px] font-medium text-[#4d8df0] transition-colors hover:text-[#7badf5]">
              See exactly how it works &rarr;
            </Link>
          </div>
          <RefundedReceipt />
        </div>
      </section>

      {/* App surface */}
      <section id="create" className="mt-16 scroll-mt-20">
        {!isConnected && (
          <div className="grid items-center gap-12 border-t border-white/[0.06] pt-14 lg:grid-cols-[1fr_0.88fr]">
            <div>
              <h2 className="font-sans text-[26px] font-bold tracking-[-0.02em] text-white sm:text-[32px]">Lock your first deal.</h2>
              <p className="mt-4 max-w-md text-[14px] leading-relaxed text-[#8A93A6]">Connect a wallet on Base Sepolia, write a brief, and lock the funds. The faucet hands you testnet tokens, so it costs nothing to try.</p>
              <div className="mt-6"><ConnectControl size="lg" /></div>
              <p className="mt-5 text-[12.5px] leading-relaxed text-[#6B7488]">The contract holds the funds the whole time. The agent only ever rules; it never touches the money.</p>
            </div>
            <NewDealPreview />
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
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#8A93A6]">Brief</span>
                    <span className="text-[11px] tabular-nums text-[#6B7488]">{spec.length}/{BRIEF_LIMIT}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-[#6B7488]">Start from</span>
                    {BRIEF_TEMPLATES.map((t) => (
                      <button
                        key={t.label}
                        type="button"
                        onClick={() => setSpec(t.text.slice(0, BRIEF_LIMIT))}
                        className="rounded-md border border-white/12 px-2 py-0.5 text-[11.5px] text-white/80 transition-colors hover:border-white/30"
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <textarea value={spec} onChange={(e) => setSpec(e.target.value.slice(0, BRIEF_LIMIT))} maxLength={BRIEF_LIMIT} rows={4} placeholder="What the seller must deliver, and how you'll know it's done. Keep it specific." className={`${INPUT} mt-1.5 resize-y leading-relaxed`} />
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
