"use client";

import { useState } from "react";
import { isAddress } from "viem";
import { Input } from "@/components/ui/input";
import { useApp } from "@/providers/app-provider";
import { useBasename } from "@/lib/hooks/use-basename";

export function AddressInput() {
  const { viewAddress, setViewAddress, activeAddress } = useApp();
  const [value, setValue] = useState(viewAddress);
  const [error, setError] = useState(false);
  const basename = useBasename(activeAddress);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setViewAddress("");
      setError(false);
      return;
    }
    if (isAddress(trimmed)) {
      setViewAddress(trimmed);
      setError(false);
    } else {
      setError(true);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <Input
          placeholder="View any vault — paste address (0x...)"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
          className={error ? "border-red-500" : ""}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              setViewAddress("");
              setError(false);
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </form>
      {basename && (
        <p className="text-sm font-mono text-muted-foreground pl-1">
          Viewing: <span className="text-foreground">{basename}</span>
        </p>
      )}
    </div>
  );
}
