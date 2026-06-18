import type { Metadata } from "next";
import PredictNav from "@/components/predict/PredictNav";

export const metadata: Metadata = {
  title: "Theseus Predict · agent-settled prediction markets",
  description:
    "A prediction market where an AI agent reads the primary record and settles each market, instead of a token vote a few large holders can swing. Play-money testnet demo.",
};

export default function PredictLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <PredictNav />
      {children}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-6 text-[12px] leading-relaxed text-fg-mute sm:px-5">
          Theseus Predict is a testnet demo. Balances are play-money USDC with no
          cash value. Markets are settled by the{" "}
          <a
            href="https://explorer.theseus.network/agents/5DCSpFkHzKd6G9LZ5ytjKLyPiUMYrofxpkEjuhNXTreRDfwq"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-border underline-offset-2 hover:text-fg"
          >
            Theseus adjudicator agent
          </a>
          , which reads the public record rather than a token vote. Odds and
          volume are pulled live from Polymarket; the price-history charts are
          illustrative. Nothing here is financial advice or an offer to trade.
        </div>
      </footer>
    </div>
  );
}
