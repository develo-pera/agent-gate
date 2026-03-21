"use client";

import { useApp } from "@/providers/app-provider";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useBasename } from "@/lib/hooks/use-basename";

function shortenAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function DemoBanner() {
  const { isDemo, activeAddress } = useApp();
  const basename = useBasename(activeAddress);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        {isDemo ? (
          <span className="text-sm text-muted-foreground">
            <span
              className="font-semibold"
              style={{ color: "hsl(38 92% 50% / 0.9)" }}
            >
              Demo Mode
            </span>
            {" "}&mdash; read-only, no wallet connected
          </span>
        ) : (
          <span />
        )}
        {activeAddress && activeAddress !== "0x0000000000000000000000000000000000000000" && (
          <span className="text-sm font-mono text-muted-foreground border border-border/50 rounded-md px-2 py-1 bg-card/40">
            {basename ? (
              <>
                <span className="text-foreground font-semibold">{basename}</span>
                <span className="ml-2 text-xs">{shortenAddr(activeAddress)}</span>
              </>
            ) : (
              shortenAddr(activeAddress)
            )}
          </span>
        )}
      </div>
      <ConnectButton
        showBalance={false}
        chainStatus="icon"
        accountStatus="full"
      />
    </div>
  );
}
