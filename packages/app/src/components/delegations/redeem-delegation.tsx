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
import { Button } from "@/components/ui/button";
import { DryRunResult } from "@/components/shared/dry-run-result";
import { useMcpAction } from "@/lib/hooks/use-mcp-action";
import { useApp } from "@/providers/app-provider";

interface RedeemDelegationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delegationId: string | null;
}

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function isValidCalldata(data: string): boolean {
  return /^0x[a-fA-F0-9]*$/.test(data);
}

export function RedeemDelegation({
  open,
  onOpenChange,
  delegationId,
}: RedeemDelegationProps) {
  const [targetContract, setTargetContract] = useState("");
  const [calldata, setCalldata] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const [contractTouched, setContractTouched] = useState(false);
  const [calldataTouched, setCalldataTouched] = useState(false);

  const { execute, result, loading, error, reset } =
    useMcpAction("delegate_redeem");
  const { isDemo } = useApp();

  const contractValid = isValidAddress(targetContract);
  const calldataValid = isValidCalldata(calldata) && calldata.length >= 2;
  const formValid = contractValid && calldataValid;

  const handleSubmit = async () => {
    setContractTouched(true);
    setCalldataTouched(true);
    if (!formValid) return;

    await execute(
      {
        delegation_id: delegationId,
        target_contract: targetContract,
        calldata,
      },
      dryRun,
    );
    setShowResult(true);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Redeem Delegation</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4">
          {/* Target Contract */}
          <div className="space-y-2">
            <Label htmlFor="target-contract">Target Contract</Label>
            <Input
              id="target-contract"
              placeholder="0x..."
              value={targetContract}
              onChange={(e) => setTargetContract(e.target.value)}
              onBlur={() => setContractTouched(true)}
              className={
                contractTouched && !contractValid ? "border-destructive" : ""
              }
            />
            {contractTouched && !contractValid && (
              <p className="text-xs text-destructive">
                Invalid address format
              </p>
            )}
          </div>

          {/* Calldata */}
          <div className="space-y-2">
            <Label htmlFor="calldata">Calldata</Label>
            <textarea
              id="calldata"
              placeholder="0x..."
              value={calldata}
              onChange={(e) => setCalldata(e.target.value)}
              onBlur={() => setCalldataTouched(true)}
              className={`flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono ${
                calldataTouched && !calldataValid ? "border-destructive" : ""
              }`}
            />
            {calldataTouched && !calldataValid ? (
              <p className="text-xs text-destructive">
                Invalid calldata format
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Enter hex-encoded calldata
              </p>
            )}
          </div>

          {/* Dry-Run Toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="redeem-dry-run">Dry-run (simulate first)</Label>
            <Switch
              id="redeem-dry-run"
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
            {loading ? "Redeeming..." : "Redeem Delegation"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
