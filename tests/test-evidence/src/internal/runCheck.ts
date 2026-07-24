import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { IRunResult } from "./IRunResult.ts";
import { resolveDependency } from "./resolveDependency.ts";
import { suiteRoot } from "./suiteRoot.ts";

/**
 * Runs `ttsc check` in the fixture and captures everything it said.
 *
 * The launcher script is invoked through `node` rather than through a shim on
 * PATH. `ttsc` publishes `bin: {"ttsc": "lib/launcher/ttsc.js"}` and has no
 * `bin/` directory, so probing for one and falling back to a bare `"ttsc"` only
 * works when something else — `npm run`, which injects `node_modules/.bin` —
 * happens to have prepared PATH. That made the suite pass for a reason it did
 * not state, and fail the moment it was driven any other way.
 */
export const runCheck = (directory: string): IRunResult => {
  const launcher: string = path.join(
    resolveDependency("ttsc"),
    "lib",
    "launcher",
    "ttsc.js",
  );
  const result: SpawnSyncReturns<string> = spawnSync(
    process.execPath,
    [launcher, "check", "-p", "tsconfig.json"],
    {
      cwd: directory,
      encoding: "utf8",
      env: { ...process.env, TTSC_CACHE_DIR: pluginCacheDirectory() },
      // Generous because the FIRST run of a cache key statically links this
      // package's Go into the lint binary, which ttsc itself warns "can take
      // several minutes on a cold Go cache" — measured at ~9 minutes here.
      timeout: 900_000,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  const stdout: string = result.stdout ?? "";
  const stderr: string = result.stderr ?? "";
  return {
    status: result.status,
    stdout,
    stderr,
    output: `${stdout}${stderr}`,
  };
};

/**
 * Pins the ttsc plugin build cache to one suite-owned directory.
 *
 * The default location is `<workspaceRoot>/node_modules/.cache/ttsc`, and every
 * fixture here is a fresh temp directory with a fresh node_modules — so the
 * default makes every single case pay the ~9-minute cold Go link, and the suite
 * grows by nine minutes per test. Pointing every fixture at one stable cache
 * means the first case pays once and the rest are seconds.
 *
 * The cache is keyed by content (plugin source plus toolchain versions), so a
 * shared cache is not a stale-result risk: editing a rule changes the key and
 * the affected cases relink.
 *
 * The repository's own self-lint step shares this directory for the same
 * reason, which is why the path is derived here rather than written out at each
 * caller — see `scripts/lint.mjs`.
 */
const pluginCacheDirectory = (): string => {
  const location: string = path.join(suiteRoot, ".cache", "ttsc");
  fs.mkdirSync(location, { recursive: true });
  return location;
};
