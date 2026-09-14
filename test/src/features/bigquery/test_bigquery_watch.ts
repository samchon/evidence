import { EvidenceChecker, EvidenceWatcher } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { join } from "node:path";

import { TestFileSystem } from "../../internal/TestFileSystem";

/** Rebuilds the BigQuery population as watched schema files change.
 *
 * Watch must publish new declarations, report malformed source without silently shrinking coverage, and recover when the schema is repaired.
 *
 * 1. Start a watched project and add a schema file that contributes a selected table.
 * 2. Replace its source with malformed SQL and require an incomplete report.
 * 3. Repair the schema and require the expected population to return.
 */
export async function test_bigquery_watch(): Promise<void> {
  await TestFileSystem.experiment(
    "bigquery-watch",
    {
      "evidence.config.ts": dedent`
      export default { claims: [{ type: "typescript", files: ["claim.ts"], reference: { type: "bigquery", files: ["schema/*.sql"], symbol: "column" } }] };
    `,
      "claim.ts": dedent`
      /** @evidence ./schema/orders.sql#ds.orders Implements the table. */
      export function claim() {}
    `,
      "schema/orders.sql": "CREATE TABLE ds.orders (id INT64);",
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
            `fresh BigQuery cycle ${cycle.cycle}`,
            cycle.report,
            await EvidenceChecker.check(config),
          );
          if (cycle.cycle === 1) {
            TestValidator.equals("initial coverage", cycle.success, true);
            await TestFileSystem.save(directory, {
              "schema/extra.sql": "CREATE TABLE ds.extra (id INT64);",
            });
          } else if (cycle.cycle === 2) {
            TestValidator.equals(
              "new table loses coverage",
              cycle.success,
              false,
            );
            await TestFileSystem.save(directory, {
              "schema/extra.sql": "CREATE TABLE ds.extra (",
            });
          } else if (cycle.cycle === 3) {
            TestValidator.equals(
              "malformed schema remains incomplete",
              cycle.status,
              "incomplete",
            );
            await TestFileSystem.save(directory, {
              "schema/extra.sql": "CREATE TEMP TABLE extra (id INT64);",
            });
          } else {
            TestValidator.equals("bounded recovery cycle", cycle.cycle, 4);
            TestValidator.equals(
              "repaired private schema recovers",
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
