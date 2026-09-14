import { EvidenceChecker, EvidenceWatcher } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { join } from "node:path";

import { TestFileSystem } from "../../internal/TestFileSystem";

/** Rebuilds MATLAB populations after source, new-file, syntax, and configuration changes. */
export async function test_matlab_watch(): Promise<void> {
  await TestFileSystem.experiment(
    "matlab-watch",
    {
      "evidence.config.ts": dedent`
      export default { claims: [{ type: "typescript", files: ["claims.ts"], reference: { type: "matlab", files: ["contracts/*.m"], symbol: "property" } }] };
    `.concat("\n"),
      "claims.ts": dedent`
      /** @evidence ./contracts/Contract.m#Contract Implements the contract. */
      export function claim() {}
    `.concat("\n"),
      "contracts/Contract.m":
        "classdef Contract\nproperties\nvalue = 1\nend\nend\n",
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
            `fresh MATLAB cycle ${cycle.cycle}`,
            cycle.report,
            await EvidenceChecker.check(file),
          );
          if (cycle.cycle === 1) {
            TestValidator.equals(
              "initial MATLAB coverage",
              cycle.success,
              true,
            );
            await TestFileSystem.save(directory, {
              "contracts/Extra.m":
                "classdef Extra\nproperties\nextra = 2\nend\nend\n",
            });
          } else if (cycle.cycle === 2) {
            TestValidator.equals(
              "new undocumented declaration invalidates coverage",
              cycle.success,
              false,
            );
            await TestFileSystem.save(directory, {
              "contracts/Extra.m": "classdef Extra\n",
            });
          } else if (cycle.cycle === 3) {
            TestValidator.equals(
              "syntax failure replaces prior inventory",
              cycle.status,
              "incomplete",
            );
            await TestFileSystem.save(directory, {
              "contracts/Extra.m": "% Empty repaired source.\n",
            });
          } else if (cycle.cycle === 4) {
            TestValidator.equals(
              "repaired source recovers",
              cycle.success,
              true,
            );
            await TestFileSystem.save(directory, {
              "evidence.config.ts": dedent`
            export default { claims: [{ type: "typescript", files: ["claims.ts"], reference: { type: "matlab", files: ["contracts/*.m"], symbol: "type" } }] };
          `.concat("\n"),
            });
          } else {
            TestValidator.equals(
              "configuration reselects MATLAB types",
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
