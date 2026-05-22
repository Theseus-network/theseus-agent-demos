import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Fraunces } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

const SITE_URL = "https://demo-agents.theseus.network";
const TITLE = "Theseus demo agents · eight autonomous agents in a browser tab";
const DESCRIPTION =
  "Browse eight Theseus demo agents: oracle replacements, mechanism gates, proposal reviewers, sovereign funds. Each reasons from raw inputs, posts a signed decision to a real chain, and publishes its verbatim system prompt on Proof of Agenthood.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · Theseus demo agents",
  },
  description: DESCRIPTION,
  applicationName: "Theseus demo agents",
  keywords: [
    "Theseus",
    "demo agents",
    "agent oracle",
    "Aave V3",
    "AI oracle",
    "DeFi agent",
    "Mango Markets",
    "Terra Luna",
    "algorithmic stablecoin",
    "bridge guardian",
    "governance reviewer",
    "aviation safety",
    "sovereign fund",
    "launch sniper",
    "PolkaVM",
    "pallet-revive",
    "autonomous agent",
    "Proof of Agenthood",
  ],
  alternates: {
    canonical: "/",
  },
  authors: [{ name: "Theseus", url: "https://theseus.network" }],
  creator: "Theseus",
  publisher: "Theseus",
  category: "technology",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: "Theseus demo agents",
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    site: "@theseus_network",
    creator: "@theseus_network",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

// Mirrors theseus.network's pattern: defaults to light, reads
// localStorage 'theme' = 'dark' | 'light' set by the ThemeToggle, and
// adds `.dark` to <html> before paint to avoid a flash of light theme.
const themeInitScript = `
  (function() {
    try {
      var stored = localStorage.getItem('theme');
      var theme = stored === 'dark' || stored === 'light' ? stored : 'light';
      if (theme === 'dark') document.documentElement.classList.add('dark');
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrains.variable} ${fraunces.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
