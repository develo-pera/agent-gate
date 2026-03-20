"use client";

import { TOOL_SCHEMAS } from "@/lib/tool-schemas";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Loader2 } from "lucide-react";

interface ParameterFormProps {
  toolName: string | null;
  formValues: Record<string, unknown>;
  onFormValueChange: (key: string, value: unknown) => void;
  onExecute: () => void;
  isExecuting: boolean;
  isHumanView: boolean;
}

function humanizeParamName(name: string): string {
  return name
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function ParameterForm({
  toolName,
  formValues,
  onFormValueChange,
  onExecute,
  isExecuting,
  isHumanView,
}: ParameterFormProps) {
  const schema = TOOL_SCHEMAS.find((t) => t.name === toolName);

  if (!toolName || !schema) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground text-center">
          Select a tool from the list to configure parameters
        </p>
      </div>
    );
  }

  const labelText = (paramName: string) =>
    isHumanView ? humanizeParamName(paramName) : paramName;

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-lg font-semibold mb-4">
        {isHumanView ? schema.humanName : schema.name}
      </h2>

      {schema.params.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-4">
          This tool requires no parameters
        </p>
      ) : (
        <div className="space-y-3 flex-1">
          {schema.params.map((param) => {
            if (param.type === "boolean") {
              return (
                <div key={param.name} className="flex items-center gap-2">
                  <Switch
                    checked={!!formValues[param.name]}
                    onCheckedChange={(v) => onFormValueChange(param.name, v)}
                  />
                  <Label>
                    {labelText(param.name)}
                    {param.required && (
                      <span className="text-destructive ml-0.5">*</span>
                    )}
                  </Label>
                </div>
              );
            }

            if (param.type === "enum") {
              return (
                <div key={param.name} className="flex flex-col gap-1.5">
                  <Label>
                    {labelText(param.name)}
                    {param.required && (
                      <span className="text-destructive ml-0.5">*</span>
                    )}
                  </Label>
                  <Select
                    value={
                      (formValues[param.name] as string) ?? undefined
                    }
                    onValueChange={(v) => onFormValueChange(param.name, v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {param.enumValues?.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            }

            if (param.type === "number") {
              return (
                <div key={param.name} className="flex flex-col gap-1.5">
                  <Label>
                    {labelText(param.name)}
                    {param.required && (
                      <span className="text-destructive ml-0.5">*</span>
                    )}
                  </Label>
                  <Input
                    type="number"
                    value={formValues[param.name]?.toString() || ""}
                    onChange={(e) =>
                      onFormValueChange(
                        param.name,
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
                    placeholder={param.description}
                  />
                </div>
              );
            }

            // Default: string
            return (
              <div key={param.name} className="flex flex-col gap-1.5">
                <Label>
                  {labelText(param.name)}
                  {param.required && (
                    <span className="text-destructive ml-0.5">*</span>
                  )}
                </Label>
                <Input
                  value={(formValues[param.name] as string) || ""}
                  onChange={(e) =>
                    onFormValueChange(param.name, e.target.value)
                  }
                  placeholder={param.description}
                />
              </div>
            );
          })}
        </div>
      )}

      <Button
        className="w-full mt-4"
        onClick={onExecute}
        disabled={isExecuting}
      >
        {isExecuting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Play className="size-4" />
        )}
        {isExecuting ? "Executing..." : "Execute Tool"}
      </Button>
    </div>
  );
}
