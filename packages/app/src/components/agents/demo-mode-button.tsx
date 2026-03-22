"use client";

import { Button } from "@/components/ui/button";

interface DemoModeButtonProps {
  onStart: () => void;
  isRunning: boolean;
  hasEvents: boolean;
}

export function DemoModeButton({
  onStart,
  isRunning,
  hasEvents,
}: DemoModeButtonProps) {
  if (hasEvents) return null;

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <div className="text-center">
        <p className="text-lg font-semibold text-foreground">No activity yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Agents are registered but haven&apos;t made any tool calls. Run a demo
          to see the dashboard in action.
        </p>
      </div>
      <Button
        onClick={onStart}
        disabled={isRunning}
        className="bg-primary hover:bg-primary/90"
      >
        {isRunning ? "Running..." : "Run Demo"}
      </Button>
    </div>
  );
}
