"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { useDelegations } from "@/lib/hooks/use-delegations";
import { DelegationCard } from "@/components/delegations/delegation-card";
import { DelegationTable } from "@/components/delegations/delegation-table";
import { CreateDelegation } from "@/components/delegations/create-delegation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function DelegationsPage() {
  const [view, setView] = useState<"cards" | "table">("cards");
  const [createOpen, setCreateOpen] = useState(false);
  const { delegations, isLoading } = useDelegations();

  if (isLoading) {
    return <Skeleton className="h-[200px] rounded-xl" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Delegations</h1>
        <div className="flex items-center gap-3">
          <Button onClick={() => setCreateOpen(true)}>
            Authorize Spender
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
            No authorized spenders found for this vault. Use the button above or
            MCP tools to authorize a spender agent.
          </p>
          <Button onClick={() => setCreateOpen(true)}>
            Authorize Spender
          </Button>
        </div>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {delegations.map((delegation) => (
            <DelegationCard key={delegation.id} delegation={delegation} />
          ))}
        </div>
      ) : (
        <DelegationTable delegations={delegations} />
      )}

      {createOpen && (
        <CreateDelegation open={createOpen} onOpenChange={setCreateOpen} />
      )}
    </div>
  );
}
