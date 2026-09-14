import { EvidenceChecker, EvidenceWatcher } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { join } from "node:path";

import { TestFileSystem } from "../../internal/TestFileSystem";

/** Rebuilds Php populations after source, new-file, syntax, and configuration changes. */
export async function test_php_watch(): Promise<void> {
  await TestFileSystem.experiment(
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
            await TestFileSystem.save(directory, {
              "contracts/Extra.php": "<?php const extra = 2;\n",
            });
          } else if (cycle.cycle === 2) {
            TestValidator.equals(
              "new undocumented declaration invalidates coverage",
              cycle.success,
              false,
            );
            await TestFileSystem.save(directory, {
              "contracts/Extra.php": "<?php class Broken {\n",
            });
          } else if (cycle.cycle === 3) {
            TestValidator.equals(
              "syntax failure replaces prior inventory",
              cycle.status,
              "incomplete",
            );
            await TestFileSystem.save(directory, {
              "contracts/Extra.php":
                "<?php /** @internal Hidden helper. */ class Extra { private const extra = 2; }\n",
            });
          } else if (cycle.cycle === 4) {
            TestValidator.equals(
              "repaired source recovers",
              cycle.success,
              true,
            );
            await TestFileSystem.save(directory, {
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
