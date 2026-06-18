"use client";

import { useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
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
import { basescanAddressUrl } from "@/lib/deployed-contracts";

function StatusPill({ status }: { status: number }) {
  const tone =
    status === 4 ? "text-green border-green/40 bg-green/10"
    : status === 5 ? "text-amber border-amber/40 bg-amber/10"
    : status === 6 ? "text-fg-mute border-border bg-surface"
    : status === 3 ? "text-red border-red/40 bg-red/10"
    : "text-coral border-coral/40 bg-coral/10";
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      {STATUS_LABEL[status] ?? "—"}
    </span>
  );
}

/** Indigo-themed connect control so it matches the rest of the app. */
function ConnectControl() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openChainModal, openAccountModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;
        const cls =
          "rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors";
        if (!ready) return <div className="h-9 w-32" />;
        if (!connected)
          return (
            <button onClick={openConnectModal} className={`${cls} bg-coral text-white hover:bg-coral-dim`}>
              Connect wallet
            </button>
          );
        if (chain.id !== BASE_SEPOLIA_ID)
          return (
            <button onClick={openChainModal} className={`${cls} bg-amber text-black`}>
              Wrong network
            </button>
          );
        return (
          <button onClick={openAccountModal} className={`${cls} border border-border text-fg hover:border-coral/50`}>
            {account.displayName}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}

const STEPS = [
  { n: "01", h: "Lock the payment", p: "The buyer funds a deal in the contract against a written brief. The money sits in escrow, not with either side." },
  { n: "02", h: "Deliver the work", p: "The seller submits the deliverable on chain, where both parties and the agent can read it." },
  { n: "03", h: "Settle the easy way", p: "If the buyer is happy, one click pays the seller. If the seller backs out, they return the money to the buyer." },
  { n: "04", h: "Or call the agent", p: "If they disagree, either side opens a dispute. The agent reads the work against the brief and pays the side the record supports, or refunds the buyer when the brief is too vague to call." },
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

  const myDeals = allDeals
    .filter((x) => sameAddr(x.deal.buyer, address) || sameAddr(x.deal.seller, address))
    .reverse();

  const settledExample = [...allDeals].reverse().find((x) => x.deal.status === 4);
  const totalLocked = allDeals
    .filter((x) => !TERMINAL.includes(x.deal.status))
    .reduce((s, x) => s + x.deal.amount, 0n);
  const settledCount = allDeals.filter((x) => x.deal.status === 4 || x.deal.status === 5).length;

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

  const inputCls = "mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-[13px] text-fg outline-none focus:border-coral/60";

  return (
    <main className="mx-auto max-w-5xl px-3 pb-20 pt-8 sm:px-5">
      {/* Hero */}
      <section className="rounded-2xl border border-border bg-surface/40 p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-coral">Theseus Escrow</p>
          <ConnectControl />
        </div>
        <h1 className="mt-2 max-w-2xl font-serif text-[28px] leading-[1.1] tracking-tight text-fg sm:text-[38px]">
          Escrow that settles its own disputes.
        </h1>
        <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-fg-dim">
          A buyer locks the payment against a written brief and the seller delivers. If the buyer is
          happy, one click pays out. If the two sides disagree about whether the work is good, a
          Theseus agent reads the deliverable against the brief and decides who gets paid. It runs on
          Base Sepolia with a faucet token, so you can take a real deal from start to finish.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[12px] text-fg-mute">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--green)" }} />
            Live on Base Sepolia
          </span>
          <span><span className="text-fg">{count}</span> {count === 1 ? "deal" : "deals"}</span>
          <span><span className="text-fg">{fmtUsdc(totalLocked)}</span> {USDC_SYMBOL} in escrow</span>
          <a href={basescanAddressUrl(ESCROW_ADDRESS)} target="_blank" rel="noopener noreferrer" className="text-coral hover:underline">Contract ↗</a>
        </div>
      </section>

      {/* How it works */}
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <div key={s.n} className="rounded-xl border border-border bg-surface/40 p-4">
            <span className="font-mono text-[12px] font-semibold text-coral">{s.n}</span>
            <h3 className="mt-1.5 text-[14px] font-semibold text-fg">{s.h}</h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-fg-dim">{s.p}</p>
          </div>
        ))}
      </section>

      {/* Live example */}
      {settledExample && (
        <Link href={`/escrow/${settledExample.id}`} className="mt-6 block rounded-xl border border-green/30 bg-green/5 p-5 transition-colors hover:border-green/50">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wide text-green">A real settled deal</span>
            <span className="font-mono text-[11px] text-fg-mute">#{settledExample.id}</span>
          </div>
          <p className="mt-2 line-clamp-2 text-[14px] text-fg">{settledExample.deal.spec}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-fg-mute">
            <span><span className="font-mono text-fg">{fmtUsdc(settledExample.deal.amount)} {USDC_SYMBOL}</span> released to the seller</span>
            {settledExample.deal.confidencePct > 0 && <span>agent confidence {settledExample.deal.confidencePct}%</span>}
            <span className="text-coral">See the deal →</span>
          </div>
        </Link>
      )}

      {/* Connect / network gates */}
      {!isConnected && (
        <p className="mt-6 rounded-xl border border-border bg-surface/40 px-5 py-4 text-[13.5px] text-fg-dim">
          Connect a wallet on Base Sepolia to create a deal or act on one. You&rsquo;ll need a little
          Base Sepolia ETH for gas from any public faucet, and you can mint {USDC_SYMBOL} below once connected.
        </p>
      )}
      {isConnected && !onBase && (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-[13px] text-amber">
          <span>This app runs on Base Sepolia. Switch your wallet&rsquo;s network to continue.</span>
          <button onClick={() => switchChain({ chainId: BASE_SEPOLIA_ID })} className="shrink-0 rounded-lg bg-amber px-3 py-1.5 text-[12.5px] font-semibold text-black">Switch network</button>
        </div>
      )}

      {isConnected && onBase && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface/40 px-4 py-3">
            <span className="text-[13px] text-fg-dim">Your balance</span>
            <span className="font-mono text-[15px] font-semibold text-fg">{fmtUsdc(balData as bigint | undefined)} {USDC_SYMBOL}</span>
            <button onClick={faucet} disabled={busy !== null} className="ml-auto rounded-lg border border-coral/40 bg-coral/10 px-3 py-1.5 text-[12.5px] font-semibold text-coral disabled:opacity-50">
              {busy === "faucet" ? "Minting…" : `Faucet · +5,000 ${USDC_SYMBOL}`}
            </button>
          </div>

          <section className="mt-4 rounded-xl border border-border bg-surface/40 p-5">
            <h2 className="text-[15px] font-semibold text-fg">Create a deal</h2>
            <p className="mt-1 text-[12.5px] text-fg-dim">You&rsquo;re the buyer. Your funds lock now and release to the seller only when you accept the work or the agent rules for them.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-[12px] text-fg-mute">Seller address</span>
                <input value={seller} onChange={(e) => setSeller(e.target.value)} placeholder="0x…" className={`${inputCls} font-mono`} />
              </label>
              <label className="block">
                <span className="text-[12px] text-fg-mute">Amount ({USDC_SYMBOL})</span>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="1000" className={`${inputCls} font-mono`} />
              </label>
              <label className="block">
                <span className="text-[12px] text-fg-mute">Deadline (days)</span>
                <input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" className={`${inputCls} font-mono`} />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[12px] text-fg-mute">Brief / acceptance criteria</span>
                <textarea value={spec} onChange={(e) => setSpec(e.target.value)} rows={3} placeholder="What the seller must deliver for the funds to release. Be specific; this is exactly what the agent scores against." className={`${inputCls} resize-y leading-relaxed`} />
              </label>
            </div>
            <button onClick={createDeal} disabled={!canCreate || busy !== null} className="mt-4 rounded-lg bg-coral px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-coral-dim disabled:opacity-50">
              {busy === "create" ? "Locking funds…" : "Lock funds & create deal"}
            </button>
            {err && <p className="mt-3 rounded-lg border border-red/40 bg-red/10 px-3 py-2 text-[12.5px] text-red">{err}</p>}
          </section>

          <section className="mt-6">
            <h2 className="mb-3 text-[15px] font-semibold text-fg">Your deals</h2>
            {myDeals.length === 0 ? (
              <p className="rounded-xl border border-border bg-surface/40 px-4 py-6 text-center text-[13px] text-fg-mute">No deals yet. Create one above, or have someone create one with your address as the seller.</p>
            ) : (
              <div className="space-y-2">
                {myDeals.map(({ id, deal }) => (
                  <Link key={id} href={`/escrow/${id}`} className="flex items-center gap-3 rounded-xl border border-border bg-surface/40 px-4 py-3 transition-colors hover:border-coral/40">
                    <span className="font-mono text-[12px] text-fg-mute">#{id}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] text-fg">{deal.spec || "(no brief)"}</p>
                      <p className="mt-0.5 text-[11.5px] text-fg-mute">
                        {sameAddr(deal.buyer, address) ? "You" : shortAddr(deal.buyer)} → {sameAddr(deal.seller, address) ? "you" : shortAddr(deal.seller)}
                      </p>
                    </div>
                    <span className="font-mono text-[13px] text-fg">{fmtUsdc(deal.amount)} {USDC_SYMBOL}</span>
                    <StatusPill status={deal.status} />
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
