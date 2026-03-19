"use client";

import { createContext, useContext } from "react";
import { useAccount } from "wagmi";
import { DEMO_TREASURY_ADDRESS } from "@/lib/constants";

export interface AppContextValue {
  isDemo: boolean;
  activeAddress: string;
  treasuryAddress: string;
}

const AppContext = createContext<AppContextValue>({
  isDemo: true,
  activeAddress: DEMO_TREASURY_ADDRESS,
  treasuryAddress: DEMO_TREASURY_ADDRESS,
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useAccount();

  const value: AppContextValue = {
    isDemo: !isConnected || !address,
    activeAddress: isConnected && address ? address : DEMO_TREASURY_ADDRESS,
    treasuryAddress: DEMO_TREASURY_ADDRESS,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
