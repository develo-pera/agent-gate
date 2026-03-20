import { AprHero } from "@/components/staking/apr-hero";
import { PositionCard } from "@/components/staking/position-card";
import { HealthReport } from "@/components/staking/health-report";

export default function StakingPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Staking Overview</h1>
      <AprHero />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <PositionCard />
        <HealthReport />
      </div>
    </div>
  );
}
