"use client";

import { useState } from "react";
import { useMcpAction } from "@/lib/hooks/use-mcp-action";
import { useApp } from "@/providers/app-provider";
import { useVaultStatus } from "@/lib/hooks/use-treasury";
import { DryRunResult } from "@/components/shared/dry-run-result";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { formatEther } from "viem";

function formatWsteth(value: bigint): string {
  return parseFloat(formatEther(value)).toFixed(4);
}

export function WithdrawForm() {
  const [amount, setAmount] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const { execute, result, loading, error, reset } =
    useMcpAction("treasury_withdraw_yield");
  const { isDemo } = useApp();
  const { data: vaultData } = useVaultStatus();

  const [, availableYield] =
    (vaultData as [bigint, bigint, bigint, boolean] | undefined) ?? [
      0n, 0n, 0n, false,
    ];

  const yieldNum = parseFloat(formatEther(availableYield));
  const parsed = parseFloat(amount);
  const exceedsYield = parsed > 0 && parsed > yieldNum;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed || parsed <= 0 || exceedsYield) return;
    const data = await execute({ amount: parsed }, dryRun);
    if (data) setShowResult(true);
  };

  return (
    <Card className="flex flex-col border-border/50 bg-card/60 backdrop-blur-lg">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Withdraw Yield</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Amount (wstETH)</Label>
              {!isDemo && (
                <span className="text-xs text-muted-foreground">
                  Available: {formatWsteth(availableYield)} wstETH
                </span>
              )}
            </div>
            <Input
              type="number"
              min="0"
              step="0.0001"
              placeholder="0.0000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {exceedsYield && (
              <p className="text-xs text-destructive">
                Exceeds available yield. Only accrued yield can be withdrawn — principal is locked.
              </p>
            )}
          </div>

          <div className="mt-auto flex items-center gap-2">
            <Switch
              checked={dryRun}
              onCheckedChange={(checked) => setDryRun(checked)}
            />
            <Label>Simulate first</Label>
          </div>

          <Button
            type="submit"
            variant="secondary"
            className="w-full min-h-[44px]"
            disabled={!amount || parsed <= 0 || exceedsYield || loading}
          >
            {loading ? "Withdrawing..." : "Withdraw Yield"}
          </Button>

          {isDemo && (
            <p className="text-xs text-muted-foreground">
              Dry-run only in demo mode. Connect a wallet to execute
              transactions.
            </p>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          {showResult && result && (
            <DryRunResult
              data={result}
              onDismiss={() => {
                setShowResult(false);
                reset();
              }}
            />
          )}
        </form>
      </CardContent>
    </Card>
  );
}
