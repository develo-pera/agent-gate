"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ExecutionStatusBarProps {
  status: {
    code: number;
    time: number;
    mode: "success" | "error" | "dry_run";
  } | null;
}

export function ExecutionStatusBar({ status }: ExecutionStatusBarProps) {
  if (!status) return null;

  return (
    <div className="my-3">
      <Separator />
      <div className="flex items-center gap-3 py-2">
        {status.mode === "success" && (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            Success
          </Badge>
        )}
        {status.mode === "error" && (
          <Badge variant="destructive">Error</Badge>
        )}
        {status.mode === "dry_run" && (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
            Dry Run
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">{status.time}ms</span>
        <span className="text-xs text-muted-foreground">
          {status.code > 0 ? status.code : "---"}
        </span>
      </div>
    </div>
  );
}
