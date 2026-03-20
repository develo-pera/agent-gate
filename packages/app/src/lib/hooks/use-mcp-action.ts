"use client";

import { useState, useCallback } from "react";
import { useApp } from "@/providers/app-provider";

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
        }
        const resultData = data.data || data;
        setResult(resultData);
        return resultData;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Network error";
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
