"use client";

import { VaultOverview } from "@/components/treasury/vault-overview";
import { DepositForm } from "@/components/treasury/deposit-form";
import { WithdrawForm } from "@/components/treasury/withdraw-form";
import { SwapEthCard } from "@/components/treasury/swap-eth-card";
import { HealthReport } from "@/components/staking/health-report";

export default function TreasuryPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Treasury Vault</h1>
      <VaultOverview />
      <HealthReport />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <SwapEthCard />
        <DepositForm />
      </div>
      <WithdrawForm />
    </div>
  );
}
