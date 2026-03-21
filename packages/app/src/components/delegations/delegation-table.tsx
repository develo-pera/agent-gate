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
import type { SpenderDelegation } from "@/lib/hooks/use-delegations";

interface DelegationTableProps {
  delegations: SpenderDelegation[];
}

export function DelegationTable({ delegations }: DelegationTableProps) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Direction</TableHead>
            <TableHead>Counterparty</TableHead>
            <TableHead>Max / tx</TableHead>
            <TableHead>Daily Cap</TableHead>
            <TableHead>Spent</TableHead>
            <TableHead>Access</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {delegations.map((d) => {
            const isGranted = d.direction === "granted";
            return (
              <TableRow key={d.id}>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      isGranted
                        ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                        : "border-purple-500/30 bg-purple-500/10 text-purple-400"
                    }
                  >
                    {isGranted ? "Granted" : "Received"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <AddressDisplay
                    address={isGranted ? d.spender : d.owner}
                  />
                </TableCell>
                <TableCell>{d.maxPerTx} wstETH</TableCell>
                <TableCell>{d.windowAllowance} wstETH</TableCell>
                <TableCell>{d.spentInWindow} wstETH</TableCell>
                <TableCell>
                  {d.yieldOnly ? "Yield only" : "Full"}
                </TableCell>
                <TableCell>
                  <Badge className="bg-success/20 text-success border-success/30">
                    Active
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
