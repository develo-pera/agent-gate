"use client";

import { AavePosition } from "@/components/treasury/aave-position";
import {
  Card,
  CardContent,
  CardTitle,
} from "@/components/ui/card";

const RECIPE_STEPS = [
  "Withdraw accrued yield from a delegated vault",
  "Swap wstETH to USDC via Uniswap V3",
  "Supply USDC to Aave V3 to earn lending interest",
  "Withdraw USDC + profit from Aave",
  "Transfer profit back to the vault depositor",
  "Re-deposit into the vault — principal grows (compounding)",
];

export default function TradingPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Autonomous Trading</h1>

      <Card className="border-border/50 bg-card/60 backdrop-blur-lg">
        <CardContent className="pt-6">
          <CardTitle className="text-lg font-semibold mb-3">
            Yield Harvest &amp; Lend
          </CardTitle>
          <p className="text-sm text-muted-foreground mb-4">
            A delegated agent autonomously executes a multi-step DeFi strategy using yield from the AgentTreasury vault — no human intervention after the initial delegation.
          </p>
          <ol className="list-decimal list-inside flex flex-col gap-1.5">
            {RECIPE_STEPS.map((step, i) => (
              <li key={i} className="text-sm text-muted-foreground">
                {step}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <AavePosition />
    </div>
  );
}
