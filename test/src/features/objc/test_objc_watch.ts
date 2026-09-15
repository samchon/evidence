import { EvidChecker, EvidWatcher } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { join } from "node:path";

import { EvidTestFileSystem } from "../../internal/EvidTestFileSystem";

/**
 * Rebuilds Objective-C populations as selected files change.
 *
 * Watch output must replace merged inventories after implementation edits, new
 * headers, malformed source, and repair.
 *
 * 1. Start with covered input and compare each cycle to a fresh check.
 * 2. Add and mutate declarations, then require failed coverage and incomplete
 *    parsing.
 * 3. Repair the source and require coverage recovery.
 */
export async function test_objc_watch(): Promise<void> {
  await EvidTestFileSystem.experiment(
    "objc-watch",
    {
      "evidence.config.ts": dedent`
      export default { claims: [{ type: "typescript", files: ["claims.ts"], reference: { type: "objc", files: ["contracts/*.h", "contracts/*.m"], symbol: "property" } }] };
    `,
      "claims.ts": dedent`
      /** @evidence ./contracts/Contract.h#Contract Implements the contract. */
      export function claim() {}
    `,
      "contracts/Contract.h":
        "@interface Contract\n@property int value;\n@end\n",
      "contracts/Contract.m": "@implementation Contract\n@end\n",
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
            `fresh Objective-C cycle ${cycle.cycle}`,
            cycle.report,
            await EvidChecker.check(file),
          );
          if (cycle.cycle === 1) {
            TestValidator.equals(
              "initial merged coverage",
              cycle.success,
              true,
            );
            await EvidTestFileSystem.save(directory, {
              "contracts/Extra.h":
                "@interface Extra\n@property int missing;\n@end\n",
            });
          } else if (cycle.cycle === 2) {
            TestValidator.equals(
              "new undocumented header changes denominator",
              cycle.success,
              false,
            );
            await EvidTestFileSystem.save(directory, {
              "contracts/Extra.h": "@interface Broken\n",
            });
          } else if (cycle.cycle === 3) {
            TestValidator.equals(
              "malformed source invalidates cached inventory",
              cycle.status,
              "incomplete",
            );
            await EvidTestFileSystem.save(directory, {
              "contracts/Extra.h": "@class Extra;\n",
            });
          } else if (cycle.cycle === 4) {
            TestValidator.equals(
              "source repair recovers coverage",
              cycle.success,
              true,
            );
            await EvidTestFileSystem.save(directory, {
              "contracts/Contract.m":
                "@interface Contract ()\n@property int privateValue;\n@end\n@implementation Contract\n@end\n",
            });
          } else {
            TestValidator.equals(
              "implementation dependency triggers rebuild",
              cycle.cycle,
              5,
            );
            TestValidator.equals(
              "private class extension does not add obligations",
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
