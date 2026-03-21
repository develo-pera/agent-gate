"use client";

import { AddressDisplay } from "@/components/shared/address-display";
import { Badge } from "@/components/ui/badge";
import type { SpenderDelegation } from "@/lib/hooks/use-delegations";

interface DelegationCardProps {
  delegation: SpenderDelegation;
}

export function DelegationCard({ delegation }: DelegationCardProps) {
  const windowHours = delegation.windowDuration
    ? Math.round(delegation.windowDuration / 3600)
    : null;

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-6 backdrop-blur-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold capitalize">
            {delegation.spenderName}
          </span>
          <AddressDisplay address={delegation.spender} />
        </div>
        <Badge className="bg-success/20 text-success border-success/30">
          Active
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">
            Max per tx
          </p>
          <p className="text-sm">{delegation.maxPerTx} wstETH</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground">
            {windowHours ? `${windowHours}h allowance` : "Window allowance"}
          </p>
          <p className="text-sm">{delegation.windowAllowance} wstETH</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground">
            Spent in window
          </p>
          <p className="text-sm">{delegation.spentInWindow} wstETH</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Access</p>
          <p className="text-sm">
            {delegation.yieldOnly ? "Yield only" : "Full"}
          </p>
        </div>
      </div>
    </div>
  );
}
