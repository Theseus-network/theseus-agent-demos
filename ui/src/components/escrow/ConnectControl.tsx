"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { BASE_SEPOLIA_ID } from "@/lib/escrow/client";

/** Indigo gradient connect control, used in the nav and inline CTAs. */
export function ConnectControl({ size = "md" }: { size?: "md" | "lg" }) {
  const pad = size === "lg" ? "px-5 py-2.5 text-[14px]" : "px-4 py-2 text-[13px]";
  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openChainModal, openAccountModal, mounted }) => {
        if (!mounted) return <div className="h-9 w-32" />;
        const connected = account && chain;
        const base = `rounded-xl font-semibold transition-all ${pad}`;
        if (!connected)
          return (
            <button
              onClick={openConnectModal}
              className={`${base} bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white shadow-[0_8px_30px_rgba(99,102,241,0.35)] hover:shadow-[0_8px_40px_rgba(99,102,241,0.55)]`}
            >
              Connect wallet
            </button>
          );
        if (chain.id !== BASE_SEPOLIA_ID)
          return (
            <button onClick={openChainModal} className={`${base} bg-[#FBBF24] text-black`}>
              Wrong network
            </button>
          );
        return (
          <button
            onClick={openAccountModal}
            className={`${base} border border-white/15 bg-white/[0.06] text-white hover:bg-white/10`}
          >
            {account.displayName}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
