"use client";

import { useState, useEffect, useRef } from "react";
import { isAddress } from "viem";
import { Input } from "@/components/ui/input";
import { useApp } from "@/providers/app-provider";
import { useBasename } from "@/lib/hooks/use-basename";

export function AddressInput() {
  const { viewAddress, setViewAddress, activeAddress } = useApp();
  const [value, setValue] = useState(viewAddress);
  const [error, setError] = useState(false);
  const basename = useBasename(activeAddress);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleChange(input: string) {
    setValue(input);
    setError(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const trimmed = input.trim();
      if (!trimmed) {
        setViewAddress("");
        return;
      }
      if (isAddress(trimmed)) {
        setViewAddress(trimmed);
      } else {
        setError(true);
      }
    }, 400);
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Input
          placeholder="View any vault — paste address (0x...)"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          className={error ? "border-red-500" : ""}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              if (debounceRef.current) clearTimeout(debounceRef.current);
              setValue("");
              setViewAddress("");
              setError(false);
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>
      {basename && (
        <p className="text-sm font-mono text-muted-foreground pl-1">
          Viewing: <span className="text-foreground">{basename}</span>
        </p>
      )}
    </div>
  );
}
