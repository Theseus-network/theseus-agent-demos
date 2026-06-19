"use client";

import Link from "next/link";
import { ConnectControl } from "./ConnectControl";
import { basescanAddressUrl } from "@/lib/deployed-contracts";
import { ESCROW_ADDRESS } from "@/lib/escrow/client";

export default function EscrowNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#070B16]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/escrow" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] shadow-[0_4px_16px_rgba(99,102,241,0.4)]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L20 7" />
            </svg>
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-white">Agentic Escrow</span>
        </Link>
        <div className="flex items-center gap-5">
          <a href="#how" className="hidden text-[13px] text-[#AAB2C5] transition-colors hover:text-white sm:block">
            How it works
          </a>
          <a
            href={basescanAddressUrl(ESCROW_ADDRESS)}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden text-[13px] text-[#AAB2C5] transition-colors hover:text-white sm:block"
          >
            Contract ↗
          </a>
          <ConnectControl />
        </div>
      </div>
    </header>
  );
}
