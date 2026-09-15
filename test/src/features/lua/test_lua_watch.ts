import { EvidChecker, EvidWatcher } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { join } from "node:path";

import { EvidTestFileSystem } from "../../internal/EvidTestFileSystem";

/** Rebuilds Lua populations after source, discovery, syntax, and configuration changes.
 *
 * Watch must invalidate stale module analysis as selected project inputs change.
 *
 * 1. Mutate source and add a selected file. 2. Introduce malformed input. 3. Repair it and verify recovered configuration output.
 */
export async function test_lua_watch(): Promise<void> {
  await EvidTestFileSystem.experiment(
    "lua-watch",
    {
      "evidence.config.ts": dedent`
      export default { claims: [{ type: "typescript", files: ["claims.ts"], reference: { type: "lua", files: ["contracts/*.lua"], symbol: "property" } }] };
    `,
      "claims.ts": dedent`
      /** @evidence ./contracts/Contract.lua#module Implements the contract. */
      export function claim() {}
    `,
      "contracts/Contract.lua": "return { value = 1, run = function() end }\n",
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
            `fresh Lua cycle ${cycle.cycle}`,
            cycle.report,
            await EvidChecker.check(file),
          );
          if (cycle.cycle === 1) {
            TestValidator.equals("initial Lua coverage", cycle.success, true);
            await EvidTestFileSystem.save(directory, {
              "contracts/Extra.lua": "extra = 2\n",
            });
          } else if (cycle.cycle === 2) {
            TestValidator.equals(
              "new undocumented declaration invalidates coverage",
              cycle.success,
              false,
            );
            await EvidTestFileSystem.save(directory, {
              "contracts/Extra.lua": "function broken(\n",
            });
          } else if (cycle.cycle === 3) {
            TestValidator.equals(
              "syntax failure replaces prior inventory",
              cycle.status,
              "incomplete",
            );
            await EvidTestFileSystem.save(directory, {
              "contracts/Extra.lua": "local extra = 2\n",
            });
          } else if (cycle.cycle === 4) {
            TestValidator.equals(
              "repaired source recovers",
              cycle.success,
              true,
            );
            await EvidTestFileSystem.save(directory, {
              "evidence.config.ts": dedent`
            export default { claims: [{ type: "typescript", files: ["claims.ts"], reference: { type: "lua", files: ["contracts/*.lua"], symbol: "function" } }] };
          `,
            });
          } else {
            TestValidator.equals(
              "configuration reselects Lua functions",
              cycle.cycle,
              5,
            );
            TestValidator.equals(
              "fresh function coverage",
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
