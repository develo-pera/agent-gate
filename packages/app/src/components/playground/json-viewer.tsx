"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Download, WrapText, Check } from "lucide-react";

interface JsonViewerProps {
  data: unknown;
  maxInitialDepth?: number;
}

function getInitialCollapsed(
  data: unknown,
  maxDepth: number,
  path: string = "root",
  depth: number = 0
): Set<string> {
  const collapsed = new Set<string>();

  if (data === null || typeof data !== "object") return collapsed;

  const isArray = Array.isArray(data);
  const entries = isArray ? data : Object.keys(data as Record<string, unknown>);
  const count = entries.length;

  if (depth >= maxDepth || count > 5) {
    collapsed.add(path);
  }

  if (isArray) {
    (data as unknown[]).forEach((item, i) => {
      const childCollapsed = getInitialCollapsed(
        item,
        maxDepth,
        `${path}.${i}`,
        depth + 1
      );
      childCollapsed.forEach((p) => collapsed.add(p));
    });
  } else {
    Object.entries(data as Record<string, unknown>).forEach(([key, val]) => {
      const childCollapsed = getInitialCollapsed(
        val,
        maxDepth,
        `${path}.${key}`,
        depth + 1
      );
      childCollapsed.forEach((p) => collapsed.add(p));
    });
  }

  return collapsed;
}

interface JsonNodeProps {
  data: unknown;
  path: string;
  depth: number;
  collapsed: Set<string>;
  onToggle: (path: string) => void;
  isLast: boolean;
}

const JsonNode = React.memo(function JsonNode({
  data,
  path,
  depth,
  collapsed,
  onToggle,
  isLast,
}: JsonNodeProps) {
  const comma = isLast ? "" : ",";

  if (data === null) {
    return (
      <span>
        <span className="text-[hsl(270,60%,70%)]">null</span>
        <span className="text-muted-foreground">{comma}</span>
      </span>
    );
  }

  if (typeof data === "boolean") {
    return (
      <span>
        <span className="text-[hsl(270,60%,70%)]">{String(data)}</span>
        <span className="text-muted-foreground">{comma}</span>
      </span>
    );
  }

  if (typeof data === "number") {
    return (
      <span>
        <span className="text-[hsl(210,80%,65%)]">{data}</span>
        <span className="text-muted-foreground">{comma}</span>
      </span>
    );
  }

  if (typeof data === "string") {
    const escaped = data
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\t/g, "\\t");
    return (
      <span>
        <span className="text-[hsl(142,60%,60%)]">&quot;{escaped}&quot;</span>
        <span className="text-muted-foreground">{comma}</span>
      </span>
    );
  }

  const isArray = Array.isArray(data);
  const entries = isArray
    ? (data as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
    : Object.entries(data as Record<string, unknown>);
  const count = entries.length;
  const openBracket = isArray ? "[" : "{";
  const closeBracket = isArray ? "]" : "}";
  const isCollapsed = collapsed.has(path);

  if (isCollapsed) {
    return (
      <span>
        <span
          className="text-muted-foreground cursor-pointer hover:text-foreground"
          onClick={() => onToggle(path)}
        >
          {openBracket}{" "}
          <span className="text-xs italic">
            ... {count} {count === 1 ? "item" : "items"}
          </span>{" "}
          {closeBracket}
        </span>
        <span className="text-muted-foreground">{comma}</span>
      </span>
    );
  }

  return (
    <span>
      <span
        className="text-muted-foreground cursor-pointer hover:text-foreground"
        onClick={() => onToggle(path)}
      >
        {openBracket}
      </span>
      <div className="ml-4">
        {entries.map(([key, val], idx) => {
          const childPath = `${path}.${key}`;
          const last = idx === entries.length - 1;
          return (
            <div key={childPath}>
              {!isArray && (
                <>
                  <span className="text-[hsl(220,15%,75%)]">
                    &quot;{key}&quot;
                  </span>
                  <span className="text-muted-foreground">: </span>
                </>
              )}
              <JsonNode
                data={val}
                path={childPath}
                depth={depth + 1}
                collapsed={collapsed}
                onToggle={onToggle}
                isLast={last}
              />
            </div>
          );
        })}
      </div>
      <span
        className="text-muted-foreground cursor-pointer hover:text-foreground"
        onClick={() => onToggle(path)}
      >
        {closeBracket}
      </span>
      <span className="text-muted-foreground">{comma}</span>
    </span>
  );
});

export function JsonViewer({ data, maxInitialDepth = 3 }: JsonViewerProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() =>
    getInitialCollapsed(data, maxInitialDepth)
  );
  const [wordWrap, setWordWrap] = useState(false);
  const [copied, setCopied] = useState(false);

  const onToggle = useCallback((path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [jsonString]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "response.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [jsonString]);

  return (
    <div>
      <div
        className={`font-mono text-[13px] leading-relaxed overflow-auto ${
          wordWrap ? "whitespace-pre-wrap" : "whitespace-pre"
        }`}
      >
        <JsonNode
          data={data}
          path="root"
          depth={0}
          collapsed={collapsed}
          onToggle={onToggle}
          isLast={true}
        />
      </div>

      <div className="flex items-center gap-2 mt-2">
        <Button variant="ghost" size="sm" onClick={handleCopy}>
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copied ? "Copied!" : "Copy"}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleDownload}>
          <Download className="size-3.5" />
          Download
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setWordWrap((p) => !p)}
        >
          <WrapText className="size-3.5" />
          Wrap
        </Button>
      </div>
    </div>
  );
}
