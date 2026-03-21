"use client";

import { VaultOverview } from "@/components/treasury/vault-overview";
import { AavePosition } from "@/components/treasury/aave-position";
import { DepositForm } from "@/components/treasury/deposit-form";
import { WithdrawForm } from "@/components/treasury/withdraw-form";
export default function TreasuryPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Treasury Vault</h1>
      <VaultOverview />
      <AavePosition />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <DepositForm />
        <WithdrawForm />
      </div>
    </div>
  );
}
