import { EvidenceChecker, EvidenceWatcher } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { join } from "node:path";

import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";

/**
 * Recovers a missing generated Dart part and observes its public changes
 * through the library alias.
 *
 * The defining library owns its parts, so watch must invalidate and recover the
 * exported surface as a generated part appears and changes.
 *
 * 1. Start a watcher with a library that references an absent generated part.
 * 2. Add the part and require the library alias to expose its selected
 *    declaration.
 * 3. Change the generated declaration and require the following watch result to
 *    reflect it.
 */
export async function test_dart_part_watch(): Promise<void> {
  await EvidenceTestFileSystem.experiment(
    "dart-part-watch",
    {
      "evidence.config.ts": dedent`
      export default { claims: [{ type: "typescript", files: ["claim.ts"], reference: { type: "dart", files: ["contracts/*.dart"], symbol: "property" } }] };
    `,
      "claim.ts": dedent`
      /** @evidence ./contracts/api.dart#Model.value Verifies the public value. */
      export function claim() {}
    `,
      "contracts/api.dart": "part 'model.g.dart';",
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
            `fresh part cycle ${cycle.cycle}`,
            cycle.report,
            await EvidenceChecker.check(config),
          );
          if (cycle.cycle === 1) {
            TestValidator.equals(
              "missing part incomplete",
              cycle.status,
              "incomplete",
            );
            await EvidenceTestFileSystem.save(directory, {
              "contracts/model.g.dart":
                "part of 'api.dart'; class Model { int value = 1; }",
            });
          } else if (cycle.cycle === 2) {
            TestValidator.equals(
              "new generated source recovers",
              cycle.success,
              true,
            );
            await EvidenceTestFileSystem.save(directory, {
              "contracts/model.g.dart":
                "part of 'api.dart'; class Model { int value = 1; int extra = 2; }",
            });
          } else if (cycle.cycle === 3) {
            TestValidator.equals(
              "part surface edit invalidates coverage",
              cycle.success,
              false,
            );
            await EvidenceTestFileSystem.save(directory, {
              "contracts/model.g.dart":
                "part of 'api.dart'; class Model { int value = 1; int _extra = 2; }",
            });
          } else {
            TestValidator.equals(
              "library-private edit recovers",
              cycle.success,
              true,
            );
            TestValidator.equals("exact recovery cycle", cycle.cycle, 4);
            await watcher.close();
          }
        });
      } finally {
        await watcher.close();
      }
    },
  );
}
