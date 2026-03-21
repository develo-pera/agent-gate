"use client";

import { useApp } from "@/providers/app-provider";
import { AprHero } from "@/components/staking/apr-hero";
import { PositionCard } from "@/components/staking/position-card";
import { HealthReport } from "@/components/staking/health-report";
import { ConnectPrompt } from "@/components/shared/connect-prompt";

export default function StakingPage() {
  const { isDemo } = useApp();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Staking Overview</h1>
      <AprHero />
      {isDemo ? (
        <ConnectPrompt
          title="Connect to View Position"
          description="Connect as an agent or with your wallet to view your staking position and vault health."
        />
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <PositionCard />
          <HealthReport />
        </div>
      )}
    </div>
  );
}
