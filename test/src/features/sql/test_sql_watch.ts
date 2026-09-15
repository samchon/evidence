import { EvidChecker, EvidWatcher } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { join } from "node:path";

import { TestFileSystem } from "../../internal/TestFileSystem";

/** Rebuilds SQL coverage as watched sources and selectors change.
 *
 * Each watch report must reflect newly selected files, syntax failures, repairs, and a changed selector instead of stale state.
 *
 * 1. Start with covered SQL input and compare cycles to a fresh check.
 * 2. Add an undocumented model, then make it malformed.
 * 3. Repair the source and reselect types, requiring recovery in each case.
 */
export async function test_sql_watch(): Promise<void> {
  await TestFileSystem.experiment(
    "sql-watch",
    {
      "evid.config.ts": dedent`
      export default { claims: [{ type: "typescript", files: ["claims.ts"], reference: { type: "sql", files: ["contracts/*.sql"], symbol: "column" } }] };
    `,
      "claims.ts": dedent`
      /** @evid ./contracts/Contract.sql#CONTRACT Implements the contract. */
      export function claim() {}
    `,
      "contracts/Contract.sql": "CREATE TABLE contract (value INTEGER);\n",
    },
    async (directory) => {
      const file = join(directory, "evid.config.ts");
      const watcher = new EvidWatcher(file, {
        pollIntervalMilliseconds: 10,
        debounceMilliseconds: 10,
      });
      try {
        await watcher.watch(async (cycle) => {
          if (cycle.status === "failed") throw new Error(cycle.message);
          TestValidator.equals(
            `fresh SQL cycle ${cycle.cycle}`,
            cycle.report,
            await EvidChecker.check(file),
          );
          if (cycle.cycle === 1) {
            TestValidator.equals("initial SQL coverage", cycle.success, true);
            await TestFileSystem.save(directory, {
              "contracts/Extra.sql": "CREATE TABLE extra (id INTEGER);\n",
            });
          } else if (cycle.cycle === 2) {
            TestValidator.equals(
              "new undocumented declaration invalidates coverage",
              cycle.success,
              false,
            );
            await TestFileSystem.save(directory, {
              "contracts/Extra.sql": "CREATE TABLE broken (\n",
            });
          } else if (cycle.cycle === 3) {
            TestValidator.equals(
              "syntax failure replaces prior inventory",
              cycle.status,
              "incomplete",
            );
            await TestFileSystem.save(directory, {
              "contracts/Extra.sql":
                "-- @internal Retired table.\nCREATE TABLE extra (id INTEGER);\n",
            });
          } else if (cycle.cycle === 4) {
            TestValidator.equals(
              "repaired source recovers",
              cycle.success,
              true,
            );
            await TestFileSystem.save(directory, {
              "evid.config.ts": dedent`
            export default { claims: [{ type: "typescript", files: ["claims.ts"], reference: { type: "sql", files: ["contracts/*.sql"], symbol: "model" } }] };
          `,
            });
          } else {
            TestValidator.equals(
              "configuration reselects SQL types",
              cycle.cycle,
              5,
            );
            TestValidator.equals("fresh type coverage", cycle.success, true);
            await watcher.close();
          }
        });
      } finally {
        await watcher.close();
      }
    },
  );
}
