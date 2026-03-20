"use client";

import { AddressDisplay } from "@/components/shared/address-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Delegation } from "@/lib/hooks/use-delegations";

interface DelegationCardProps {
  delegation: Delegation;
  onRedeem: (id: string) => void;
  onRevoke: (id: string) => void;
}

export function DelegationCard({
  delegation,
  onRedeem,
  onRevoke,
}: DelegationCardProps) {
  const isActive = delegation.status === "active";

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-6 backdrop-blur-lg">
      <div className="flex items-center justify-between">
        <AddressDisplay address={delegation.delegate} />
        {isActive ? (
          <Badge className="bg-success/20 text-success border-success/30">
            Live
          </Badge>
        ) : (
          <Badge className="bg-muted text-muted-foreground">Expired</Badge>
        )}
      </div>

      <div className="mt-4 space-y-2">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Scope</p>
          <p className="text-sm">{delegation.scope}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Caveats</p>
          <p className="text-sm">
            Max: {delegation.caveats.maxAmount} {delegation.caveats.token}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onRedeem(delegation.id)}
        >
          Redeem Delegation
        </Button>
        {isActive && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onRevoke(delegation.id)}
          >
            Revoke
          </Button>
        )}
      </div>
    </div>
  );
}
