"use client";

import { ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, http } from "wagmi";
import { defineChain } from "viem";
import { baseSepolia } from "viem/chains";
import { RainbowKitProvider, darkTheme, getDefaultConfig } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 1337);
const evmRpc = process.env.NEXT_PUBLIC_EVM_RPC ?? "http://127.0.0.1:9933";

const theseus = defineChain({
  id: chainId,
  name: "Theseus EVM",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [evmRpc] } },
});

// Base Sepolia is where the AgentEscrow custody contract lives.
const baseSepoliaRpc =
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ?? "https://sepolia.base.org";

const wagmiConfig = getDefaultConfig({
  appName: "Theseus Agent Oracle",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "theseus-agent-oracle",
  chains: [theseus, baseSepolia],
  transports: {
    [theseus.id]: http(evmRpc),
    [baseSepolia.id]: http(baseSepoliaRpc),
  },
  ssr: true,
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#ff5b3a",
            accentColorForeground: "#0a0b0d",
            borderRadius: "medium",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
