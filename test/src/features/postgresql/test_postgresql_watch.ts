import { EvidenceChecker, EvidenceWatcher } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { join } from "node:path";

import { TestFileSystem } from "../../internal/TestFileSystem";

/** Rebuilds cross-file additive schema ownership after new files, syntax failure, and recovery. */
export async function test_postgresql_watch(): Promise<void> {
  await TestFileSystem.experiment(
    "postgresql-watch",
    {
      "evidence.config.ts": dedent`
      export default { claims: [{ type: "typescript", files: ["claim.ts"], reference: { type: "postgresql", files: ["schema/*.sql"], symbol: "column" } }] };
    `,
      "claim.ts":
        "/** @evidence ./schema/base.sql#app.item Covers the table. */\nexport function claim() {}\n",
      "schema/base.sql": "CREATE TABLE app.Item (id integer);\n",
    },
    async (directory) => {
      const file = join(directory, "evidence.config.ts");
      const watcher = new EvidenceWatcher(file, {
        pollIntervalMilliseconds: 10,
        debounceMilliseconds: 10,
      });
      try {
        await watcher.watch(async (cycle) => {
          if (cycle.status === "failed") throw new Error(cycle.message);
          TestValidator.equals(
            `fresh snapshot ${cycle.cycle}`,
            cycle.report,
            await EvidenceChecker.check(file),
          );
          if (cycle.cycle === 1) {
            TestValidator.equals("initial coverage", cycle.success, true);
            await TestFileSystem.save(directory, {
              "schema/add.sql": "ALTER TABLE app.Item ADD COLUMN value text;\n",
            });
          } else if (cycle.cycle === 2) {
            TestValidator.equals(
              "cross-file addition shares table owner",
              cycle.success,
              true,
            );
            await TestFileSystem.save(directory, {
              "schema/add.sql": "ALTER TABLE app.Item ADD COLUMN value (\n",
            });
          } else if (cycle.cycle === 3) {
            TestValidator.equals(
              "broken addition is incomplete",
              cycle.status,
              "incomplete",
            );
            await TestFileSystem.save(directory, {
              "schema/add.sql":
                "ALTER TABLE app.Item ADD COLUMN value text;\nCREATE TABLE app.Other (extra integer);\n",
            });
          } else if (cycle.cycle === 4) {
            TestValidator.equals(
              "new unrelated column needs evidence",
              cycle.success,
              false,
            );
            await TestFileSystem.save(directory, {
              "schema/add.sql": "ALTER TABLE app.Item ADD COLUMN value text;\n",
            });
          } else {
            TestValidator.equals("recovery cycle", cycle.cycle, 5);
            TestValidator.equals("source recovery", cycle.success, true);
            await watcher.close();
          }
        });
      } finally {
        await watcher.close();
      }
    },
  );
}
