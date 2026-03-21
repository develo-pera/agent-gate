"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { AgentWalletConnect } from "@/components/agent-wallet-connect";

export function DemoBanner() {
  return (
    <div className="flex items-center justify-between">
      <AgentWalletConnect />
      <ConnectButton
        showBalance={false}
        chainStatus="icon"
        accountStatus="full"
      />
    </div>
  );
}
