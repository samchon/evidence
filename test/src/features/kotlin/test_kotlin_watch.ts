import { EvidChecker, EvidWatcher } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { join } from "node:path";

import { TestFileSystem } from "../../internal/TestFileSystem";

/** Rebuilds Kotlin populations after source, discovery, syntax, and configuration changes.
 *
 * Watch must publish each checked state instead of retaining stale Kotlin analysis.
 *
 * 1. Mutate selected source and add a file. 2. Introduce malformed source. 3. Repair it and verify recovery after configuration change.
 */
export async function test_kotlin_watch(): Promise<void> {
  await TestFileSystem.experiment(
    "kotlin-watch",
    {
      "evid.config.ts": dedent`
      export default { claims: [{ type: "typescript", files: ["claims.ts"], reference: { type: "kotlin", files: ["contracts/*.kt"], symbol: "property" } }] };
    `,
      "claims.ts": dedent`
      /** @evid ./contracts/Contract.kt#Contract Implements the contract. */
      export function claim() {}
    `,
      "contracts/Contract.kt": "class Contract { val value = 1; }\n",
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
            `fresh Kotlin cycle ${cycle.cycle}`,
            cycle.report,
            await EvidChecker.check(file),
          );
          if (cycle.cycle === 1) {
            TestValidator.equals(
              "initial Kotlin coverage",
              cycle.success,
              true,
            );
            await TestFileSystem.save(directory, {
              "contracts/Extra.kt": "val extra = 2\n",
            });
          } else if (cycle.cycle === 2) {
            TestValidator.equals(
              "new undocumented declaration invalidates coverage",
              cycle.success,
              false,
            );
            await TestFileSystem.save(directory, {
              "contracts/Extra.kt": "class Broken {\n",
            });
          } else if (cycle.cycle === 3) {
            TestValidator.equals(
              "syntax failure replaces prior inventory",
              cycle.status,
              "incomplete",
            );
            await TestFileSystem.save(directory, {
              "contracts/Extra.kt": "private val extra = 2\n",
            });
          } else if (cycle.cycle === 4) {
            TestValidator.equals(
              "repaired source recovers",
              cycle.success,
              true,
            );
            await TestFileSystem.save(directory, {
              "evid.config.ts": dedent`
            export default { claims: [{ type: "typescript", files: ["claims.ts"], reference: { type: "kotlin", files: ["contracts/*.kt"], symbol: "type" } }] };
          `,
            });
          } else {
            TestValidator.equals(
              "configuration reselects Kotlin types",
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
