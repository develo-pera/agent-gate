import { describe, it, expect } from "vitest";

describe("Playground Dry-Run Toggle", () => {
  it.todo("injects dry_run=true into request body when globalDryRun is enabled for write tools");
  it.todo("does not inject dry_run for read-only tools regardless of toggle state");
  it.todo("forces dry_run=true in demo mode even if toggle is off");
  it.todo("status bar shows Dry Run badge when execution was dry-run");
  it.todo("global dry-run defaults to true on initial load");
});
