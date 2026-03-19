"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Vault, TrendingUp, Users, Terminal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { WalletDisplay } from "@/components/wallet-display";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/treasury", label: "Treasury", icon: Vault },
  { href: "/staking", label: "Staking", icon: TrendingUp },
  { href: "/delegations", label: "Delegations", icon: Users },
  { href: "/playground", label: "Playground", icon: Terminal },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      className="group fixed left-0 top-0 z-40 flex h-screen w-14 flex-col border-r border-border bg-card transition-all duration-200 hover:w-60 focus-within:w-60"
      tabIndex={0}
      aria-label="Main navigation"
    >
      {/* Logo section */}
      <div className="flex h-14 items-center overflow-hidden whitespace-nowrap px-4">
        <span
          className="text-[28px] font-semibold text-primary"
          style={{ textShadow: "0 0 20px hsl(270 95% 65% / 0.5)" }}
        >
          <span className="inline group-hover:hidden group-focus-within:hidden">
            AG
          </span>
          <span className="hidden group-hover:inline group-focus-within:inline">
            AgentGate
          </span>
        </span>
      </div>

      <Separator />

      {/* Nav items */}
      <div className="flex flex-1 flex-col gap-1 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[44px] items-center gap-3 border-l-[3px] px-4 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isActive
                  ? "border-primary bg-muted/50"
                  : "border-transparent hover:bg-muted"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0 transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground group-hover/item:text-foreground"
                )}
              />
              <span
                className={cn(
                  "text-sm font-semibold whitespace-nowrap transition-opacity duration-200",
                  "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Wallet section */}
      <Separator />
      <div className="overflow-hidden px-3 py-3">
        <WalletDisplay />
      </div>
    </nav>
  );
}
