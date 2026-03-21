"use client";

import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider, cookieToInitialState } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi-config";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1_000 * 60 * 60,
      staleTime: 1_000 * 60,
    },
  },
});

export function Web3Provider({
  children,
  cookie,
}: {
  children: React.ReactNode;
  cookie?: string;
}) {
  const initialState = cookieToInitialState(wagmiConfig, cookie);

  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState} reconnectOnMount>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#FF37C7",
            borderRadius: "medium",
          })}
          initialChain={wagmiConfig.chains[0]}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
