import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { test } from "node:test";

import { executable } from "../internal/paths.js";

/**
 * Verifies help and version without requiring a project configuration.
 *
 * Package metadata must remain usable before graph checking is implemented.
 * 1. Run help and version through the built executable.
 * 2. Compare the version with the public package manifest.
 */
test("the CLI exposes help and its actual package version", () => {
  const manifest = createRequire(import.meta.url)(
    "@samchon/evidence/package.json",
  ) as { version: string };
  for (const flag of ["--version", "-v", "--help", "-h"]) {
    const result = spawnSync(process.execPath, [executable, flag], {
      encoding: "utf8",
      windowsHide: true,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    if (flag === "--version" || flag === "-v")
      assert.equal(result.stdout.trim(), manifest.version);
    else assert.match(result.stdout, /not implemented yet/);
  }
});
