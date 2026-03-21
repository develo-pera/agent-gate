"use client";

import { useState, useCallback } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { shortenAddress } from "@/lib/format";
import { useBasename } from "@/lib/hooks/use-basename";

interface AddressDisplayProps {
  address: string;
  className?: string;
}

export function AddressDisplay({ address, className }: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);
  const basename = useBasename(address);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [address]);

  const displayText = copied
    ? "Copied!"
    : basename || shortenAddress(address);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          onClick={handleCopy}
          className={`cursor-pointer font-mono text-sm text-muted-foreground transition-colors hover:text-foreground ${className ?? ""}`}
        >
          {displayText}
        </TooltipTrigger>
        <TooltipContent>{basename ? `${basename} — ${address}` : address}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
