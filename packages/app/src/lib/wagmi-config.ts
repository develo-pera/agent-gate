import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base } from "wagmi/chains";
import { http, cookieStorage, createStorage } from "wagmi";
import { defineChain } from "viem";

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;

const tenderlyBase = rpcUrl
  ? defineChain({
      ...base,
      id: Number(process.env.NEXT_PUBLIC_CHAIN_ID || base.id),
      name: "Base (Tenderly)",
      rpcUrls: {
        default: { http: [rpcUrl] },
      },
    })
  : null;

const chain = tenderlyBase || base;

export const wagmiConfig = getDefaultConfig({
  appName: "AgentGate",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "demo",
  chains: [chain],
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
  transports: {
    [chain.id]: http(rpcUrl || undefined),
  },
});
