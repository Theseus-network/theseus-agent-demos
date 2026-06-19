import { demoMetadata } from "@/lib/demo-copy";
import { ESCROW, AGENT_EOA, basescanAddressUrl } from "@/lib/deployed-contracts";

export const metadata = demoMetadata("escrow");

export default function EscrowLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-fg">
      {children}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-4xl px-4 py-6 text-[12px] leading-relaxed text-fg-mute sm:px-5">
          Agentic Escrow is a working app on Base Sepolia. The{" "}
          <a href={basescanAddressUrl(ESCROW.address)} target="_blank" rel="noopener noreferrer" className="underline decoration-border underline-offset-2 hover:text-fg">
            AgentEscrow contract
          </a>{" "}
          holds the funds; disputes are settled by the{" "}
          <a href={basescanAddressUrl(AGENT_EOA)} target="_blank" rel="noopener noreferrer" className="underline decoration-border underline-offset-2 hover:text-fg">
            Theseus agent
          </a>
          , which reads the deliverable against the brief and commits a verdict on chain. Funds are
          a faucet token ({ESCROW.usdcSymbol}) with no cash value. Nothing here is legal or financial advice.
        </div>
      </footer>
    </div>
  );
}
