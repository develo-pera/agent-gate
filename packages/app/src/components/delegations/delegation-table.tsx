"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddressDisplay } from "@/components/shared/address-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Delegation } from "@/lib/hooks/use-delegations";

interface DelegationTableProps {
  delegations: Delegation[];
  onRedeem: (id: string) => void;
  onRevoke: (id: string) => void;
}

export function DelegationTable({
  delegations,
  onRedeem,
  onRevoke,
}: DelegationTableProps) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Delegate</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead>Caveat</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {delegations.map((d) => {
            const isActive = d.status === "active";
            return (
              <TableRow key={d.id}>
                <TableCell>
                  <AddressDisplay address={d.delegate} />
                </TableCell>
                <TableCell>{d.scope}</TableCell>
                <TableCell>
                  Max: {d.caveats.maxAmount} {d.caveats.token}
                </TableCell>
                <TableCell>
                  {isActive ? (
                    <Badge className="bg-success/20 text-success border-success/30">
                      Live
                    </Badge>
                  ) : (
                    <Badge className="bg-muted text-muted-foreground">
                      Expired
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onRedeem(d.id)}
                    >
                      Redeem Delegation
                    </Button>
                    {isActive && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onRevoke(d.id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
