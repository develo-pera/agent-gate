"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorCardProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorCard({ message, onRetry }: ErrorCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-destructive/30 bg-card/60 p-6 backdrop-blur-lg">
      <AlertCircle className="h-6 w-6 shrink-0 text-destructive" />
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{message}</p>
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}
