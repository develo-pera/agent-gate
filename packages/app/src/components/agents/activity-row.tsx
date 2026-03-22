"use client";

import type { ActivityEvent } from "@agentgate/mcp-server/activity-log";
import { Badge } from "@/components/ui/badge";
import { Link as LinkIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityRowProps {
  event: ActivityEvent;
  isNew?: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function StatusBadge({ status }: { status: ActivityEvent["status"] }) {
  if (status === "success") {
    return (
      <Badge className="bg-success/20 text-success border-success/30">
        success
      </Badge>
    );
  }
  if (status === "error") {
    return <Badge variant="destructive">error</Badge>;
  }
  return <Badge variant="secondary">pending</Badge>;
}

export function ActivityRow({
  event,
  isNew,
  isExpanded,
  onToggle,
}: ActivityRowProps) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    }
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors border-b border-border",
          isNew && "ring-1 ring-primary/30"
        )}
      >
        <span className="w-16 shrink-0 text-xs font-mono text-muted-foreground">
          {formatTimestamp(event.timestamp)}
        </span>
        <span className="w-24 shrink-0 text-sm font-semibold truncate">
          {event.agentId}
        </span>
        <span className="flex-1 text-sm font-mono truncate">
          {event.toolName}
        </span>
        {event.txHash != null && (
          <span className="flex items-center gap-1 shrink-0">
            <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-mono text-muted-foreground">
              {event.txHash.slice(0, 6)}...{event.txHash.slice(-4)}
            </span>
          </span>
        )}
        <StatusBadge status={event.status} />
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            isExpanded && "rotate-180"
          )}
        />
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="bg-secondary px-4 py-3">
            <div className="mb-2">
              <p className="text-xs font-semibold text-muted-foreground">
                Parameters
              </p>
              <pre className="mt-1 max-h-[160px] overflow-auto font-mono text-xs text-foreground">
                {JSON.stringify(event.params, null, 2)}
              </pre>
            </div>
            {event.result !== null && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  Result
                </p>
                <pre className="mt-1 max-h-[160px] overflow-auto font-mono text-xs text-foreground">
                  {JSON.stringify(event.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
