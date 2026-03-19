"use client";

import { useApp } from "@/providers/app-provider";
import { useEnsName } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletDisplay() {
  const { isDemo, activeAddress } = useApp();
  const { data: ensName } = useEnsName({
    address: isDemo ? undefined : (activeAddress as `0x${string}`),
  });

  if (isDemo) {
    return (
      <ConnectButton.Custom>
        {({ openConnectModal }) => (
          <Button
            variant="default"
            size="sm"
            onClick={openConnectModal}
            className="w-full"
          >
            Connect Wallet
          </Button>
        )}
      </ConnectButton.Custom>
    );
  }

  return (
    <div className="flex items-center gap-2 overflow-hidden">
      <span className="font-mono text-[13px] text-foreground truncate">
        {ensName || truncateAddress(activeAddress)}
      </span>
      <Badge variant="default" className="shrink-0">
        Base
      </Badge>
    </div>
  );
}
