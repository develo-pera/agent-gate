// Coverage: STAK-01 (APR hero), STAK-02 (position balance), STAK-03 (health report)
import { describe, test } from "vitest";

describe("Staking Page", () => {
  describe("STAK-01: APR Hero Display", () => {
    test.todo("renders current Lido staking APR");
    test.todo("shows APR source indicator");
    test.todo("handles loading state with skeleton");
    test.todo("shows fallback APR on error");
  });

  describe("STAK-02: Position Balance", () => {
    test.todo("renders wstETH balance on Base");
    test.todo("derives stETH equivalent from oracle rate");
    test.todo("shows formatted USD value");
  });

  describe("STAK-03: Health Report", () => {
    test.todo("renders health score gauge");
    test.todo("shows correct label for score range");
    test.todo("displays risk factors list");
  });
});
