"use client";

import { useState } from "react";
import { useMcpAction } from "@/lib/hooks/use-mcp-action";
import { useApp } from "@/providers/app-provider";
import { DryRunResult } from "@/components/shared/dry-run-result";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

export function WithdrawForm() {
  const [amount, setAmount] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const { execute, result, loading, error, reset } =
    useMcpAction("treasury_withdraw_yield");
  const { isDemo } = useApp();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return;
    const data = await execute({ amount: parsed }, dryRun);
    if (data) setShowResult(true);
  };

  return (
    <Card className="border-border/50 bg-card/60 backdrop-blur-lg">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Withdraw Yield</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Amount (wstETH)</Label>
            <Input
              type="number"
              min="0"
              step="0.0001"
              placeholder="0.0000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
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
            disabled={!amount || parseFloat(amount) <= 0 || loading}
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
