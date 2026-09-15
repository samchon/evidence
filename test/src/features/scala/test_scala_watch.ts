import { EvidenceChecker, EvidenceWatcher } from "evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { join } from "node:path";

import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";

/**
 * Rebuilds selected Scala populations across watcher cycles.
 *
 * A filesystem-backed claim initially covers one property, then new source,
 * malformed source, a repair, and a selector change exercise replacement and
 * recovery of watcher state.
 *
 * 1. Start the watcher and compare each fresh cycle with a direct checker result.
 * 2. Add an uncovered source, introduce a syntax failure, and verify coverage
 *    failure then incomplete replacement.
 * 3. Repair the source and change the configuration selector, verifying recovery
 *    and the final type-selection cycle.
 */
export async function test_scala_watch(): Promise<void> {
  await EvidenceTestFileSystem.experiment(
    "scala-watch",
    {
      "evidence.config.ts": dedent`
      export default { claims: [{ type: "typescript", files: ["claims.ts"], reference: { type: "scala", files: ["contracts/*.scala"], symbol: "property" } }] };
    `,
      "claims.ts": dedent`
      /** @evidence ./contracts/Contract.scala#Contract Implements the contract. */
      export function claim() {}
    `,
      "contracts/Contract.scala": "class Contract { val value = 1; }\n",
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
            `fresh Scala cycle ${cycle.cycle}`,
            cycle.report,
            await EvidenceChecker.check(file),
          );
          if (cycle.cycle === 1) {
            TestValidator.equals("initial Scala coverage", cycle.success, true);
            await EvidenceTestFileSystem.save(directory, {
              "contracts/Extra.scala": "val extra = 2\n",
            });
          } else if (cycle.cycle === 2) {
            TestValidator.equals(
              "new undocumented declaration invalidates coverage",
              cycle.success,
              false,
            );
            await EvidenceTestFileSystem.save(directory, {
              "contracts/Extra.scala": "class Broken {\n",
            });
          } else if (cycle.cycle === 3) {
            TestValidator.equals(
              "syntax failure replaces prior inventory",
              cycle.status,
              "incomplete",
            );
            await EvidenceTestFileSystem.save(directory, {
              "contracts/Extra.scala": "private val extra = 2\n",
            });
          } else if (cycle.cycle === 4) {
            TestValidator.equals(
              "repaired source recovers",
              cycle.success,
              true,
            );
            await EvidenceTestFileSystem.save(directory, {
              "evidence.config.ts": dedent`
            export default { claims: [{ type: "typescript", files: ["claims.ts"], reference: { type: "scala", files: ["contracts/*.scala"], symbol: "type" } }] };
          `,
            });
          } else {
            TestValidator.equals(
              "configuration reselects Scala types",
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
