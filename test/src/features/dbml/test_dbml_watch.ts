import { EvidenceChecker, EvidenceWatcher } from "evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { join } from "node:path";

import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";

/**
 * Rebuilds cross-file DBML relations as endpoints are discovered, broken, and
 * repaired.
 *
 * A relation with a missing endpoint is incomplete until a new schema source
 * supplies it; subsequent malformed and repaired edits must update the same
 * watch contract.
 *
 * 1. Start a watcher with a posts relation whose users endpoint is absent and
 *    require an incomplete first cycle.
 * 2. Add users, then corrupt its table definition and require success followed by
 *    incompleteness.
 * 3. Repair the users source and require the fourth cycle to recover.
 */
export async function test_dbml_watch(): Promise<void> {
  await EvidenceTestFileSystem.experiment(
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
            await EvidenceTestFileSystem.save(directory, {
              "schema/users.dbml": "Table users { id int }",
            });
          } else if (cycle.cycle === 2) {
            TestValidator.equals(
              "new endpoint source recovers",
              cycle.success,
              true,
            );
            await EvidenceTestFileSystem.save(directory, {
              "schema/users.dbml": "Table users { id int",
            });
          } else if (cycle.cycle === 3) {
            TestValidator.equals(
              "malformed dependency incomplete",
              cycle.status,
              "incomplete",
            );
            await EvidenceTestFileSystem.save(directory, {
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
