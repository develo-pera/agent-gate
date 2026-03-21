"use client";

import { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { sendTransaction, waitForTransactionReceipt } from "wagmi/actions";
import { wagmiConfig } from "@/lib/wagmi-config";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { DryRunResult } from "@/components/shared/dry-run-result";
import { Loader2, Check, RefreshCw } from "lucide-react";

export function SwapEthCard() {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [quote, setQuote] = useState<{ amount_out: string; fee_tier: string } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "swapping" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");
  const [showResult, setShowResult] = useState(false);

  const fetchQuote = useCallback(async (value: string) => {
    const parsed = parseFloat(value);
    if (!parsed || parsed <= 0) {
      setQuote(null);
      return;
    }

    setQuoteLoading(true);
    try {
      const res = await fetch("/api/swap?action=quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: value }),
      });
      const data = await res.json();
      if (res.ok) {
        setQuote(data);
      } else {
        setQuote(null);
      }
    } catch {
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  }, []);

  const handleAmountChange = (value: string) => {
    setAmount(value);
    setStatus("idle");
    setError("");
    setShowResult(false);
    const timeout = setTimeout(() => fetchQuote(value), 400);
    return () => clearTimeout(timeout);
  };

  const handleSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !amount || !quote) return;

    // Simulate first: just show the quote as a dry-run result
    if (dryRun) {
      setShowResult(true);
      return;
    }

    setStatus("swapping");
    setError("");

    try {
      const res = await fetch("/api/swap?action=execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, recipient: address }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setError(data.error || "Swap failed");
        return;
      }

      for (const tx of data.transactions) {
        const hash = await sendTransaction(wagmiConfig, {
          to: tx.to as `0x${string}`,
          data: tx.data as `0x${string}`,
          value: tx.value !== "0" ? BigInt(tx.value) : undefined,
        });
        await waitForTransactionReceipt(wagmiConfig, { hash });
        setTxHash(hash);
      }

      setStatus("success");
      setQuote({ ...quote, amount_out: data.quote.expected_out });
    } catch (e) {
      if (e instanceof Error && (e.message.includes("User rejected") || e.message.includes("user rejected"))) {
        setStatus("idle");
        return;
      }
      setStatus("error");
      setError(e instanceof Error ? e.message : "Swap failed");
    }
  };

  const handleReset = () => {
    setAmount("");
    setQuote(null);
    setStatus("idle");
    setTxHash("");
    setError("");
    setShowResult(false);
  };

  const parsed = parseFloat(amount);
  const canSwap = isConnected && parsed > 0 && quote && status !== "swapping";

  return (
    <Card className="flex flex-col border-border/50 bg-card/60 backdrop-blur-lg">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Swap ETH → wstETH</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {status === "success" ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
              <Check className="h-6 w-6 text-emerald-400" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">Swap successful</p>
              <p className="text-sm text-muted-foreground">
                {amount} ETH → {quote?.amount_out} wstETH
              </p>
              {txHash && (
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {txHash.slice(0, 10)}...{txHash.slice(-8)}
                </p>
              )}
            </div>
            <Button variant="secondary" size="sm" onClick={handleReset}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Swap again
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSwap} className="flex flex-1 flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Amount (ETH)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>You receive (wstETH)</Label>
              <div className="flex h-10 items-center rounded-md border border-input bg-background px-3 text-sm">
                {quoteLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : quote ? (
                  <span>{parseFloat(quote.amount_out).toFixed(6)}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
              {quote && (
                <p className="text-xs text-muted-foreground">
                  Pool fee: {quote.fee_tier} · 0.5% slippage tolerance
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
              disabled={!canSwap}
            >
              {status === "swapping" ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Confirm in wallet...
                </>
              ) : (
                "Swap"
              )}
            </Button>

            {!isConnected && (
              <p className="text-xs text-muted-foreground">
                Dry-run only in demo mode. Connect a wallet to swap ETH for wstETH.
              </p>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}

            {showResult && quote && (
              <DryRunResult
                data={{
                  mode: "dry_run",
                  action: "swap_eth_wsteth",
                  amount_in: amount + " ETH",
                  expected_out: quote.amount_out + " wstETH",
                  fee_tier: quote.fee_tier,
                  slippage: "0.5%",
                  would_succeed: true,
                }}
                onDismiss={() => setShowResult(false)}
              />
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
