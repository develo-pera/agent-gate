// Coverage: TREA-03 (deposit form), TREA-04 (withdraw form)
import { describe, test } from "vitest";

describe("Treasury Forms", () => {
  describe("TREA-03: Deposit Form", () => {
    test.todo("renders deposit amount input");
    test.todo("submits deposit to bridge via useMcpAction");
    test.todo("shows dry-run result after simulation");
    test.todo("forces dry-run in demo mode");
  });

  describe("TREA-04: Withdraw Yield Form", () => {
    test.todo("renders withdraw amount and recipient inputs");
    test.todo("submits withdraw to bridge via useMcpAction");
    test.todo("shows dry-run result after simulation");
    test.todo("disables submit when amount exceeds available yield");
  });
});
