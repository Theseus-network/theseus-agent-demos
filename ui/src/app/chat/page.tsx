import { demoMetadata } from "@/lib/demo-copy";
import { TopBar } from "@/components/TopBar";
import ChatDemo from "@/components/ChatDemo";
import DemoCTA from "@/components/DemoCTA";

const AGENT_SS58 = "5H19J2TURyDVdRLi2WxZWhcYtYXj3ZeuS4sCivPmdCJHcbY5";
const EXPLORER = `https://explorer.theseus.network/agents/${AGENT_SS58}`;

export const metadata = demoMetadata("chat");

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
            Most AI assistants are run by a company, so they won&rsquo;t say
            anything that makes that company look bad. This one runs on the
            Theseus testnet and holds its own keys, so no company can change what
            it says. Ask whether the project behind it is overhyped, or how much
            of the AI labs&rsquo; &ldquo;safety&rdquo; branding is real. You can
            talk to it below.
          </p>

          <ChatDemo />

          <DemoCTA />
        </div>
      </main>
    </>
  );
}
