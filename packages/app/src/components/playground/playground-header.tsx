"use client";

import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

interface PlaygroundHeaderProps {
  toolCount: number;
  globalDryRun: boolean;
  onGlobalDryRunChange: (v: boolean) => void;
  isHumanView: boolean;
  onHumanViewChange: (v: boolean) => void;
}

export function PlaygroundHeader({
  toolCount,
  globalDryRun,
  onGlobalDryRunChange,
  isHumanView,
  onHumanViewChange,
}: PlaygroundHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center">
        <h1 className="text-xl font-semibold">MCP Playground</h1>
        <Badge variant="secondary" className="ml-3">
          {toolCount} tools
        </Badge>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Agent</span>
          <Switch
            checked={isHumanView}
            onCheckedChange={onHumanViewChange}
          />
          <span className="text-xs text-muted-foreground">Human</span>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={globalDryRun}
            onCheckedChange={onGlobalDryRunChange}
          />
          <span className="text-xs text-muted-foreground">Dry Run</span>
        </div>
      </div>
    </div>
  );
}
