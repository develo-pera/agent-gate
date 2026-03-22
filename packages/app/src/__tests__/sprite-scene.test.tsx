import { describe, it, expect, beforeAll } from "vitest";
import { render } from "@testing-library/react";
import { SpriteScene } from "@/components/sprites/SpriteScene";

beforeAll(() => {
  // jsdom does not provide ResizeObserver
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
});

const agents = [
  { name: "AlphaBot", address: "0xAA00000000000000000000000000000000000001" },
  { name: "BetaBot", address: "0xBB00000000000000000000000000000000000002" },
  { name: "GammaBot", address: "0xCC00000000000000000000000000000000000003" },
];

describe("SpriteScene", () => {
  it('renders scene container with data-testid="sprite-scene"', () => {
    const { getByTestId } = render(<SpriteScene agents={agents} />);
    const scene = getByTestId("sprite-scene");
    expect(scene).not.toBeNull();
    expect(scene.style.minHeight).toBe("250px");
  });

  it("renders scene container with position relative", () => {
    const { getByTestId } = render(<SpriteScene agents={agents} />);
    const scene = getByTestId("sprite-scene");
    expect(scene.className).toContain("relative");
  });

  it("renders one agent-sprite per agent in the agents array", () => {
    const { getAllByTestId } = render(<SpriteScene agents={agents} />);
    const sprites = getAllByTestId("agent-sprite");
    expect(sprites).toHaveLength(3);
  });

  it('renders empty state with "No agents registered" when agents is empty', () => {
    const { getByTestId, getByText } = render(<SpriteScene agents={[]} />);
    expect(getByTestId("sprite-scene")).not.toBeNull();
    expect(getByText("No agents registered")).not.toBeNull();
  });

  it("renders 3 sprite wrappers when given 3 agents", () => {
    const { getAllByTestId } = render(<SpriteScene agents={agents} />);
    const wrappers = getAllByTestId("sprite-wrapper");
    expect(wrappers).toHaveLength(3);
  });

  it("each sprite wrapper has absolute positioning", () => {
    const { getAllByTestId } = render(<SpriteScene agents={agents} />);
    const wrappers = getAllByTestId("sprite-wrapper");
    for (const wrapper of wrappers) {
      expect(wrapper.className).toContain("absolute");
    }
  });

  it("each sprite wrapper has CSS transition for left and top", () => {
    const { getAllByTestId } = render(<SpriteScene agents={agents} />);
    const wrappers = getAllByTestId("sprite-wrapper");
    for (const wrapper of wrappers) {
      const transition = wrapper.style.transition;
      expect(transition).toContain("left");
      expect(transition).toContain("top");
    }
  });
});
