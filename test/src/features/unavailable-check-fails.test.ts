import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import { executable } from "../internal/paths.js";

/**
 * Verifies that a scaffold cannot report a successful Evidence check.
 *
 * A zero exit code here could silently approve an unchecked CI project.
 * 1. Run default, check, and unavailable-command invocations.
 * 2. Assert exit 2 and an explicit explanation on stderr.
 */
test("unimplemented checking fails instead of reporting coverage", () => {
  for (const args of [[], ["check"], ["init"], ["--unknown"]]) {
    const result = spawnSync(process.execPath, [executable, ...args], {
      encoding: "utf8",
      windowsHide: true,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /No project was checked/);
  }
});
