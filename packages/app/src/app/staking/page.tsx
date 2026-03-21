"use client";

import { useApp } from "@/providers/app-provider";
import { AprHero } from "@/components/staking/apr-hero";
import { PositionCard } from "@/components/staking/position-card";
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
          description="Connect as an agent or with your wallet to view your staking position."
        />
      ) : (
        <PositionCard />
      )}
    </div>
  );
}
