import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/providers/web3-provider";
import { AppProvider } from "@/providers/app-provider";
import { Sidebar } from "@/components/sidebar";
import { DemoBanner } from "@/components/demo-banner";

const inter = Inter({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "AgentGate",
  description: "Agent-to-agent DeFi infrastructure",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} bg-background text-foreground min-h-screen antialiased`}
      >
        <Web3Provider>
          <AppProvider>
            <DemoBanner />
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="flex-1 ml-14 p-8 max-w-[1200px] mx-auto transition-all duration-200">
                {children}
              </main>
            </div>
          </AppProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
