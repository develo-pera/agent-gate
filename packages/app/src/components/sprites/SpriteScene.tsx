"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AgentSprite } from "./AgentSprite";

interface SpriteAgent {
  name: string;
  address: string;
  status?: "active" | "idle" | "registered";
  action?: string;
}

interface SpriteSceneProps {
  agents: SpriteAgent[];
  className?: string;
}

interface SpritePosition {
  x: number;
  y: number;
  facingLeft: boolean;
}

const SCENE_HEIGHT = 250;
const SPRITE_SIZE = 96;
const BOUNDARY_INSET = 48;
const TRANSITION_DURATION = 800; // ms for CSS transition
const IDLE_MIN = 2000;
const IDLE_MAX = 5000;

function randomInRange(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

function useWander(
  agentKey: string,
  status: string | undefined,
  sceneWidth: number,
  isHovered: boolean
) {
  const [pos, setPos] = useState<SpritePosition>(() => ({
    x: randomInRange(
      BOUNDARY_INSET,
      Math.max(BOUNDARY_INSET + 1, sceneWidth - BOUNDARY_INSET - SPRITE_SIZE)
    ),
    y: randomInRange(BOUNDARY_INSET, SCENE_HEIGHT - BOUNDARY_INSET - SPRITE_SIZE),
    facingLeft: false,
  }));
  const [isMoving, setIsMoving] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearWanderTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Only idle agents wander. Active stays put (working). Registered stays put (stationary).
    if (status === "active" || status === "registered" || isHovered) {
      setIsMoving(false);
      clearWanderTimeout();
      return;
    }

    const pickNewDestination = () => {
      const maxX = Math.max(
        BOUNDARY_INSET + 1,
        sceneWidth - BOUNDARY_INSET - SPRITE_SIZE
      );
      const newX = randomInRange(BOUNDARY_INSET, maxX);
      const newY = randomInRange(
        BOUNDARY_INSET,
        SCENE_HEIGHT - BOUNDARY_INSET - SPRITE_SIZE
      );

      setPos((prev) => ({
        x: newX,
        y: newY,
        facingLeft: newX < prev.x,
      }));
      setIsMoving(true);

      // After transition completes, idle for 2-5s, then move again
      timeoutRef.current = setTimeout(() => {
        setIsMoving(false);
        const idlePause = randomInRange(IDLE_MIN, IDLE_MAX);
        timeoutRef.current = setTimeout(pickNewDestination, idlePause);
      }, TRANSITION_DURATION);
    };

    // Stagger initial start
    const initialDelay = randomInRange(0, 2000);
    timeoutRef.current = setTimeout(pickNewDestination, initialDelay);

    return () => clearWanderTimeout();
  }, [status, sceneWidth, isHovered, clearWanderTimeout]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearWanderTimeout();
  }, [clearWanderTimeout]);

  return { pos, isMoving };
}

function WanderingSprite({
  agent,
  sceneWidth,
}: {
  agent: SpriteAgent;
  sceneWidth: number;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const { pos, isMoving } = useWander(
    agent.address,
    agent.status,
    sceneWidth,
    isHovered
  );

  return (
    <div
      className="absolute"
      style={{
        left: pos.x,
        top: pos.y,
        transition: `left ${TRANSITION_DURATION}ms ease-in-out, top ${TRANSITION_DURATION}ms ease-in-out`,
        transform: pos.facingLeft ? "scaleX(-1)" : "scaleX(1)",
      }}
      data-testid="sprite-wrapper"
    >
      <AgentSprite
        agent={agent}
        status={agent.status}
        action={agent.action}
        isWalking={isMoving}
        onHoverChange={setIsHovered}
      />
    </div>
  );
}

export function SpriteScene({ agents, className }: SpriteSceneProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [sceneWidth, setSceneWidth] = useState(800); // default, updated on mount

  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSceneWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (agents.length === 0) {
    return (
      <div
        className={`relative w-full flex items-center justify-center text-muted-foreground ${className ?? ""}`}
        style={{ minHeight: SCENE_HEIGHT }}
        data-testid="sprite-scene"
      >
        <div className="text-center">
          <p className="text-[16px] font-semibold">No agents registered</p>
          <p className="mt-1 text-[14px]">
            Register an agent through the MCP bridge to see sprites appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={sceneRef}
      className={`relative w-full ${className ?? ""}`}
      style={{ minHeight: SCENE_HEIGHT }}
      data-testid="sprite-scene"
    >
      {agents.map((agent) => (
        <WanderingSprite
          key={agent.address}
          agent={agent}
          sceneWidth={sceneWidth}
        />
      ))}
    </div>
  );
}
