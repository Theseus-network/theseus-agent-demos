import { demoMetadata } from "@/lib/demo-copy";
import { ESCROW, AGENT_EOA, basescanAddressUrl } from "@/lib/deployed-contracts";
import EscrowNav from "@/components/escrow/EscrowNav";

export const metadata = demoMetadata("escrow");

export default function EscrowLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#080a12] text-white [color-scheme:dark]">
      <div className="h-[2px] w-full bg-gradient-to-r from-[#4d8df0] via-[#4d8df0]/35 to-transparent" />
      <EscrowNav />
      {children}
      <footer className="border-t border-white/[0.07]">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-[#6B7488]">
            <span className="font-semibold text-[#AAB2C5]">Agentic Escrow</span>
            <span>·</span>
            <span>a working app on Base Sepolia.</span>
            <a href={basescanAddressUrl(ESCROW.address)} target="_blank" rel="noopener noreferrer" className="text-white/70 underline decoration-white/20 hover:text-white">
              Escrow contract ↗
            </a>
            <a href={basescanAddressUrl(AGENT_EOA)} target="_blank" rel="noopener noreferrer" className="text-white/70 underline decoration-white/20 hover:text-white">
              Agent ↗
            </a>
            <a href="https://theseus.network" target="_blank" rel="noopener noreferrer" className="text-white/70 underline decoration-white/20 hover:text-white">
              Built on Theseus ↗
            </a>
          </div>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-[#6B7488]">
            The contract holds the funds; the agent never does. Testnet token ({ESCROW.usdcSymbol}), no cash value.
          </p>
        </div>
      </footer>
    </div>
  );
}
