"use client";

import { useApp } from "@/providers/app-provider";
import { ConnectButton } from "@rainbow-me/rainbowkit";

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function DemoBanner() {
  const { isDemo, treasuryAddress } = useApp();

  if (!isDemo) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex h-10 w-full items-center justify-center border-b px-4"
      style={{
        background: "hsl(38 92% 50% / 0.1)",
        borderBottomColor: "hsl(38 92% 50% / 0.3)",
      }}
    >
      <span className="text-sm text-muted-foreground">
        Demo Mode &mdash; viewing{" "}
        <span className="font-mono text-[13px]">
          {truncateAddress(treasuryAddress)}
        </span>
      </span>
      <div className="absolute right-4">
        <ConnectButton.Custom>
          {({ openConnectModal }) => (
            <button
              onClick={openConnectModal}
              className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              Connect Wallet
            </button>
          )}
        </ConnectButton.Custom>
      </div>
    </div>
  );
}
