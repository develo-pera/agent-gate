"use client";

import { useApp } from "@/providers/app-provider";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useBasename } from "@/lib/hooks/use-basename";
import { AGENT_ADDRESSES } from "@/lib/contracts/addresses";

function shortenAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function AgentChip({
  address,
  isActive,
  onClick,
}: {
  address: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const basename = useBasename(address);
  return (
    <button
      onClick={onClick}
      className={`text-sm font-mono rounded-md px-2 py-1 transition-colors cursor-pointer ${
        isActive
          ? "border border-primary/50 bg-primary/10 text-foreground"
          : "border border-border/50 bg-card/40 text-muted-foreground hover:text-foreground hover:border-border"
      }`}
    >
      {basename ? (
        <>
          <span className="font-semibold">{basename}</span>
          <span className="ml-2 text-xs opacity-60">{shortenAddr(address)}</span>
        </>
      ) : (
        shortenAddr(address)
      )}
    </button>
  );
}

export function DemoBanner() {
  const { isDemo, activeAddress, setViewAddress } = useApp();

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        {isDemo && (
          <span className="text-sm text-muted-foreground">
            <span
              className="font-semibold"
              style={{ color: "hsl(38 92% 50% / 0.9)" }}
            >
              Demo Mode
            </span>
          </span>
        )}
        <div className="flex items-center gap-2">
          {Object.entries(AGENT_ADDRESSES).map(([, addr]) => (
            <AgentChip
              key={addr}
              address={addr}
              isActive={activeAddress.toLowerCase() === addr.toLowerCase()}
              onClick={() => setViewAddress(addr)}
            />
          ))}
        </div>
      </div>
      <ConnectButton
        showBalance={false}
        chainStatus="icon"
        accountStatus="full"
      />
    </div>
  );
}
