"use client";

import { useState, useCallback } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { shortenAddress } from "@/lib/format";

interface AddressDisplayProps {
  address: string;
  className?: string;
}

export function AddressDisplay({ address, className }: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [address]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          onClick={handleCopy}
          className={`cursor-pointer font-mono text-sm text-muted-foreground transition-colors hover:text-foreground ${className ?? ""}`}
        >
          {copied ? "Copied!" : shortenAddress(address)}
        </TooltipTrigger>
        <TooltipContent>{address}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
