import { EvidenceChecker, EvidenceWatcher } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { TestFileSystem } from "../../internal/TestFileSystem";

/**
 * Invalidates re-export and syntax changes, then recovers the graph in place.
 *
 * Watch cycles must reflect public target aliases and parser failures immediately,
 * with each non-failed result matching a fresh one-shot checker report.
 *
 * 1. Start with a function citing a barrel-exported contract and require the
 *    initial watcher report to equal a fresh successful check.
 * 2. Rename the barrel export and require an exit-1 cycle for the now-missing
 *    public target.
 * 3. Replace the implementation with invalid TypeScript and require an incomplete
 *    cycle instead of the previous graph result.
 * 4. Restore the barrel export and implementation, then require cycle 4 to
 *    succeed before closing the watcher.
 */
export async function test_watch_reexport(): Promise<void> {
  const location = join(__dirname, `reexport ${randomUUID()}`);
  await TestFileSystem.experiment(
    location,
    {
      "evidence.config.ts": dedent`
        export default {
          claims: [
            {
              type: "typescript",
              files: ["src/**/*.ts"],
              symbol: "function",
              reference: {
                type: "typescript",
                files: ["contracts/**/*.ts"],
                symbol: "type",
              },
            },
          ],
        };
      `,
      "contracts/contract.ts": dedent`
        export interface Contract {
          value: number;
        }
      `,
      "contracts/barrel.ts": `export { Contract } from "./contract";\n`,
      "src/implementation.ts": implementation(),
    },
    async (directory) => {
      const configFile = join(directory, "evidence.config.ts");
      const watcher = new EvidenceWatcher(configFile, {
        pollIntervalMilliseconds: 20,
        debounceMilliseconds: 20,
      });

      await watcher.watch(async (cycle) => {
        if (cycle.status === "failed")
          throw new Error(`Unexpected watch failure: ${cycle.message}`);
        TestValidator.equals(
          `fresh reexport report ${cycle.cycle}`,
          cycle.report,
          await EvidenceChecker.check(configFile),
        );

        // The barrel alias changes the public target without changing its source type.
        if (cycle.cycle === 1) {
          TestValidator.predicate("initial reexport succeeds", cycle.success);
          await TestFileSystem.save(directory, {
            "contracts/barrel.ts": `export { Contract as Renamed } from "./contract";\n`,
          });
          return;
        }
        if (cycle.cycle === 2) {
          TestValidator.equals("renamed reexport exit", cycle.exitCode, 1);
          await TestFileSystem.save(directory, {
            "src/implementation.ts": "export function broken( {\n",
          });
          return;
        }

        // A syntax error publishes incomplete analysis instead of the prior result.
        if (cycle.cycle === 3) {
          TestValidator.equals("syntax status", cycle.status, "incomplete");
          await TestFileSystem.save(directory, {
            "contracts/barrel.ts": `export { Contract } from "./contract";\n`,
            "src/implementation.ts": implementation(),
          });
          return;
        }

        TestValidator.equals("repaired cycle", cycle.cycle, 4);
        TestValidator.predicate("repaired graph succeeds", cycle.success);
        await watcher.close();
      });
    },
  );
}

function implementation(): string {
  return dedent`
    /** @evidence ../contracts/barrel.ts#Contract Implements the contract. */
    export function calculate(): number {
      return 1;
    }
  `;
}
