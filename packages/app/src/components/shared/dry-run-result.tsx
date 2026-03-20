"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DryRunResultProps {
  data: Record<string, unknown>;
  onDismiss: () => void;
}

export function DryRunResult({ data, onDismiss }: DryRunResultProps) {
  const succeeded = data.would_succeed !== false;
  const isDryRun = data.mode === "dry_run";

  return (
    <div
      className={`relative rounded-xl border p-4 ${
        succeeded
          ? "border-success/30 bg-success/5"
          : "border-destructive/30 bg-destructive/5"
      }`}
    >
      <Button
        variant="ghost"
        size="icon-xs"
        className="absolute right-2 top-2"
        onClick={onDismiss}
      >
        <X className="h-4 w-4" />
      </Button>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Badge variant={succeeded ? "default" : "destructive"}>
            {succeeded ? "Simulation passed" : "Simulation failed"}
          </Badge>
          {isDryRun && (
            <span className="text-xs text-muted-foreground">Dry run</span>
          )}
        </div>

        {"demo_note" in data && data.demo_note != null && (
          <p className="text-xs text-muted-foreground">
            {String(data.demo_note)}
          </p>
        )}

        <pre className="overflow-x-auto rounded-lg bg-card/60 p-3 text-xs text-muted-foreground">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
}
