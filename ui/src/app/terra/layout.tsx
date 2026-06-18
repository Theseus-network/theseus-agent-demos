import type { Metadata } from "next";

const TITLE = "Luna Failsafe · A Theseus agent gating an algorithmic stablecoin";
const DESCRIPTION =
  "Live demo of the Luna Failsafe, a Theseus agent that gates mint and redeem on a reflexive stablecoin. It reads the backing. When LUNA's market cap falls below UST's outstanding supply, the backing is worth less than the debt and no bounce in the price recovers it. Load a day from the May 2022 collapse and watch it return ALLOW, CAUTION, or REFUSE, signed on chain.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "https://theseus.network/demos/terra",
  },
  keywords: [
    "Terra Luna",
    "algorithmic stablecoin",
    "UST",
    "LUNA",
    "death spiral",
    "Theseus agent",
    "DeFi failsafe",
    "AI agent",
    "stablecoin gate",
    "Proof of Agenthood",
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/terra",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function TerraLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
