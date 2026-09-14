import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { EvidenceChecker } from "../../../../packages/evidence/src/EvidenceChecker";
import { EvidenceWatcher } from "../../../../packages/evidence/src/commands/EvidenceWatcher";
import { TestFileSystem } from "../../internal/TestFileSystem";

/** Verifies re-export and syntax changes invalidate graph results and recover in place. */
export async function test_watch_reexport(): Promise<void> {
  const location = join(__dirname, `reexport 한글 ${randomUUID()}`);
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
