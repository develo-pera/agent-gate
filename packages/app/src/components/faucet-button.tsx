"use client";

import { useState } from "react";
import { useAccount, useBalance, useSignMessage } from "wagmi";
import { Droplets, Check, Loader2, Wallet } from "lucide-react";
import { formatEther } from "viem";

const FAUCET_MESSAGE = "I am requesting 1 test ETH from the AgentGate faucet";

export function FaucetButton() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { data: balance, refetch: refetchBalance } = useBalance({
    address,
    query: { enabled: isConnected && !!address, refetchInterval: 5_000 },
  });
  const [status, setStatus] = useState<"idle" | "signing" | "loading" | "success" | "claimed" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  if (!isConnected || !address) return null;

  const ethBalance = balance ? parseFloat(formatEther(balance.value)).toFixed(4) : null;
  const hasBalance = balance && balance.value > 0n;

  const handleClaim = async () => {
    setErrorMsg("");

    try {
      // Step 1: Sign message to prove wallet ownership
      setStatus("signing");
      const signature = await signMessageAsync({ message: FAUCET_MESSAGE });

      // Step 2: Submit to faucet API
      setStatus("loading");
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setStatus("claimed");
        } else {
          setStatus("error");
          setErrorMsg(data.error || "Request failed");
        }
        return;
      }

      setStatus("success");
      refetchBalance();
    } catch (e) {
      // User rejected the signature
      if (e instanceof Error && e.message.includes("User rejected")) {
        setStatus("idle");
        return;
      }
      setStatus("error");
      setErrorMsg("Request failed");
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* ETH balance on the fork */}
      {ethBalance !== null && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Wallet className="h-3 w-3" />
          {ethBalance} ETH
        </span>
      )}

      {/* Faucet action */}
      {status === "success" ? (
        <span className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-400">
          <Check className="h-3.5 w-3.5" />
          1 ETH received
        </span>
      ) : status === "claimed" ? (
        <span className="flex items-center gap-1.5 rounded-lg bg-muted/50 border border-border/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <Check className="h-3.5 w-3.5" />
          Already claimed
        </span>
      ) : (
        <>
          <button
            onClick={handleClaim}
            disabled={status === "signing" || status === "loading"}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 px-3 py-1.5 text-xs font-medium text-cyan-400 transition-all hover:border-cyan-500/50 hover:from-cyan-500/15 hover:to-blue-500/15 disabled:opacity-50"
          >
            {status === "signing" || status === "loading" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Droplets className="h-3.5 w-3.5" />
            )}
            {status === "signing" ? "Sign in wallet..." : "Request 1 test ETH"}
          </button>
          {status === "error" && (
            <span className="text-xs text-red-400">{errorMsg}</span>
          )}
        </>
      )}
    </div>
  );
}
