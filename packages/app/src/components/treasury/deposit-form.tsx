"use client";

import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { formatEther } from "viem";
import { useMcpAction } from "@/lib/hooks/use-mcp-action";
import { useApp } from "@/providers/app-provider";
import { DryRunResult } from "@/components/shared/dry-run-result";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

const WSTETH_ADDRESS = "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452" as const;
const ERC20_BALANCE_ABI = [{
  name: "balanceOf", type: "function", stateMutability: "view",
  inputs: [{ name: "account", type: "address" }],
  outputs: [{ name: "", type: "uint256" }],
}] as const;

export function DepositForm() {
  const [amount, setAmount] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const { execute, result, loading, error, reset } =
    useMcpAction("treasury_deposit");
  const { isDemo } = useApp();
  const { address, isConnected } = useAccount();
  const { data: wstethRaw } = useReadContract({
    address: WSTETH_ADDRESS,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address, refetchInterval: 5_000 },
  });

  const walletBalance = wstethRaw ? parseFloat(formatEther(wstethRaw as bigint)) : 0;
  const walletBalanceStr = walletBalance.toFixed(4);
  const parsed = parseFloat(amount);
  const exceedsBalance = parsed > 0 && parsed > walletBalance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return;
    const data = await execute({ amount: parsed }, dryRun);
    if (data) setShowResult(true);
  };

  return (
    <Card className="flex flex-col border-border/50 bg-card/60 backdrop-blur-lg">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Deposit wstETH</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Amount (wstETH)</Label>
              {isConnected && (
                <span className="text-xs text-muted-foreground">
                  Balance: {walletBalanceStr} wstETH
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
            {exceedsBalance && (
              <p className="text-xs text-destructive">
                Exceeds wallet balance.
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
            className="w-full min-h-[44px]"
            disabled={!amount || parsed <= 0 || exceedsBalance || loading}
          >
            {loading ? "Depositing..." : "Deposit wstETH"}
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
