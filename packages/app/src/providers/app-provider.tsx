"use client";

import { createContext, useContext, useState } from "react";
import { useAccount } from "wagmi";
import { DEMO_TREASURY_ADDRESS } from "@/lib/constants";

export interface AppContextValue {
  isDemo: boolean;
  activeAddress: string;
  viewAddress: string;
  setViewAddress: (address: string) => void;
}

const AppContext = createContext<AppContextValue>({
  isDemo: true,
  activeAddress: DEMO_TREASURY_ADDRESS,
  viewAddress: "",
  setViewAddress: () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useAccount();
  const [viewAddress, setViewAddress] = useState("");

  const resolvedAddress =
    viewAddress ||
    (isConnected && address ? address : DEMO_TREASURY_ADDRESS);

  const value: AppContextValue = {
    isDemo: !viewAddress && (!isConnected || !address),
    activeAddress: resolvedAddress,
    viewAddress,
    setViewAddress,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
