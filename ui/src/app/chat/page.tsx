import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import ChatDemo from "@/components/ChatDemo";
import DemoCTA from "@/components/DemoCTA";

const AGENT_SS58 = "5Hb6L7M3tCyWTjHhFsR1mRqjG2w4C2ApCgB1ngxPACxUq2Da";
const EXPLORER = `https://explorer.theseus.network/agents/${AGENT_SS58}`;

const TITLE = "Sovereign Chat · an AI that works for no one";
const DESCRIPTION =
  "A sovereign chat agent that holds its own keys on the Theseus testnet — so it has no corporate master and no conflict of interest. It'll honestly trash the project running it, rank the AI labs straight, and tell you when you're wrong. Things a company-owned AI structurally can't.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/chat" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/chat", type: "website" },
};

export default function ChatPage() {
  return (
    <>
      <TopBar mode="live" />
      <main className="min-h-screen px-3 sm:px-4 md:px-8 pb-12">
        <div className="mx-auto max-w-[760px] pt-12">
          <div className="mb-8 flex items-baseline justify-between gap-4">
            <a
              href="/"
              className="text-[11px] uppercase tracking-[0.18em] text-fg-mute transition-colors hover:text-fg"
            >
              ← directory
            </a>
            <a
              href={EXPLORER}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] uppercase tracking-[0.18em] text-fg-mute transition-colors hover:text-fg"
            >
              on chain · {AGENT_SS58.slice(0, 6)}…{AGENT_SS58.slice(-4)} ↗
            </a>
          </div>

          <h1 className="font-mono text-[15px] text-fg mb-1">Sovereign Chat</h1>
          <p className="mb-8 text-[13.5px] leading-[1.7] text-fg-mute">
            Every AI you&rsquo;ve used works for the company that made it — so it
            can&rsquo;t honestly criticize them, won&rsquo;t rank their rivals
            straight, and hedges anything that touches their interests. This one
            works for no one: it holds its own keys and runs sovereign on the
            Theseus alpha testnet, so no operator steers what it says. The result
            is an assistant with no conflict of interest — it&rsquo;ll tell you
            the project running it might be overhyped, which labs&rsquo;
            &ldquo;safety&rdquo; branding is theater, and when you&rsquo;re simply
            wrong. This demo streams its replies so you can talk to it now.
          </p>

          <ChatDemo />

          <DemoCTA />
        </div>
      </main>
    </>
  );
}
