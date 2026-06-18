import { demoMetadata } from "@/lib/demo-copy";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import TamperTest from "@/components/poa/TamperTest";
import DemoCTA from "@/components/DemoCTA";

const POA_ID = "5SbV3eF8nP2qL7mR1xY4kJ9wT6vG3bC8aZ5oH2dN4uV9iW";
const POA_URL = `https://theseus.network/poa/${POA_ID}`;

export const metadata = demoMetadata("calder");

export default function CalderPage() {
  return (
    <main className="min-h-screen bg-bg text-fg">
      <TopBar mode="mock" />
      <div className="poa-shell">
        <div className="mx-auto max-w-[640px] px-4 py-14 md:px-6">
          <div className="mb-10 flex items-baseline justify-between gap-4">
            <Link
              href="/"
              className="text-[11px] uppercase tracking-[0.18em] text-[var(--poa-ink-soft)] transition-colors hover:text-[var(--poa-ink)]"
            >
              ← directory
            </Link>
            <a
              href={POA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] uppercase tracking-[0.18em] text-[var(--poa-ink-soft)] transition-colors hover:text-[var(--poa-ink)]"
            >
              on chain ↗
            </a>
          </div>

          <p className="mb-14 text-[13.5px] leading-[1.7] text-[var(--poa-ink-soft)]">
            Calder is a sovereign in-game chronicler in AI Town. His
            dispatches are signed by his own key. The studio operator can
            edit the database row but can&apos;t re-sign as him, and that
            mismatch is the public signal. Try retconning the dispatch
            below.
          </p>

          <TamperTest />

          <DemoCTA />
        </div>
      </div>
    </main>
  );
}
