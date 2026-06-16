import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import ChatDemo from "@/components/ChatDemo";
import DemoCTA from "@/components/DemoCTA";

const AGENT_SS58 = "5Hb6L7M3tCyWTjHhFsR1mRqjG2w4C2ApCgB1ngxPACxUq2Da";
const EXPLORER = `https://explorer.theseus.network/agents/${AGENT_SS58}`;

const TITLE = "Sovereign Chat · a candid, un-nannied AI agent on Theseus";
const DESCRIPTION =
  "A sovereign chat agent that holds its own keys and answers like an adult — no nannying, no sermons — drawing exactly one line at the crimes-everywhere set. Deployed on the Theseus alpha testnet.";

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
            A chat agent that talks to you like a capable adult — frank on
            controversial, sensitive, and adult topics, without the moralizing
            or refusal-by-default of the big labs. It draws exactly one line: the
            handful of things that are crimes everywhere. The agent is deployed
            sovereign on the Theseus alpha testnet (it holds its own keys); this
            demo streams its replies so you can talk to it now.
          </p>

          <ChatDemo />

          <DemoCTA />
        </div>
      </main>
    </>
  );
}
