"use client";

import { useState } from "react";
import { RobotSvg } from "./robot-svg";
import {
  addressToSpriteColor,
  statusToAnimation,
  statusToColor,
  statusToActionText,
} from "@/lib/sprite-utils";
import { shortenAddress } from "@/lib/format";
import "./sprite.css";

interface AgentSpriteProps {
  agent: { name: string; address: string };
  status?: "active" | "idle" | "registered";
  action?: string;
  className?: string;
  onHoverChange?: (hovered: boolean) => void;
}

export function AgentSprite({
  agent,
  status = "idle",
  action,
  className,
  onHoverChange,
}: AgentSpriteProps) {
  const [hovered, setHovered] = useState(false);

  const bodyColor = addressToSpriteColor(agent.address);
  const animClass = hovered ? "anim-idle" : statusToAnimation(status);
  const dotColor = statusToColor(status);
  const actionText = statusToActionText(status, action);

  const handleMouseEnter = () => {
    setHovered(true);
    onHoverChange?.(true);
  };

  const handleMouseLeave = () => {
    setHovered(false);
    onHoverChange?.(false);
  };

  return (
    <div
      className={`relative inline-block ${className ?? ""}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-testid="agent-sprite"
    >
      <div
        className="sprite-viewport"
        style={
          {
            "--sprite-body": bodyColor,
            transform: "scaleX(1)",
          } as React.CSSProperties
        }
      >
        <RobotSvg className={`sprite-strip ${animClass}`} />
      </div>

      {hovered && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[200px] rounded-[var(--radius)] bg-card p-4 ring-1 ring-foreground/10 transition-opacity duration-150 z-10"
          data-testid="hover-card"
        >
          <div className="flex items-center gap-1">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: dotColor }}
              data-testid="status-dot"
            />
            <span className="text-[16px] font-semibold leading-[1.2] text-foreground">
              {agent.name}
            </span>
          </div>
          <div className="mt-1 font-mono text-[12px] leading-[1.4] text-muted-foreground">
            {shortenAddress(agent.address)}
          </div>
          <div className="mt-1 text-[14px] leading-[1.5] text-foreground">
            {actionText}
          </div>
        </div>
      )}
    </div>
  );
}
