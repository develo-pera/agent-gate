"use client";

import { useLidoApr } from "@/lib/hooks/use-staking";
import { StatCard } from "@/components/shared/stat-card";
import { ErrorCard } from "@/components/shared/error-card";
import { Skeleton } from "@/components/ui/skeleton";

export function AprHero() {
  const { data, isLoading, error, refetch } = useLidoApr();

  if (isLoading) {
    return <Skeleton className="h-[120px] rounded-xl" />;
  }

  if (error) {
    return (
      <ErrorCard
        message="Failed to load staking data. Check your connection and try again."
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-lg">
      <div className="flex flex-col items-center justify-center gap-2 p-8">
        <StatCard
          label="Current Lido APR"
          value={`${data ? data.apr.toFixed(2) : "0.00"}%`}
          glow
        />
        <p className="text-xs text-muted-foreground text-center max-w-md">
          {data?.source === "fallback"
            ? "(estimated — live data unavailable)"
            : "Live rate from Ethereum mainnet. The treasury vault on this demo uses a simulated yield on a forked testnet, which may differ from this rate."}
        </p>
      </div>
    </div>
  );
}
