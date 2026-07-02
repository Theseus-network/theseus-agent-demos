import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";
import VaultNav from "@/components/vault/VaultNav";

// Instrument Serif — the brand kit's heading face.
const instrument = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument",
});

export const metadata: Metadata = {
  title: { absolute: "Sovereign — an autonomous on-chain fund" },
  description:
    "An unruggable autonomous fund. An AI agent invests the pool on-chain, in the open. Deposit, hold shares, redeem at NAV monthly.",
};

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${instrument.variable} dark relative min-h-screen bg-bg text-fg [color-scheme:dark]`}
      style={{ ["--font-serif" as string]: "var(--font-instrument), Georgia, serif" } as React.CSSProperties}
    >
      {/* The demo site's root html/body is light-themed; keep the dark ground
          from showing a light band on macOS overscroll while /vault is open. */}
      <style>{`html,body{background-color:#060B16!important;overscroll-behavior-y:none}`}</style>
      {/* indigo hero glow — brand atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[620px]"
        style={{ background: "radial-gradient(58% 105% at 28% -6%, rgba(129,140,248,0.30), rgba(99,102,241,0.10) 42%, transparent 70%)" }}
      />
      {/* fractal noise — soft-light, barely there */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.02] mix-blend-soft-light"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      <div className="relative z-10">
        <VaultNav />
        {children}
        <footer className="border-t border-border">
          <div className="mx-auto max-w-[1080px] px-4 py-8 text-[12px] leading-relaxed text-fg-mute sm:px-6">
            Sovereign runs on testnets: the vault and shares are real on Base Sepolia in play-money
            eUSDC, and the agent runs on the Theseus alpha testnet. This is a demonstration, not an
            offer or investment advice.
          </div>
        </footer>
      </div>
    </div>
  );
}
