// Coverage: TREA-01 (vault status), TREA-05 (oracle rate display)
import { describe, test } from "vitest";

describe("Treasury Page", () => {
  describe("TREA-01: Vault Status Display", () => {
    test.todo("renders deposited principal in wstETH");
    test.todo("renders available yield in wstETH");
    test.todo("renders total balance in wstETH");
    test.todo("shows placeholder when no vault exists");
  });

  describe("TREA-05: Oracle Rate Display", () => {
    test.todo("renders current wstETH/stETH exchange rate");
    test.todo("shows rate meaning text");
    test.todo("handles loading state");
  });
});
