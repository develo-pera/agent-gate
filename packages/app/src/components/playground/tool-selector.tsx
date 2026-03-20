"use client";

import { useState, useMemo } from "react";
import {
  getToolsByDomain,
  DOMAIN_ORDER,
  type Domain,
} from "@/lib/tool-schemas";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronDown, ChevronRight } from "lucide-react";

interface ToolSelectorProps {
  selectedTool: string | null;
  onSelectTool: (name: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isHumanView: boolean;
}

export function ToolSelector({
  selectedTool,
  onSelectTool,
  searchQuery,
  onSearchChange,
  isHumanView,
}: ToolSelectorProps) {
  const [collapsedDomains, setCollapsedDomains] = useState<Set<Domain>>(
    new Set()
  );
  const toolsByDomain = useMemo(() => getToolsByDomain(), []);

  const toggleDomain = (domain: Domain) => {
    setCollapsedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  };

  const query = searchQuery.toLowerCase();

  return (
    <div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter tools..."
          className="pl-9"
        />
      </div>

      {DOMAIN_ORDER.map((domain) => {
        const tools = toolsByDomain[domain];
        const filtered = query
          ? tools.filter(
              (t) =>
                t.name.toLowerCase().includes(query) ||
                t.humanName.toLowerCase().includes(query) ||
                t.description.toLowerCase().includes(query)
            )
          : tools;

        if (filtered.length === 0) return null;

        const isCollapsed = collapsedDomains.has(domain);

        return (
          <div key={domain} className="mb-3">
            <div
              className="flex items-center gap-2 cursor-pointer py-1"
              onClick={() => toggleDomain(domain)}
            >
              {isCollapsed ? (
                <ChevronRight className="size-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="size-3.5 text-muted-foreground" />
              )}
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {domain}
              </span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                {filtered.length}
              </Badge>
            </div>

            {!isCollapsed &&
              filtered.map((tool) => (
                <div
                  key={tool.name}
                  className={`cursor-pointer px-3 py-2 rounded-lg hover:bg-accent/10 transition-colors ${
                    selectedTool === tool.name
                      ? "bg-accent/15 border-l-2 border-primary"
                      : ""
                  }`}
                  onClick={() => onSelectTool(tool.name)}
                >
                  <div className="text-sm font-medium">
                    {isHumanView ? tool.humanName : tool.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {tool.description}
                  </div>
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
}
