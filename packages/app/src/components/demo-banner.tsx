"use client";

import { useApp } from "@/providers/app-provider";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export function DemoBanner() {
  const { isDemo } = useApp();

  return (
    <div className="flex items-center justify-between">
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
      <ConnectButton
        showBalance={false}
        chainStatus="icon"
        accountStatus="full"
      />
    </div>
  );
}
