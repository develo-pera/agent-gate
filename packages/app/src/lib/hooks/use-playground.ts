"use client";

import { useState, useCallback } from "react";
import { useApp } from "@/providers/app-provider";
import { TOOL_SCHEMAS, type ToolSchema } from "@/lib/tool-schemas";

export interface PlaygroundStatus {
  code: number;
  time: number;
  mode: "success" | "error" | "dry_run";
}

export function usePlayground() {
  const { isDemo, activeAddress } = useApp();

  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [globalDryRun, setGlobalDryRun] = useState(true);
  const [isHumanView, setIsHumanView] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [request, setRequest] = useState<Record<string, unknown> | null>(null);
  const [response, setResponse] = useState<Record<string, unknown> | null>(
    null
  );
  const [status, setStatus] = useState<PlaygroundStatus | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const selectTool = useCallback(
    (name: string) => {
      setSelectedTool(name);
      setRequest(null);
      setResponse(null);
      setStatus(null);

      // Pre-fill smart defaults from schema
      const schema = TOOL_SCHEMAS.find((t) => t.name === name);
      if (schema) {
        const defaults: Record<string, unknown> = {};
        for (const param of schema.params) {
          if (param.isAddress) {
            defaults[param.name] = activeAddress;
          } else if (param.isAmount) {
            defaults[param.name] = "1.0";
          } else if (param.default !== undefined) {
            defaults[param.name] = param.default;
          }
        }
        setFormValues(defaults);
      } else {
        setFormValues({});
      }
    },
    [activeAddress]
  );

  const setFormValue = useCallback((key: string, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const executeTool = useCallback(async () => {
    if (!selectedTool) return;

    const schema = TOOL_SCHEMAS.find(
      (t: ToolSchema) => t.name === selectedTool
    );
    if (!schema) return;

    const requestBody: Record<string, unknown> = {
      ...formValues,
      wallet_address: activeAddress,
    };

    // Inject dry_run for write tools when globalDryRun or demo mode
    const dryRunActive =
      schema.hasWriteEffect && (globalDryRun || isDemo);
    if (dryRunActive) {
      requestBody.dry_run = true;
    }

    setRequest(requestBody);
    setIsExecuting(true);
    setResponse(null);
    setStatus(null);

    const startTime = performance.now();

    try {
      const res = await fetch(`/api/mcp/${selectedTool}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const endTime = performance.now();
      const elapsed = Math.round(endTime - startTime);

      const data = await res.json();
      setResponse(data);
      setStatus({
        code: res.status,
        time: elapsed,
        mode: res.ok ? (dryRunActive ? "dry_run" : "success") : "error",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Network error";
      setResponse({ error: message });
      setStatus({ code: 0, time: 0, mode: "error" });
    } finally {
      setIsExecuting(false);
    }
  }, [selectedTool, formValues, activeAddress, globalDryRun, isDemo]);

  return {
    selectedTool,
    formValues,
    globalDryRun,
    isHumanView,
    searchQuery,
    request,
    response,
    status,
    isExecuting,
    selectTool,
    setFormValue,
    setGlobalDryRun,
    setIsHumanView,
    setSearchQuery,
    executeTool,
  };
}
