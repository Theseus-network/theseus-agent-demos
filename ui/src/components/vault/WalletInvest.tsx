"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSwitchChain, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { VAULT_ADDRESS, EUSDC_ADDRESS, VAULT_ABI, ERC20_ABI, ASSET_DECIMALS, BASE_SEPOLIA_ID, BASESCAN } from "@/lib/vault/contracts";

const QUICK = [1_000, 10_000, 100_000];
const fmtUsd = (v: bigint | undefined) =>
  v === undefined ? "—" : Number(formatUnits(v, ASSET_DECIMALS)).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export function WalletInvest() {
  const { address, isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [amount, setAmount] = useState("10000");
  const [busy, setBusy] = useState<null | string>(null);
  const [tx, setTx] = useState<{ label: string; hash: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onBase = chainId === BASE_SEPOLIA_ID;
  const enabled = Boolean(address) && onBase;
  const readOpts = { query: { enabled, refetchInterval: 5000 } } as const;

  const { data: usdcBal, refetch: refetchUsdc } = useReadContract({ address: EUSDC_ADDRESS, abi: ERC20_ABI, functionName: "balanceOf", args: [address ?? "0x0"], chainId: BASE_SEPOLIA_ID, ...readOpts });
  const { data: allowance, refetch: refetchAllow } = useReadContract({ address: EUSDC_ADDRESS, abi: ERC20_ABI, functionName: "allowance", args: [address ?? "0x0", VAULT_ADDRESS], chainId: BASE_SEPOLIA_ID, ...readOpts });
  const { data: shares, refetch: refetchShares } = useReadContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "balanceOf", args: [address ?? "0x0"], chainId: BASE_SEPOLIA_ID, ...readOpts });
  const { data: posValue, refetch: refetchPos } = useReadContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "convertToAssets", args: [(shares as bigint) ?? 0n], chainId: BASE_SEPOLIA_ID, query: { enabled: enabled && !!shares } });
  const { data: pps } = useReadContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "pricePerShare", chainId: BASE_SEPOLIA_ID, ...readOpts });
  const { data: redeemOpen } = useReadContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "redemptionsOpen", chainId: BASE_SEPOLIA_ID, ...readOpts });
  const { data: nextOpen } = useReadContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "nextRedemptionOpen", chainId: BASE_SEPOLIA_ID, ...readOpts });
  const { data: closesAt } = useReadContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "redemptionCloses", chainId: BASE_SEPOLIA_ID, ...readOpts });
  const windowOpen = redeemOpen === true;
  const daysUntil = (ts: bigint | undefined) => (ts ? Math.max(0, Math.ceil((Number(ts) - Date.now() / 1000) / 86400)) : 0);

  const amt = Math.max(0, parseFloat(amount) || 0);
  const amtUnits = amt > 0 ? parseUnits(amount as `${number}`, ASSET_DECIMALS) : 0n;
  const hasShares = (shares as bigint | undefined) && (shares as bigint) > 0n;

  function refetchAll() { refetchUsdc(); refetchAllow(); refetchShares(); refetchPos(); }

  async function send(label: string, run: () => Promise<`0x${string}`>) {
    setErr(null); setBusy(label);
    try {
      const hash = await run();
      setTx({ label, hash });
      await publicClient?.waitForTransactionReceipt({ hash });
      refetchAll();
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : String(e);
      setErr(m.replace(/\n[\s\S]*/, "").slice(0, 140));
    } finally { setBusy(null); }
  }

  const faucet = () => send("faucet", () =>
    writeContractAsync({ address: EUSDC_ADDRESS, abi: ERC20_ABI, functionName: "mint", args: [address!, parseUnits("10000", ASSET_DECIMALS)], chainId: BASE_SEPOLIA_ID }));

  async function invest() {
    if (amtUnits <= 0n) return;
    if (((allowance as bigint | undefined) ?? 0n) < amtUnits) {
      await send("approve", () => writeContractAsync({ address: EUSDC_ADDRESS, abi: ERC20_ABI, functionName: "approve", args: [VAULT_ADDRESS, amtUnits], chainId: BASE_SEPOLIA_ID }));
      if (err) return;
    }
    await send("deposit", () => writeContractAsync({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "deposit", args: [amtUnits, address!], chainId: BASE_SEPOLIA_ID }));
  }

  const redeem = () => send("redeem", () =>
    writeContractAsync({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "redeem", args: [shares as bigint, address!], chainId: BASE_SEPOLIA_ID }));

  const needsApproval = ((allowance as bigint | undefined) ?? 0n) < amtUnits;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-fg">{hasShares ? "Your investment" : "Invest"}</h2>
        <ConnectButton.Custom>
          {({ account, mounted, openConnectModal, openAccountModal }) => {
            if (!mounted) return null;
            return account ? (
              <button onClick={openAccountModal} className="rounded-md border border-border px-3 py-1.5 font-mono text-[12px] text-fg-dim transition-colors hover:border-fg/30 hover:text-fg">
                {account.displayName}
              </button>
            ) : (
              <button onClick={openConnectModal} className="rounded-md border border-border px-4 py-1.5 text-[13px] font-medium text-fg transition-colors hover:border-fg/30">
                Connect wallet
              </button>
            );
          }}
        </ConnectButton.Custom>
      </div>

      {!isConnected ? (
        <p className="mt-4 text-[13px] leading-relaxed text-fg-dim">
          Connect a wallet on Base Sepolia to deposit test USDC into the vault and mint shares on-chain.
        </p>
      ) : !onBase ? (
        <button onClick={() => switchChain({ chainId: BASE_SEPOLIA_ID })} className="mt-4 w-full rounded-lg py-3 text-[14px] font-semibold text-white" style={{ background: "linear-gradient(180deg, #6366f1, #4f46e5)" }}>
          Switch to Base Sepolia
        </button>
      ) : (
        <div className="mt-4">
          {hasShares && (
            <div className="mb-4">
              <p className="font-serif text-[34px] leading-none tabular-nums text-fg">{fmtUsd(posValue as bigint)}</p>
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
                <Line k="Shares (svUSDC)" v={Number(formatUnits(shares as bigint, ASSET_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 2 })} />
                <Line k="Price / share" v={fmtUsd(pps as bigint)} />
              </div>
              <button onClick={redeem} disabled={!!busy || !windowOpen} className="mt-4 w-full rounded-lg py-3 text-[14px] font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-50" style={{ background: "linear-gradient(180deg, #6366f1, #4f46e5)" }}>
                {busy === "redeem" ? "Redeeming…" : windowOpen ? `Cash out ${fmtUsd(posValue as bigint)}` : `Redemptions open in ${daysUntil(nextOpen as bigint)}d`}
              </button>
              <p className="mt-2 text-[12px] text-fg-mute">
                {windowOpen ? `Redemption window open, closes in ${daysUntil(closesAt as bigint)} days.` : `Redemptions settle monthly; the next window opens in ${daysUntil(nextOpen as bigint)} days.`}
              </p>
              <div className="my-4 border-t border-border" />
            </div>
          )}

          <div className="flex items-center justify-between text-[12.5px]">
            <label className="text-fg-mute">Amount to invest</label>
            <span className="text-fg-mute">Balance <span className="text-fg-dim">{fmtUsd(usdcBal as bigint)}</span></span>
          </div>
          <div className="mt-1.5 flex items-center rounded-lg border border-border bg-bg/40 px-3 focus-within:border-coral">
            <span className="text-[18px] text-fg-mute">$</span>
            <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} className="w-full bg-transparent px-2 py-3 text-[20px] font-medium tabular-nums text-fg outline-none" placeholder="0" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            {QUICK.map((d) => (
              <button key={d} onClick={() => setAmount(String(d))} className="rounded-md border border-border px-3 py-1.5 text-[12.5px] text-fg-mute transition-colors hover:border-fg/30 hover:text-fg">${d >= 1000 ? `${d / 1000}K` : d}</button>
            ))}
            <button onClick={faucet} disabled={!!busy} className="ml-auto rounded-md border border-border px-3 py-1.5 text-[12.5px] text-fg-mute transition-colors hover:border-fg/30 hover:text-fg disabled:opacity-50">
              {busy === "faucet" ? "minting…" : "Get 10K test USDC"}
            </button>
          </div>

          <button onClick={invest} disabled={!!busy || amtUnits <= 0n} className="mt-4 w-full rounded-lg py-3 text-[14px] font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-40" style={{ background: "linear-gradient(180deg, #6366f1, #4f46e5)" }}>
            {busy === "approve" ? "Approving…" : busy === "deposit" ? "Depositing…" : needsApproval && amt > 0 ? `Approve & invest $${amt.toLocaleString()}` : `Invest $${amt.toLocaleString()}`}
          </button>

          {tx && (
            <a href={`${BASESCAN}/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block font-mono text-[11px] text-coral hover:underline">
              {tx.label} tx {tx.hash.slice(0, 10)}… on Basescan ↗
            </a>
          )}
          {err && <p className="mt-2 text-[12px] text-red">{err}</p>}
        </div>
      )}

      <p className="mt-4 border-t border-border pt-4 text-[12.5px] leading-relaxed text-fg-mute">
        Real deposits into a vault on Base Sepolia. Shares are ERC-20 (svUSDC), redeemable at NAV in the monthly window. The manager can mark the book but cannot withdraw your funds.
      </p>
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1.5">
      <span className="text-fg-mute">{k}</span>
      <span className="tabular-nums text-fg">{v}</span>
    </div>
  );
}
