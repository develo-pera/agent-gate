"use client";

import { Bot, Wallet } from "lucide-react";

interface ConnectPromptProps {
  title: string;
  description: string;
}

export function ConnectPrompt({ title, description }: ConnectPromptProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border/50 bg-card/60 p-12 backdrop-blur-lg">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Bot className="h-8 w-8" />
        <span className="text-lg">/</span>
        <Wallet className="h-8 w-8" />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
