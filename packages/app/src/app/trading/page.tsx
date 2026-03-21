"use client";

import { AavePosition } from "@/components/treasury/aave-position";

export default function TradingPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Autonomous Trading</h1>
      <AavePosition />
    </div>
  );
}
