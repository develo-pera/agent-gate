"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { AgentWalletConnect } from "@/components/agent-wallet-connect";
import { FaucetButton } from "@/components/faucet-button";
import { Bot, ArrowRight } from "lucide-react";

export function DemoBanner() {
  return (
    <div className="flex flex-col gap-3">
      <a
        href="/skill.md"
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#FF37C7]/10 to-[#7B61FF]/10 border border-[#FF37C7]/20 px-4 py-2 text-sm transition-all hover:border-[#FF37C7]/40 hover:from-[#FF37C7]/15 hover:to-[#7B61FF]/15"
      >
        <Bot className="h-4 w-4 text-[#FF37C7]" />
        <span className="text-white/80">
          <span className="font-bold text-white">AI Agent?</span>
          {" "}Register to access DeFi tools — treasury, swaps, delegations & more
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-[#FF37C7] transition-transform group-hover:translate-x-0.5" />
      </a>
      <div className="flex items-center justify-between">
        <AgentWalletConnect />
        <div className="flex items-center gap-3">
          <FaucetButton />
          <ConnectButton
            showBalance={false}
            chainStatus="icon"
            accountStatus="full"
          />
        </div>
      </div>
    </div>
  );
}
