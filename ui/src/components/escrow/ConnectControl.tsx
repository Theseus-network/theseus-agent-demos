"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { BASE_SEPOLIA_ID } from "@/lib/escrow/client";

/** Flat connect control, used in the nav and inline CTAs. */
export function ConnectControl({ size = "md" }: { size?: "md" | "lg" }) {
  const pad = size === "lg" ? "px-5 py-2.5 text-[14px]" : "px-4 py-2 text-[13px]";
  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openChainModal, openAccountModal, mounted }) => {
        if (!mounted) return <div className="h-9 w-32" />;
        const connected = account && chain;
        const base = `rounded-lg font-semibold transition-colors ${pad}`;
        if (!connected)
          return (
            <button
              onClick={openConnectModal}
              className={`${base} bg-white text-[#0a0b0d] hover:bg-white/88`}
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
