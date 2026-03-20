"use client";

import { usePlayground } from "@/lib/hooks/use-playground";
import { TOOL_SCHEMAS } from "@/lib/tool-schemas";
import { PlaygroundHeader } from "@/components/playground/playground-header";
import { ToolSelector } from "@/components/playground/tool-selector";
import { ParameterForm } from "@/components/playground/parameter-form";
import { JsonViewer } from "@/components/playground/json-viewer";
import { ExecutionStatusBar } from "@/components/playground/execution-status-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { Terminal } from "lucide-react";

export default function PlaygroundPage() {
  const {
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
  } = usePlayground();

  return (
    <div>
      <PlaygroundHeader
        toolCount={TOOL_SCHEMAS.length}
        globalDryRun={globalDryRun}
        onGlobalDryRunChange={setGlobalDryRun}
        isHumanView={isHumanView}
        onHumanViewChange={setIsHumanView}
      />

      <div className="flex gap-6 h-[calc(100vh-12rem)]">
        {/* Column 1: Tool Selector */}
        <div className="w-1/5 min-w-[220px]">
          <div className="bg-card/60 border border-border/50 backdrop-blur-lg rounded-xl p-4 h-full overflow-y-auto">
            <ToolSelector
              selectedTool={selectedTool}
              onSelectTool={selectTool}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              isHumanView={isHumanView}
            />
          </div>
        </div>

        {/* Column 2: Parameter Form */}
        <div className="w-[30%] min-w-[280px]">
          <div className="bg-card/60 border border-border/50 backdrop-blur-lg rounded-xl p-4 h-full overflow-y-auto">
            <ParameterForm
              toolName={selectedTool}
              formValues={formValues}
              onFormValueChange={setFormValue}
              onExecute={executeTool}
              isExecuting={isExecuting}
              isHumanView={isHumanView}
            />
          </div>
        </div>

        {/* Column 3: JSON Response */}
        <div className="flex-1">
          <div className="bg-card/60 border border-border/50 backdrop-blur-lg rounded-xl p-4 h-full overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">
              Request &amp; Response
            </h2>

            {!request && !response && (
              <div className="flex flex-col items-center justify-center h-[calc(100%-3rem)]">
                <Terminal className="size-12 text-muted-foreground mb-3" />
                <h3 className="text-lg font-semibold text-muted-foreground">
                  Ready to Execute
                </h3>
                <p className="text-sm text-muted-foreground">
                  Select a tool and execute to see results
                </p>
              </div>
            )}

            {request && (
              <div className="mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Request
                </h3>
                <JsonViewer data={request} filename="request.json" />
              </div>
            )}

            <ExecutionStatusBar status={status} />

            {isExecuting && (
              <Skeleton className="h-[200px] rounded-lg mt-4" />
            )}

            {response && !isExecuting && (
              <div className="mt-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Response
                </h3>
                <JsonViewer data={response} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
