import { EvidenceChecker, EvidenceWatcher } from "evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { join } from "node:path";

import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";

/**
 * Replaces stale MySQL inventories during watch cycles.
 *
 * A newly selected schema, schema mutation, parse failure, and repair must each
 * yield a report derived from the current files.
 *
 * 1. Start from covered MySQL input and compare every watch report to a fresh
 *    check.
 * 2. Add and mutate an undocumented schema, then require failing coverage and
 *    incomplete parsing.
 * 3. Repair the source and require the next cycle to recover coverage.
 */
export async function test_mysql_watch(): Promise<void> {
  await EvidenceTestFileSystem.experiment(
    "mysql-watch",
    {
      "evidence.config.ts": dedent`
      export default { claims: [{ type: "typescript", files: ["claim.ts"], reference: { type: "mysql", files: ["schemas/*.sql"], symbol: "column" } }] };
    `,
      "claim.ts":
        "/** @evidence ./schemas/contract.sql#Contract Verifies the schema. */\nexport function claim() {}",
      "schemas/contract.sql": "CREATE TABLE Contract (id INT);",
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
            `fresh cycle ${cycle.cycle}`,
            cycle.report,
            await EvidenceChecker.check(config),
          );
          if (cycle.cycle === 1) {
            TestValidator.equals("initial coverage", cycle.success, true);
            await EvidenceTestFileSystem.save(directory, {
              "schemas/extra.sql": "CREATE TABLE Extra (value INT);",
            });
          } else if (cycle.cycle === 2) {
            TestValidator.equals(
              "new schema adds uncovered population",
              cycle.success,
              false,
            );
            await EvidenceTestFileSystem.save(directory, {
              "schemas/extra.sql":
                "CREATE TABLE Extra (value INT); ALTER TABLE Extra ADD COLUMN changed INT;",
            });
          } else if (cycle.cycle === 3) {
            TestValidator.equals(
              "unsupported mutation is incomplete",
              cycle.status,
              "incomplete",
            );
            await EvidenceTestFileSystem.save(directory, {
              "schemas/extra.sql": "CREATE TABLE Extra (",
            });
          } else if (cycle.cycle === 4) {
            TestValidator.equals(
              "malformed source remains incomplete",
              cycle.status,
              "incomplete",
            );
            await EvidenceTestFileSystem.save(directory, {
              "schemas/extra.sql":
                "/** @internal Retired schema. */\nCREATE TABLE Extra (value INT);",
            });
          } else {
            TestValidator.equals("repaired cycle", cycle.cycle, 5);
            TestValidator.equals(
              "withdrawal recovers coverage",
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
