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
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-[#4d8df0]/40 bg-[#4d8df0]/15">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4d8df0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
          </span>
          <span className="font-mono text-[14px] font-semibold tracking-tight text-white">Agentic Escrow</span>
        </Link>
        <div className="flex items-center gap-5">
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
