import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

/**
 * Verifies that the public package imports without starting a command.
 *
 * A CLI side effect on import would run checks in library consumers.
 * 1. Import the linked package in a fresh process.
 * 2. Assert that it exits successfully without output.
 */
test("the public package imports without running the CLI", () => {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", 'await import("@samchon/evidence")'],
    { encoding: "utf8", windowsHide: true },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});
