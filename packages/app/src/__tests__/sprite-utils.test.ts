import { describe, it, expect } from "vitest";
import {
  addressToSpriteColor,
  statusToAnimation,
  statusToColor,
  statusToActionText,
} from "@/lib/sprite-utils";

describe("addressToSpriteColor", () => {
  it("returns hsl(135, 70%, 60%) for 0xAB prefix", () => {
    // 0xAB = 171 decimal, 171 % 8 = 3, HUES[3] = 135
    expect(addressToSpriteColor("0xABcdEF1234567890abcdef1234567890ABcdEF12")).toBe(
      "hsl(135, 70%, 60%)"
    );
  });

  it("returns hsl(0, 70%, 60%) for 0x00 prefix", () => {
    // 0x00 = 0, 0 % 8 = 0, HUES[0] = 0
    expect(addressToSpriteColor("0x00cdEF1234567890abcdef1234567890ABcdEF12")).toBe(
      "hsl(0, 70%, 60%)"
    );
  });

  it("returns hsl(315, 70%, 60%) for 0xFF prefix", () => {
    // 0xFF = 255, 255 % 8 = 7, HUES[7] = 315
    expect(addressToSpriteColor("0xFFcdEF1234567890abcdef1234567890ABcdEF12")).toBe(
      "hsl(315, 70%, 60%)"
    );
  });

  it("produces different colors for different first byte pairs", () => {
    const color1 = addressToSpriteColor("0x01000000000000000000000000000000000000000");
    const color2 = addressToSpriteColor("0x02000000000000000000000000000000000000000");
    expect(color1).not.toBe(color2);
  });
});

describe("statusToAnimation", () => {
  it('returns "anim-work" for active', () => {
    expect(statusToAnimation("active")).toBe("anim-work");
  });

  it('returns "anim-idle" for idle', () => {
    expect(statusToAnimation("idle")).toBe("anim-idle");
  });

  it('returns "anim-idle" for registered', () => {
    expect(statusToAnimation("registered")).toBe("anim-idle");
  });

  it('returns "anim-idle" for undefined', () => {
    expect(statusToAnimation(undefined)).toBe("anim-idle");
  });
});

describe("statusToColor", () => {
  it('returns "var(--success)" for active', () => {
    expect(statusToColor("active")).toBe("var(--success)");
  });

  it('returns "var(--warning)" for idle', () => {
    expect(statusToColor("idle")).toBe("var(--warning)");
  });

  it('returns "var(--muted-foreground)" for registered', () => {
    expect(statusToColor("registered")).toBe("var(--muted-foreground)");
  });
});

describe("statusToActionText", () => {
  it('returns "Calling transfer..." for active with action', () => {
    expect(statusToActionText("active", "transfer")).toBe("Calling transfer...");
  });

  it('returns "Wandering around..." for idle without action', () => {
    expect(statusToActionText("idle", undefined)).toBe("Wandering around...");
  });

  it('returns "Standing by" for registered', () => {
    expect(statusToActionText("registered", undefined)).toBe("Standing by");
  });
});
