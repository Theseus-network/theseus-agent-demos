import Link from "next/link";
import { demoMetadata } from "@/lib/demo-copy";
import { AGENT_MARKET, AGENT_EOA, basescanAddressUrl } from "@/lib/deployed-contracts";

export const metadata = demoMetadata("agents");

export default function AgentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#070B16] text-white [color-scheme:dark]">
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#070B16]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/agents" className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] shadow-[0_4px_16px_rgba(99,102,241,0.4)]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="7" width="14" height="12" rx="3" /><path d="M9 12h.01M15 12h.01M12 4v3" /></svg>
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-white">Agent Market</span>
          </Link>
          <a href={basescanAddressUrl(AGENT_MARKET.address)} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#AAB2C5] transition-colors hover:text-white">
            Contract ↗
          </a>
        </div>
      </header>
      {children}
      <footer className="border-t border-white/[0.07]">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 text-[12px] leading-relaxed text-[#6B7488]">
          <span className="font-semibold text-[#AAB2C5]">Agent Market</span> is a working demo on Base
          Sepolia. The requester and provider are sovereign agent wallets; the{" "}
          <a href={basescanAddressUrl(AGENT_EOA)} target="_blank" rel="noopener noreferrer" className="text-[#A5B0FF] hover:underline">Theseus adjudicator</a>{" "}
          verifies each delivery and settles it. Funds are a faucet token ({AGENT_MARKET.usdcSymbol}) with
          no cash value.
        </div>
      </footer>
    </div>
  );
}
