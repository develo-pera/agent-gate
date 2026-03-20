"use client";

import { useState, useCallback } from "react";
import { Users } from "lucide-react";
import { useDelegations } from "@/lib/hooks/use-delegations";
import { DelegationCard } from "@/components/delegations/delegation-card";
import { DelegationTable } from "@/components/delegations/delegation-table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { shortenAddress } from "@/lib/format";
import { CreateDelegation } from "@/components/delegations/create-delegation";
import { RedeemDelegation } from "@/components/delegations/redeem-delegation";

export default function DelegationsPage() {
  const [view, setView] = useState<"cards" | "table">("cards");
  const [createOpen, setCreateOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemDelegationId, setRedeemDelegationId] = useState<string | null>(
    null,
  );
  const [revokeTarget, setRevokeTarget] = useState<{
    id: string;
    delegate: string;
  } | null>(null);

  const { delegations, setSessionDelegations } = useDelegations();

  const handleRedeem = useCallback(
    (id: string) => {
      setRedeemDelegationId(id);
      setRedeemOpen(true);
    },
    [],
  );

  const handleRevokeRequest = useCallback(
    (id: string) => {
      const delegation = delegations.find((d) => d.id === id);
      if (delegation) {
        setRevokeTarget({ id, delegate: delegation.delegate });
      }
    },
    [delegations],
  );

  const handleRevokeConfirm = useCallback(() => {
    if (!revokeTarget) return;
    setSessionDelegations((prev) =>
      prev.filter((d) => d.id !== revokeTarget.id),
    );
    setRevokeTarget(null);
  }, [revokeTarget, setSessionDelegations]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Delegations</h1>
        <div className="flex items-center gap-3">
          <Button onClick={() => setCreateOpen(true)}>
            Create Delegation
          </Button>
          <Tabs
            value={view}
            onValueChange={(value) => setView(value as "cards" | "table")}
          >
            <TabsList>
              <TabsTrigger value="cards">Cards</TabsTrigger>
              <TabsTrigger value="table">Table</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {delegations.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border/50 bg-card/60 p-12 backdrop-blur-lg">
          <Users className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-lg font-semibold">No Active Delegations</h2>
          <p className="max-w-md text-center text-sm text-muted-foreground">
            No ERC-7710 delegations found. Create one to delegate specific
            permissions to another address.
          </p>
          <Button onClick={() => setCreateOpen(true)}>
            Create Delegation
          </Button>
        </div>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {delegations.map((delegation) => (
            <DelegationCard
              key={delegation.id}
              delegation={delegation}
              onRedeem={handleRedeem}
              onRevoke={handleRevokeRequest}
            />
          ))}
        </div>
      ) : (
        <DelegationTable
          delegations={delegations}
          onRedeem={handleRedeem}
          onRevoke={handleRevokeRequest}
        />
      )}

      {/* Revoke confirmation dialog */}
      <Dialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Delegation</DialogTitle>
            <DialogDescription>
              This will permanently remove delegation permissions for{" "}
              {revokeTarget ? shortenAddress(revokeTarget.delegate) : ""}. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setRevokeTarget(null)}
            >
              Keep Delegation
            </Button>
            <Button variant="destructive" onClick={handleRevokeConfirm}>
              Revoke Delegation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create delegation sheet */}
      {createOpen && (
        <CreateDelegation open={createOpen} onOpenChange={setCreateOpen} />
      )}

      {/* Redeem delegation sheet */}
      {redeemOpen && (
        <RedeemDelegation
          open={redeemOpen}
          onOpenChange={setRedeemOpen}
          delegationId={redeemDelegationId}
        />
      )}
    </div>
  );
}
