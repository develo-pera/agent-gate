import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlaceholderPageProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
}

export function PlaceholderPage({
  icon: Icon,
  title,
  subtitle = "Coming soon",
}: PlaceholderPageProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div
        className={cn(
          "flex max-w-[480px] flex-col items-center gap-4 rounded-xl border border-border/50 bg-card/60 p-8 text-center backdrop-blur-lg",
          "shadow-[0_0_24px_hsl(270_95%_65%/0.15)]"
        )}
      >
        <Icon className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
