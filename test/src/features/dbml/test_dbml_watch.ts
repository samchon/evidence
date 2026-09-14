import { EvidenceChecker, EvidenceWatcher } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { join } from "node:path";

import { TestFileSystem } from "../../internal/TestFileSystem";

/** Rebuilds cross-file DBML relations after newly discovered endpoints, malformed edits and recovery. */
export async function test_dbml_watch(): Promise<void> {
  await TestFileSystem.experiment(
    "dbml-watch",
    {
      "evidence.config.ts": dedent`
      export default { claims: [{ type: "typescript", files: ["claims.ts"], reference: { type: "dbml", files: ["schema/*.dbml"], symbol: "relation" } }] };
    `,
      "claims.ts": dedent`
      /** @evidence ./schema/posts.dbml#posts Covers declared post relations. */
      export function verify() {}
    `,
      "schema/posts.dbml":
        "Table posts { user_id int }\nRef owner: posts.user_id > users.id",
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
            `fresh DBML watch cycle ${cycle.cycle}`,
            cycle.report,
            await EvidenceChecker.check(file),
          );
          if (cycle.cycle === 1) {
            TestValidator.equals(
              "missing relation endpoint incomplete",
              cycle.status,
              "incomplete",
            );
            await TestFileSystem.save(directory, {
              "schema/users.dbml": "Table users { id int }",
            });
          } else if (cycle.cycle === 2) {
            TestValidator.equals(
              "new endpoint source recovers",
              cycle.success,
              true,
            );
            await TestFileSystem.save(directory, {
              "schema/users.dbml": "Table users { id int",
            });
          } else if (cycle.cycle === 3) {
            TestValidator.equals(
              "malformed dependency incomplete",
              cycle.status,
              "incomplete",
            );
            await TestFileSystem.save(directory, {
              "schema/users.dbml": "Table users { id bigint }",
            });
          } else {
            TestValidator.equals("exact recovery cycle", cycle.cycle, 4);
            TestValidator.equals(
              "repaired schema recovers",
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
