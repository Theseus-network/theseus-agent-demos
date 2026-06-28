"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { faucet, usePredict } from "@/lib/predict/store";
import { usd } from "@/lib/predict/format";
import AccountBar from "./AccountBar";

function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
        const connected = mounted && account && chain;
        return (
          <button
            onClick={connected ? openAccountModal : openConnectModal}
            className={
              connected
                ? "rounded-md border border-border px-2.5 py-2 text-[13px] font-medium tabular-nums text-fg transition-colors hover:border-fg/30 sm:px-3"
                : "rounded-md bg-coral px-2.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-coral-dim sm:px-3"
            }
          >
            {connected ? (
              account.displayName
            ) : (
              <>
                <span className="hidden sm:inline">Connect wallet</span>
                <span className="sm:hidden">Wallet</span>
              </>
            )}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}

const LINKS = [
  { href: "/predict", label: "Markets" },
  { href: "/predict/leaderboard", label: "Leaderboard" },
  { href: "/predict/portfolio", label: "Portfolio" },
  { href: "/predict/how-it-works", label: "How it works" },
];

function NavLinks({ pathname }: { pathname: string }) {
  return (
    <>
      {LINKS.map((l) => {
        const active =
          l.href === "/predict" ? pathname === "/predict" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors sm:px-3 ${
              active
                ? "bg-fg/[0.06] text-fg"
                : "text-fg-mute hover:bg-fg/[0.04] hover:text-fg"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </>
  );
}

export default function PredictNav() {
  const pathname = usePathname();
  const { balance, hydrated } = usePredict();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto max-w-6xl px-3 sm:px-5">
        <div className="flex h-14 items-center gap-2 sm:gap-4">
          <Link href="/predict" className="flex shrink-0 items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-coral text-[14px] font-bold text-white">
              ◎
            </span>
            <span className="hidden font-semibold tracking-tight text-fg sm:inline">
              Theseus Predict
            </span>
          </Link>
          <span className="hidden rounded-full border border-border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-fg-mute md:inline">
            Testnet
          </span>

          <nav className="ml-2 hidden items-center gap-1 sm:flex">
            <NavLinks pathname={pathname} />
          </nav>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <WalletButton />
            <button
              onClick={() => faucet()}
              disabled={!hydrated}
              className="hidden rounded-md border border-border px-2.5 py-2 text-[13px] font-medium text-fg-dim transition-colors hover:border-fg/30 hover:text-fg disabled:opacity-50 sm:inline sm:px-3"
              title={`Play-money faucet for non-on-chain markets · balance ${hydrated ? usd(balance, { cents: true }) : "—"}`}
            >
              + Play funds
            </button>
            <AccountBar />
          </div>
        </div>

        {/* nav links move to their own row on mobile so the header never overflows */}
        <nav className="-mx-1 flex items-center gap-1 overflow-x-auto border-t border-border px-1 py-1.5 sm:hidden">
          <NavLinks pathname={pathname} />
        </nav>
      </div>
    </header>
  );
}
