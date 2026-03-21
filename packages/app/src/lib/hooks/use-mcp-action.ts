"use client";

import { useState, useCallback } from "react";
import { useApp } from "@/providers/app-provider";
import { sendTransaction, waitForTransactionReceipt } from "wagmi/actions";
import { wagmiConfig } from "@/lib/wagmi-config";

interface UnsignedTx {
  to: `0x${string}`;
  data: `0x${string}`;
  value: string;
  chainId: number;
  meta?: { tool: string; description: string };
}

export function useMcpAction(toolName: string) {
  const { isDemo, activeAddress } = useApp();
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (params: Record<string, unknown>, dryRun: boolean) => {
      setLoading(true);
      setError(null);
      const forceDryRun = isDemo ? true : dryRun;

      try {
        const res = await fetch(`/api/mcp/${toolName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...params,
            wallet_address: activeAddress,
            dry_run: forceDryRun,
          }),
        });
        const data = await res.json();
        if (!data.success) {
          setError(data.error || "Unknown error");
          const resultData = data.data || data;
          setResult(resultData);
          return resultData;
        }

        const resultData = data.data || data;

        // If bridge returned unsigned transactions, sign and submit via wallet
        if (resultData.mode === "unsigned_transaction" && resultData.transactions?.length > 0) {
          const txResults = [];
          for (const tx of resultData.transactions as UnsignedTx[]) {
            const hash = await sendTransaction(wagmiConfig, {
              to: tx.to,
              data: tx.data,
              value: tx.value !== "0" ? BigInt(tx.value) : undefined,
            });
            const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });
            txResults.push({
              tx_hash: hash,
              status: receipt.status,
              block_number: receipt.blockNumber.toString(),
            });
          }

          const finalResult = {
            mode: "executed",
            action: toolName,
            ...txResults[txResults.length - 1],
          };
          setResult(finalResult);
          return finalResult;
        }

        setResult(resultData);
        return resultData;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Network error";
        // User rejected wallet signature — don't show as error
        if (msg.includes("User rejected") || msg.includes("user rejected")) {
          setLoading(false);
          return null;
        }
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [isDemo, activeAddress, toolName],
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { execute, result, loading, error, reset };
}
