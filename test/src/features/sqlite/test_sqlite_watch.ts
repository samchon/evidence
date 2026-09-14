import { EvidenceChecker, EvidenceWatcher } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { join } from "node:path";

import { TestFileSystem } from "../../internal/TestFileSystem";

/** Recomputes SQLite populations when selected files appear, fail parsing, and recover. */
export async function test_sqlite_watch(): Promise<void> {
  await TestFileSystem.experiment(
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
      const watcher = new EvidenceWatcher(config, {
        pollIntervalMilliseconds: 10,
        debounceMilliseconds: 10,
      });
      try {
        await watcher.watch(async (cycle) => {
          if (cycle.status === "failed") throw new Error(cycle.message);
          TestValidator.equals(
            `SQLite watch agrees with fresh check ${cycle.cycle}`,
            cycle.report,
            await EvidenceChecker.check(config),
          );
          if (cycle.cycle === 1) {
            TestValidator.equals("initial schema covered", cycle.success, true);
            await TestFileSystem.save(directory, {
              "schema/new.sql": "CREATE TABLE New (uncovered TEXT);\n",
            });
          } else if (cycle.cycle === 2) {
            TestValidator.equals(
              "new column creates obligation",
              cycle.success,
              false,
            );
            await TestFileSystem.save(directory, {
              "schema/new.sql": "CREATE TABLE New (\n",
            });
          } else if (cycle.cycle === 3) {
            TestValidator.equals(
              "syntax failure stays incomplete",
              cycle.status,
              "incomplete",
            );
            await TestFileSystem.save(directory, {
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
