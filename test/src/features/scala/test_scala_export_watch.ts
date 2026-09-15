import { EvidenceChecker, EvidenceWatcher } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { join } from "node:path";
import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";

/**
 * Recomputes Scala export coverage when a source declaration changes
 * visibility.
 *
 * A watcher starts with an exported selected property, then restricts its
 * source declaration, adds an uncovered property, and repairs it so each cycle
 * must discard stale export identities before checking coverage.
 *
 * 1. Start the watcher and verify the initial exported property satisfies the
 *    claim.
 * 2. Restrict the source property and verify the following cycle is incomplete
 *    rather than reusing its prior identity.
 * 3. Add an uncovered property, remove it, and verify the watcher returns to
 *    complete coverage after recovery.
 */
export async function test_scala_export_watch(): Promise<void> {
  await EvidenceTestFileSystem.experiment(
    "scala-export-watch",
    {
      "evidence.config.ts": dedent`
      export default { claims: [{ type: "typescript", files: ["claims.ts"], reference: { type: "scala", files: ["contracts/*.scala"], symbol: "property" } }] };
    `,
      "claims.ts": dedent`
      /** @evidence ./contracts/Forward.scala#["object Forward"].value Verifies the exported property. */
      export function claim() {}
    `,
      "contracts/Forward.scala": "object Forward { export Origin.value }",
      "contracts/Origin.scala": "object Origin { val value = 1 }",
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
            `fresh export cycle ${cycle.cycle}`,
            cycle.report,
            await EvidenceChecker.check(file),
          );
          if (cycle.cycle === 1) {
            TestValidator.equals(
              "initial export coverage",
              cycle.success,
              true,
            );
            await EvidenceTestFileSystem.save(directory, {
              "contracts/Origin.scala":
                "object Origin { private val value = 1 }",
            });
          } else if (cycle.cycle === 2) {
            TestValidator.equals(
              "source restriction invalidates export",
              cycle.status,
              "incomplete",
            );
            await EvidenceTestFileSystem.save(directory, {
              "contracts/Origin.scala":
                "object Origin { val value = 2; val extra = 1 }",
            });
          } else if (cycle.cycle === 3) {
            TestValidator.equals(
              "new source property remains uncovered",
              cycle.success,
              false,
            );
            await EvidenceTestFileSystem.save(directory, {
              "contracts/Origin.scala": "object Origin { val value = 2 }",
            });
          } else {
            TestValidator.equals("export recovery cycle", cycle.cycle, 4);
            TestValidator.equals("export source recovery", cycle.success, true);
            await watcher.close();
          }
        });
      } finally {
        await watcher.close();
      }
    },
  );
}
