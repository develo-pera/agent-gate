import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  glow?: boolean;
}

export function StatCard({ label, value, subValue, glow }: StatCardProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "text-3xl font-semibold",
          glow &&
            "text-primary [text-shadow:0_0_20px_hsl(270_95%_65%/0.5)]",
        )}
      >
        {value}
      </span>
      {subValue && (
        <span className="text-sm text-muted-foreground">{subValue}</span>
      )}
    </div>
  );
}
