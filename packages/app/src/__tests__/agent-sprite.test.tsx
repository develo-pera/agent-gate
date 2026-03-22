import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { AgentSprite } from "@/components/sprites/AgentSprite";

const AGENT = {
  name: "TestBot",
  address: "0xABcdEF1234567890abcdef1234567890ABcdEF12",
};

describe("AgentSprite", () => {
  it("renders an SVG inside a .sprite-viewport container", () => {
    const { container } = render(<AgentSprite agent={AGENT} />);
    const viewport = container.querySelector(".sprite-viewport");
    expect(viewport).not.toBeNull();
    const svg = viewport?.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it('applies anim-idle class when status is "idle"', () => {
    const { container } = render(<AgentSprite agent={AGENT} status="idle" />);
    const strip = container.querySelector(".sprite-strip");
    expect(strip?.classList.contains("anim-idle")).toBe(true);
  });

  it("applies anim-idle class when status is undefined", () => {
    const { container } = render(<AgentSprite agent={AGENT} />);
    const strip = container.querySelector(".sprite-strip");
    expect(strip?.classList.contains("anim-idle")).toBe(true);
  });

  it('applies anim-work class when status is "active"', () => {
    const { container } = render(<AgentSprite agent={AGENT} status="active" />);
    const strip = container.querySelector(".sprite-strip");
    expect(strip?.classList.contains("anim-work")).toBe(true);
  });

  it("does NOT show hover card by default", () => {
    const { queryByTestId } = render(<AgentSprite agent={AGENT} />);
    expect(queryByTestId("hover-card")).toBeNull();
  });

  it("shows hover card with agent name on mouseenter", () => {
    const { getByTestId } = render(<AgentSprite agent={AGENT} />);
    fireEvent.mouseEnter(getByTestId("agent-sprite"));
    expect(getByTestId("hover-card")).not.toBeNull();
  });

  it("shows truncated address on mouseenter", () => {
    const { getByTestId, queryByText } = render(<AgentSprite agent={AGENT} />);
    fireEvent.mouseEnter(getByTestId("agent-sprite"));
    // shortenAddress produces "0xABcd...EF12"
    expect(queryByText("0xABcd...EF12")).not.toBeNull();
  });

  it("shows status dot element on mouseenter", () => {
    const { getByTestId } = render(<AgentSprite agent={AGENT} />);
    fireEvent.mouseEnter(getByTestId("agent-sprite"));
    expect(getByTestId("status-dot")).not.toBeNull();
  });

  it("hides hover card on mouseleave", () => {
    const { getByTestId, queryByTestId } = render(<AgentSprite agent={AGENT} />);
    fireEvent.mouseEnter(getByTestId("agent-sprite"));
    expect(queryByTestId("hover-card")).not.toBeNull();
    fireEvent.mouseLeave(getByTestId("agent-sprite"));
    expect(queryByTestId("hover-card")).toBeNull();
  });

  it("sets --sprite-body CSS variable on viewport container", () => {
    const { container } = render(<AgentSprite agent={AGENT} />);
    const viewport = container.querySelector(".sprite-viewport") as HTMLElement;
    expect(viewport?.style.getPropertyValue("--sprite-body")).toBeTruthy();
  });
});
