import { EvidenceChecker, EvidenceWatcher } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { join } from "node:path";

import { TestFileSystem } from "../../internal/TestFileSystem";

/** Recovers a missing generated part and observes subsequent public changes through its defining library alias. */
export async function test_dart_part_watch(): Promise<void> {
  await TestFileSystem.experiment(
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
            await TestFileSystem.save(directory, {
              "contracts/model.g.dart":
                "part of 'api.dart'; class Model { int value = 1; }",
            });
          } else if (cycle.cycle === 2) {
            TestValidator.equals(
              "new generated source recovers",
              cycle.success,
              true,
            );
            await TestFileSystem.save(directory, {
              "contracts/model.g.dart":
                "part of 'api.dart'; class Model { int value = 1; int extra = 2; }",
            });
          } else if (cycle.cycle === 3) {
            TestValidator.equals(
              "part surface edit invalidates coverage",
              cycle.success,
              false,
            );
            await TestFileSystem.save(directory, {
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
