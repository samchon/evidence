import { EvidenceChecker, EvidenceWatcher } from "evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { join } from "node:path";

import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";

/**
 * Rebuilds PHP coverage after source and configuration changes.
 *
 * Watch cycles must replace stale PHP inventories when files are added,
 * malformed, repaired, or selected by a new symbol.
 *
 * 1. Start with covered input and compare each cycle to a fresh check.
 * 2. Add an undocumented declaration, then introduce a syntax failure.
 * 3. Repair the source and change the selector, requiring fresh passing coverage.
 */
export async function test_php_watch(): Promise<void> {
  await EvidenceTestFileSystem.experiment(
    "php-watch",
    {
      "evidence.config.ts": dedent`
      export default { claims: [{ type: "typescript", files: ["claims.ts"], reference: { type: "php", files: ["contracts/*.php"], symbol: "property" } }] };
    `,
      "claims.ts": dedent`
      /** @evidence ./contracts/Contract.php#Contract Implements the contract. */
      export function claim() {}
    `,
      "contracts/Contract.php":
        "<?php class Contract { public int $value = 1; }\n",
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
            `fresh Php cycle ${cycle.cycle}`,
            cycle.report,
            await EvidenceChecker.check(file),
          );
          if (cycle.cycle === 1) {
            TestValidator.equals("initial Php coverage", cycle.success, true);
            await EvidenceTestFileSystem.save(directory, {
              "contracts/Extra.php": "<?php const extra = 2;\n",
            });
          } else if (cycle.cycle === 2) {
            TestValidator.equals(
              "new undocumented declaration invalidates coverage",
              cycle.success,
              false,
            );
            await EvidenceTestFileSystem.save(directory, {
              "contracts/Extra.php": "<?php class Broken {\n",
            });
          } else if (cycle.cycle === 3) {
            TestValidator.equals(
              "syntax failure replaces prior inventory",
              cycle.status,
              "incomplete",
            );
            await EvidenceTestFileSystem.save(directory, {
              "contracts/Extra.php":
                "<?php /** @internal Hidden helper. */ class Extra { private const extra = 2; }\n",
            });
          } else if (cycle.cycle === 4) {
            TestValidator.equals(
              "repaired source recovers",
              cycle.success,
              true,
            );
            await EvidenceTestFileSystem.save(directory, {
              "evidence.config.ts": dedent`
            export default { claims: [{ type: "typescript", files: ["claims.ts"], reference: { type: "php", files: ["contracts/*.php"], symbol: "type" } }] };
          `,
            });
          } else {
            TestValidator.equals(
              "configuration reselects Php types",
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
