import { EvidChecker, EvidWatcher } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { join } from "node:path";

import { EvidTestFileSystem } from "../../internal/EvidTestFileSystem";

/** Recomputes SQLite populations as selected files appear and recover.
 *
 * Watch cycles must discard stale coverage after a file is added or fails parsing, then restore it when repaired.
 *
 * 1. Start with a covered SQLite schema and compare cycles to a fresh check.
 * 2. Add an undocumented selected file and require failed coverage.
 * 3. Make it malformed, repair it, and require incomplete status followed by recovery.
 */
export async function test_sqlite_watch(): Promise<void> {
  await EvidTestFileSystem.experiment(
    "sqlite-watch",
    {
      "evidence.config.ts": dedent`
      export default { claims: [{ type: "typescript", files: ["claim.ts"], reference: { type: "sqlite", files: ["schema/*.sql"], symbol: "column" } }] };
    `,
      "claim.ts": dedent`
      /** @evidence ./schema/account.sql#Account Implements the account. */
      export function verify() {}
    `,
      "schema/account.sql": "CREATE TABLE Account (id INTEGER);\n",
    },
    async (directory) => {
      const config = join(directory, "evidence.config.ts");
      const watcher = new EvidWatcher(config, {
        pollIntervalMilliseconds: 10,
        debounceMilliseconds: 10,
      });
      try {
        await watcher.watch(async (cycle) => {
          if (cycle.status === "failed") throw new Error(cycle.message);
          TestValidator.equals(
            `SQLite watch agrees with fresh check ${cycle.cycle}`,
            cycle.report,
            await EvidChecker.check(config),
          );
          if (cycle.cycle === 1) {
            TestValidator.equals("initial schema covered", cycle.success, true);
            await EvidTestFileSystem.save(directory, {
              "schema/new.sql": "CREATE TABLE New (uncovered TEXT);\n",
            });
          } else if (cycle.cycle === 2) {
            TestValidator.equals(
              "new column creates obligation",
              cycle.success,
              false,
            );
            await EvidTestFileSystem.save(directory, {
              "schema/new.sql": "CREATE TABLE New (\n",
            });
          } else if (cycle.cycle === 3) {
            TestValidator.equals(
              "syntax failure stays incomplete",
              cycle.status,
              "incomplete",
            );
            await EvidTestFileSystem.save(directory, {
              "schema/new.sql":
                "-- @internal Withdraws this table.\nCREATE TABLE New (uncovered TEXT);\n",
            });
          } else {
            TestValidator.equals("one recovery cycle", cycle.cycle, 4);
            TestValidator.equals(
              "repaired withdrawn table recovers",
              cycle.success,
              true,
            );
            await watcher.close();
          }
        });
      } finally {
        await watcher.close();
      }
    },
  );
}
