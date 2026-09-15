import { EvidChecker, EvidWatcher } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { join } from "node:path";

import { EvidTestFileSystem } from "../../internal/EvidTestFileSystem";

/**
 * Rebuilds Zig coverage after watched source and selector changes.
 *
 * New files, syntax failure, repair, and a changed selector must replace the
 * current inventory.
 *
 * 1. Compare each watch cycle to a fresh check.
 * 2. Add and break selected input, then require failure and incompleteness.
 * 3. Repair and reselect coverage, requiring recovery.
 */
export async function test_zig_watch(): Promise<void> {
  await EvidTestFileSystem.experiment(
    "zig-watch",
    {
      "evidence.config.ts": dedent`
      export default { claims: [{ type: "typescript", files: ["claims.ts"], reference: { type: "zig", files: ["contracts/*.zig"], symbol: "property" } }] };
    `,
      "claims.ts": dedent`
      /** @evidence ./contracts/Contract.zig#Contract Implements the contract. */
      export function claim() {}
    `,
      "contracts/Contract.zig":
        "pub const Contract = struct { value: i32, };\n",
    },
    async (directory) => {
      const file = join(directory, "evidence.config.ts");
      const watcher = new EvidWatcher(file, {
        pollIntervalMilliseconds: 10,
        debounceMilliseconds: 10,
      });
      try {
        await watcher.watch(async (cycle) => {
          if (cycle.status === "failed") throw new Error(cycle.message);
          TestValidator.equals(
            `fresh Zig cycle ${cycle.cycle}`,
            cycle.report,
            await EvidChecker.check(file),
          );
          if (cycle.cycle === 1) {
            TestValidator.equals("initial Zig coverage", cycle.success, true);
            await EvidTestFileSystem.save(directory, {
              "contracts/Extra.zig": "pub const extra = 2;\n",
            });
          } else if (cycle.cycle === 2) {
            TestValidator.equals(
              "new undocumented declaration invalidates coverage",
              cycle.success,
              false,
            );
            await EvidTestFileSystem.save(directory, {
              "contracts/Extra.zig": "pub const Broken = struct {\n",
            });
          } else if (cycle.cycle === 3) {
            TestValidator.equals(
              "syntax failure replaces prior inventory",
              cycle.status,
              "incomplete",
            );
            await EvidTestFileSystem.save(directory, {
              "contracts/Extra.zig": "const extra = 2;\n",
            });
          } else if (cycle.cycle === 4) {
            TestValidator.equals(
              "repaired source recovers",
              cycle.success,
              true,
            );
            await EvidTestFileSystem.save(directory, {
              "evidence.config.ts": dedent`
            export default { claims: [{ type: "typescript", files: ["claims.ts"], reference: { type: "zig", files: ["contracts/*.zig"], symbol: "type" } }] };
          `,
            });
          } else {
            TestValidator.equals(
              "configuration reselects Zig types",
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
