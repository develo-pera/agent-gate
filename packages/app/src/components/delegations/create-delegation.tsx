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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DryRunResult } from "@/components/shared/dry-run-result";
import { useMcpAction } from "@/lib/hooks/use-mcp-action";
import { useDelegations } from "@/lib/hooks/use-delegations";
import { useApp } from "@/providers/app-provider";

interface CreateDelegationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SCOPE_OPTIONS = [
  { value: "yield_withdrawal", label: "Yield Withdrawal" },
  { value: "full_access", label: "Full Access" },
  { value: "limited_transfer", label: "Limited Transfer" },
] as const;

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function CreateDelegation({ open, onOpenChange }: CreateDelegationProps) {
  const [delegateAddress, setDelegateAddress] = useState("");
  const [scope, setScope] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const [addressTouched, setAddressTouched] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);
  const [scopeTouched, setScopeTouched] = useState(false);

  const { execute, result, loading, error, reset } =
    useMcpAction("delegate_create");
  const { setSessionDelegations } = useDelegations();
  const { isDemo } = useApp();

  const addressValid = isValidAddress(delegateAddress);
  const amountValid = parseFloat(maxAmount) > 0;
  const scopeValid = scope.length > 0;
  const formValid = addressValid && amountValid && scopeValid;

  const handleSubmit = async () => {
    setScopeTouched(true);
    setAddressTouched(true);
    setAmountTouched(true);
    if (!formValid) return;

    const res = await execute(
      {
        delegate_address: delegateAddress,
        scope,
        max_amount: parseFloat(maxAmount),
      },
      dryRun,
    );

    setShowResult(true);

    if (!dryRun && !isDemo && res) {
      setSessionDelegations((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          delegate: delegateAddress,
          scope,
          caveats: { maxAmount, token: "wstETH" },
          status: "active" as const,
          createdAt: new Date().toISOString(),
        },
      ]);
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Create Delegation</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4">
          {/* Delegate Address */}
          <div className="space-y-2">
            <Label htmlFor="delegate-address">Delegate Address</Label>
            <Input
              id="delegate-address"
              placeholder="0x..."
              value={delegateAddress}
              onChange={(e) => setDelegateAddress(e.target.value)}
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

          {/* Scope Selector */}
          <div className="space-y-2">
            <Label>Scope</Label>
            <Select
              value={scope}
              onValueChange={(value) => {
                setScope(value as string);
                setScopeTouched(true);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a scope" />
              </SelectTrigger>
              <SelectContent>
                {SCOPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {scopeTouched && !scopeValid && (
              <p className="text-xs text-destructive">Select a scope</p>
            )}
          </div>

          {/* Max Amount */}
          <div className="space-y-2">
            <Label htmlFor="max-amount">Max Amount (wstETH)</Label>
            <Input
              id="max-amount"
              type="number"
              placeholder="0.0"
              min="0"
              step="0.01"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              onBlur={() => setAmountTouched(true)}
              className={
                amountTouched && !amountValid ? "border-destructive" : ""
              }
            />
            {amountTouched && !amountValid && (
              <p className="text-xs text-destructive">
                Amount must be greater than 0
              </p>
            )}
          </div>

          {/* Dry-Run Toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="dry-run-toggle">Dry-run (simulate first)</Label>
            <Switch
              id="dry-run-toggle"
              checked={isDemo ? true : dryRun}
              onCheckedChange={(checked) => setDryRun(checked)}
              disabled={isDemo}
            />
          </div>

          {isDemo && (
            <p className="text-xs text-muted-foreground">
              Dry-run only in demo mode. Connect a wallet to execute
              transactions.
            </p>
          )}

          {/* Error */}
          {error && <p className="text-xs text-destructive">{error}</p>}

          {/* Dry-run result */}
          {showResult && result && (
            <DryRunResult
              data={result}
              onDismiss={() => {
                setShowResult(false);
                reset();
              }}
            />
          )}

          {/* Submit */}
          <Button
            className="min-h-[44px] w-full"
            disabled={!formValid || loading}
            onClick={handleSubmit}
          >
            {loading ? "Creating..." : "Create Delegation"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
