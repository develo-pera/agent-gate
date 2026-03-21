"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DryRunResult } from "@/components/shared/dry-run-result";
import { useMcpAction } from "@/lib/hooks/use-mcp-action";

interface CreateDelegationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function CreateDelegation({ open, onOpenChange }: CreateDelegationProps) {
  const [spenderAddress, setSpenderAddress] = useState("");
  const [maxPerTx, setMaxPerTx] = useState("");
  const [dailyCap, setDailyCap] = useState("");
  const [showResult, setShowResult] = useState(false);

  const [addressTouched, setAddressTouched] = useState(false);

  const { execute, result, loading, error, reset } =
    useMcpAction("treasury_authorize_spender");

  const addressValid = isValidAddress(spenderAddress);
  const maxPerTxValid = !maxPerTx || parseFloat(maxPerTx) > 0;
  const dailyCapValid = !dailyCap || parseFloat(dailyCap) > 0;
  const formValid = addressValid && maxPerTxValid && dailyCapValid;

  const handleSubmit = async () => {
    setAddressTouched(true);
    if (!formValid) return;

    const params: Record<string, unknown> = {
      spender: spenderAddress,
    };
    if (maxPerTx) params.max_per_tx = maxPerTx;
    if (dailyCap) {
      params.window_allowance = dailyCap;
      params.window_duration_seconds = 86400;
    }

    const res = await execute(params, true);
    setShowResult(true);

    if (res) {
      // Dry-run only from dashboard — agents execute via MCP directly
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Authorize Spender</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4">
          <div className="space-y-2">
            <Label htmlFor="spender-address">Spender Address</Label>
            <Input
              id="spender-address"
              placeholder="0x..."
              value={spenderAddress}
              onChange={(e) => setSpenderAddress(e.target.value)}
              onBlur={() => setAddressTouched(true)}
              className={
                addressTouched && !addressValid ? "border-destructive" : ""
              }
            />
            {addressTouched && !addressValid && (
              <p className="text-xs text-destructive">
                Invalid address format
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-per-tx">Max per Transaction (wstETH)</Label>
            <Input
              id="max-per-tx"
              type="number"
              placeholder="0.001"
              min="0"
              step="0.001"
              value={maxPerTx}
              onChange={(e) => setMaxPerTx(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="daily-cap">Daily Cap (wstETH)</Label>
            <Input
              id="daily-cap"
              type="number"
              placeholder="0.005"
              min="0"
              step="0.001"
              value={dailyCap}
              onChange={(e) => setDailyCap(e.target.value)}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Preview only — agents execute authorizations via MCP tools directly.
          </p>

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

          <Button
            className="min-h-[44px] w-full"
            disabled={!formValid || loading}
            onClick={handleSubmit}
          >
            {loading ? "Simulating..." : "Preview Authorization"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
