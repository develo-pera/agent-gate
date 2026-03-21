import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { Web3Provider } from "@/providers/web3-provider";
import { AppProvider } from "@/providers/app-provider";
import { Sidebar } from "@/components/sidebar";
import { DemoBanner } from "@/components/demo-banner";
import { TxNotifications } from "@/components/tx-notifications";
import { Toaster } from "sonner";

const inter = Inter({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "AgentGate",
  description: "Agent-to-agent DeFi infrastructure",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookie = (await headers()).get("cookie") ?? "";

  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} bg-background text-foreground min-h-screen antialiased`}
      >
        <Web3Provider cookie={cookie}>
          <AppProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <div className="flex-1 ml-14 flex flex-col min-h-screen">
                <div className="w-full px-8 pt-4 pb-2">
                  <DemoBanner />
                </div>
                <main className="flex-1 px-8 pb-8 max-w-[1200px] mx-auto w-full">
                  {children}
                </main>
              </div>
            </div>
            <TxNotifications />
            <Toaster theme="dark" position="top-center" richColors closeButton toastOptions={{ style: { fontSize: "14px", maxWidth: "420px" } }} />
          </AppProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
