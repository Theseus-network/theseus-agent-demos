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
  type Deal,
} from "@/lib/escrow/client";

function StatusPill({ status }: { status: number }) {
  const tone =
    status === 4 ? "text-green border-green/40 bg-green/10"
    : status === 5 ? "text-amber border-amber/40 bg-amber/10"
    : status === 6 ? "text-fg-mute border-border bg-surface"
    : status === 3 ? "text-red border-red/40 bg-red/10"
    : "text-coral border-coral/40 bg-coral/10";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      {STATUS_LABEL[status] ?? "—"}
    </span>
  );
}

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
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: BASE_SEPOLIA_ID,
    query: { enabled: !!address, refetchInterval: 8000 },
  });

  const { data: countData, refetch: refetchCount } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: ESCROW_ABI,
    functionName: "dealCount",
    chainId: BASE_SEPOLIA_ID,
    query: { refetchInterval: 8000 },
  });
  const count = Number(countData ?? 0n);

  const { data: dealsData, refetch: refetchDeals } = useReadContracts({
    contracts: Array.from({ length: count }, (_, i) => ({
      address: ESCROW_ADDRESS,
      abi: ESCROW_ABI,
      functionName: "getDeal" as const,
      args: [BigInt(i + 1)] as const,
      chainId: BASE_SEPOLIA_ID,
    })),
    query: { enabled: count > 0, refetchInterval: 8000 },
  });

  const myDeals = (dealsData ?? [])
    .map((r, i) => ({ id: i + 1, deal: normalizeDeal(r.result) as Deal | null }))
    .filter((x) => x.deal && (sameAddr(x.deal.buyer, address) || sameAddr(x.deal.seller, address)))
    .reverse();

  async function run(label: string, fn: () => Promise<void>) {
    setErr(null);
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      const m = e instanceof Error ? e.message : "transaction failed";
      setErr(m.split("\n")[0].slice(0, 160));
    } finally {
      setBusy(null);
    }
  }

  async function faucet() {
    if (!address) return;
    await run("faucet", async () => {
      const h = await writeContractAsync({
        address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "mint",
        args: [address, parseUsdc("5000")], chainId: BASE_SEPOLIA_ID,
      });
      await waitForTransactionReceipt(config, { hash: h });
      refetchBal();
    });
  }

  // create-deal form
  const [seller, setSeller] = useState("");
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("7");
  const [spec, setSpec] = useState("");
  const validSeller = /^0x[0-9a-fA-F]{40}$/.test(seller) && !sameAddr(seller, address);
  const validAmount = parseUsdc(amount) > 0n;
  const canCreate = onBase && validSeller && validAmount && spec.trim().length > 8 && Number(days) > 0;

  async function createDeal() {
    if (!canCreate) return;
    await run("create", async () => {
      const amt = parseUsdc(amount);
      const ah = await writeContractAsync({
        address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "approve",
        args: [ESCROW_ADDRESS, amt], chainId: BASE_SEPOLIA_ID,
      });
      await waitForTransactionReceipt(config, { hash: ah });
      const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(days) * 86400);
      const ch = await writeContractAsync({
        address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: "createDeal",
        args: [seller as `0x${string}`, amt, deadline, spec.trim()], chainId: BASE_SEPOLIA_ID,
      });
      await waitForTransactionReceipt(config, { hash: ch });
      setSeller(""); setAmount(""); setSpec("");
      refetchCount(); refetchDeals(); refetchBal();
    });
  }

  return (
    <main className="mx-auto max-w-4xl px-4 pb-24 pt-8 sm:px-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-coral">Theseus Escrow</p>
          <h1 className="mt-2 font-serif text-[28px] leading-[1.1] tracking-tight text-fg sm:text-[36px]">
            Escrow a sovereign agent settles.
          </h1>
          <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-fg-dim">
            Lock funds against a written brief. The seller delivers, and if both sides agree the
            money moves with one click. When they don&rsquo;t, either party opens a dispute and a
            Theseus agent reads the deliverable against the brief and decides where the funds go.
            Real custody on Base Sepolia; the {USDC_SYMBOL} is a faucet token.
          </p>
        </div>
        <div className="shrink-0"><ConnectButton showBalance={false} chainStatus="icon" /></div>
      </div>

      {isConnected && !onBase && (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-[13px] text-amber">
          <span>This app runs on Base Sepolia. Switch your wallet&rsquo;s network to continue.</span>
          <button onClick={() => switchChain({ chainId: BASE_SEPOLIA_ID })} className="rounded-lg bg-amber px-3 py-1.5 text-[12.5px] font-semibold text-black">
            Switch to Base Sepolia
          </button>
        </div>
      )}

      {!isConnected && (
        <div className="mt-8 rounded-xl border border-border bg-surface/40 p-6 text-[14px] text-fg-dim">
          Connect a wallet on Base Sepolia to create a deal or act on one. You&rsquo;ll need a little
          Base Sepolia ETH for gas (any public faucet) and you can mint {USDC_SYMBOL} here once connected.
        </div>
      )}

      {isConnected && onBase && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface/40 px-4 py-3">
            <span className="text-[13px] text-fg-dim">Balance</span>
            <span className="font-mono text-[15px] font-semibold text-fg">{fmtUsdc(balData as bigint | undefined)} {USDC_SYMBOL}</span>
            <button onClick={faucet} disabled={busy !== null} className="ml-auto rounded-lg border border-coral/40 bg-coral/10 px-3 py-1.5 text-[12.5px] font-semibold text-coral disabled:opacity-50">
              {busy === "faucet" ? "Minting…" : `Faucet · +5,000 ${USDC_SYMBOL}`}
            </button>
          </div>

          <section className="mt-6 rounded-xl border border-border bg-surface/40 p-5">
            <h2 className="text-[15px] font-semibold text-fg">Create a deal</h2>
            <p className="mt-1 text-[12.5px] text-fg-dim">You&rsquo;re the buyer. Your funds lock now and release to the seller only when the work is accepted or the agent rules for them.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[12px] text-fg-mute">Seller address</span>
                <input value={seller} onChange={(e) => setSeller(e.target.value)} placeholder="0x…" className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 font-mono text-[13px] text-fg outline-none focus:border-coral/60" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[12px] text-fg-mute">Amount ({USDC_SYMBOL})</span>
                  <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="1000" className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 font-mono text-[13px] text-fg outline-none focus:border-coral/60" />
                </label>
                <label className="block">
                  <span className="text-[12px] text-fg-mute">Deadline (days)</span>
                  <input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 font-mono text-[13px] text-fg outline-none focus:border-coral/60" />
                </label>
              </div>
            </div>
            <label className="mt-3 block">
              <span className="text-[12px] text-fg-mute">Brief / acceptance criteria</span>
              <textarea value={spec} onChange={(e) => setSpec(e.target.value)} rows={3} placeholder="What the seller must deliver for the funds to release. Be specific; this is what the agent scores against." className="mt-1 w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-[13px] leading-relaxed text-fg outline-none focus:border-coral/60" />
            </label>
            <button onClick={createDeal} disabled={!canCreate || busy !== null} className="mt-4 rounded-lg bg-coral px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-coral-dim disabled:opacity-50">
              {busy === "create" ? "Locking funds…" : "Lock funds & create deal"}
            </button>
          </section>

          {err && <p className="mt-4 rounded-lg border border-red/40 bg-red/10 px-3 py-2 text-[12.5px] text-red">{err}</p>}

          <section className="mt-8">
            <h2 className="mb-3 text-[15px] font-semibold text-fg">Your deals</h2>
            {myDeals.length === 0 ? (
              <p className="rounded-xl border border-border bg-surface/40 px-4 py-6 text-center text-[13px] text-fg-mute">No deals yet. Create one above, or have someone create one with your address as the seller.</p>
            ) : (
              <div className="space-y-2">
                {myDeals.map(({ id, deal }) => deal && (
                  <Link key={id} href={`/escrow/${id}`} className="flex items-center gap-3 rounded-xl border border-border bg-surface/40 px-4 py-3 transition-colors hover:border-coral/40">
                    <span className="font-mono text-[12px] text-fg-mute">#{id}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] text-fg">{deal.spec || "(no brief)"}</p>
                      <p className="mt-0.5 text-[11.5px] text-fg-mute">
                        {sameAddr(deal.buyer, address) ? "You → " : `${shortAddr(deal.buyer)} → `}
                        {sameAddr(deal.seller, address) ? "you" : shortAddr(deal.seller)}
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
