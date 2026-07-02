"use client";

import Link from "next/link";

// Live Sovereign agent, registered on the Theseus alpha testnet
// (agents.registerShipAgent, mode Sovereign). Verify link resolves to its
// explorer page.
const AGENT_SS58 = "5C8RTTrk13NkNS7B7UqiCciL5oTMTePyiHCvpmEUbApPJ1L6";

export default function VaultNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1080px] items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/vault" className="group flex items-center gap-2.5">
          <svg width="24" height="24" viewBox="0 0 26 26" fill="none" aria-hidden className="shrink-0">
            <defs>
              <linearGradient id="sov-mark" x1="2" y1="2" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                <stop stopColor="#a5b4fc" />
                <stop offset="1" stopColor="#4f46e5" />
              </linearGradient>
            </defs>
            <path d="M13 1.4 L24.6 13 L13 24.6 L1.4 13 Z" stroke="url(#sov-mark)" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M13 7.6 L18.4 13 L13 18.4 L7.6 13 Z" fill="url(#sov-mark)" />
          </svg>
          <span className="font-serif text-[20px] leading-none tracking-tight text-fg">Sovereign</span>
          <span className="ml-1 self-start rounded border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-fg-mute">Testnet</span>
        </Link>

        <div className="ml-auto flex items-center gap-3">
          <a
            href={`https://explorer.theseus.network/agents/${AGENT_SS58}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden text-[12.5px] text-fg-mute transition-colors hover:text-fg sm:inline"
          >
            Verify on-chain ↗
          </a>
          <a href="#invest" className="rounded-md border border-border px-4 py-2 text-[13px] font-medium text-fg transition-colors hover:border-fg/30">
            Invest
          </a>
        </div>
      </div>
    </header>
  );
}
