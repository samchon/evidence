import {
  EvidenceChecker,
  EvidenceWatchReporter,
  EvidenceWatcher,
} from "@wrtnlabs/evidence";
import type { EvidenceWatchCycle } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import typia from "typia";

import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";

/**
 * Publishes created and deleted glob matches as the same reports as fresh
 * checks.
 *
 * A watched glob population must change its denominator when selected files
 * appear or disappear, and each emitted JSON record must be independently
 * consumable.
 *
 * 1. Start with a covered pricing requirement and require cycle 1 to match a fresh
 *    successful check.
 * 2. Create a refund requirement under the watched glob and require cycle 2 to
 *    fail with one newly missing unit.
 * 3. Add the refund citation to the exact implementation and require cycle 3 to
 *    succeed, then delete the cited requirement.
 * 4. Require cycle 4 to fail after deletion and verify the four collected JSON
 *    emissions are NDJSON records with cycle identifiers 1 through 4.
 */
export async function test_watch_topology(): Promise<void> {
  const location = join(__dirname, `topology ${randomUUID()}`);
  await EvidenceTestFileSystem.experiment(
    location,
    {
      "evidence.config.ts": config(),
      "docs/pricing.md": requirement("Pricing", "pricing"),
      "src/calculator.ts": implementation(false),
    },
    async (directory) => {
      const configFile = join(directory, "evidence.config.ts");
      const watcher = new EvidenceWatcher(configFile, {
        pollIntervalMilliseconds: 20,
        debounceMilliseconds: 20,
      });
      const output: string[] = [];

      await watcher.watch(async (cycle) => {
        // Every published version must equal a one-shot analysis of the same files.
        if (cycle.status === "failed")
          throw new Error(`Unexpected watch failure: ${cycle.message}`);
        TestValidator.equals(
          `fresh report ${cycle.cycle}`,
          cycle.report,
          await EvidenceChecker.check(configFile),
        );
        output.push(EvidenceWatchReporter.json(cycle));

        // Creating a second requirement under the watched glob adds an obligation.
        if (cycle.cycle === 1) {
          TestValidator.predicate("initial graph succeeds", cycle.success);
          await EvidenceTestFileSystem.save(directory, {
            "docs/refund.md": requirement("Refund", "refund"),
          });
          return;
        }

        // The new requirement is missing until the selected claim cites it.
        if (cycle.cycle === 2) {
          TestValidator.equals("created requirement exit", cycle.exitCode, 1);
          TestValidator.equals(
            "created requirement missing",
            cycle.report.counts.missingUnits,
            1,
          );
          await EvidenceTestFileSystem.save(directory, {
            "src/calculator.ts": implementation(true),
          });
          return;
        }

        // Editing an exact source file restores complete coverage.
        if (cycle.cycle === 3) {
          TestValidator.predicate("edited citation succeeds", cycle.success);
          await EvidenceTestFileSystem.erase(join(directory, "docs/refund.md"));
          return;
        }

        // Deleting the cited requirement invalidates the target and remains visible.
        TestValidator.equals("deleted requirement cycle", cycle.cycle, 4);
        TestValidator.equals("deleted requirement exit", cycle.exitCode, 1);
        await watcher.close();
      });

      // Compact NDJSON keeps one complete versioned cycle on each line.
      const lines = output.join("").trim().split("\n");
      TestValidator.equals("NDJSON cycle count", lines.length, 4);
      TestValidator.equals(
        "NDJSON cycle identifiers",
        lines.map(
          (line) => typia.json.assertParse<EvidenceWatchCycle>(line).cycle,
        ),
        [1, 2, 3, 4],
      );
    },
  );
}

function config(): string {
  return dedent`
    import type { IEvidenceConfig } from "@wrtnlabs/evidence";

    export default {
      claims: [
        {
          type: "typescript",
          files: ["src/**/*.ts"],
          symbol: "function",
          reference: {
            type: "markdown",
            files: ["docs/**/*.md"],
            symbol: "h2",
          },
        },
      ],
    } satisfies IEvidenceConfig;
  `;
}

function requirement(title: string, anchor: string): string {
  return dedent`
    ## ${title} {#${anchor}}

    The calculator must implement ${title.toLowerCase()}.
  `;
}

function implementation(refund: boolean): string {
  return dedent`
    /**
     * @evidence docs/pricing.md#pricing Implements pricing.
     ${refund ? "* @evidence docs/refund.md#refund Implements refunds." : ""}
     */
    export function calculate(): number {
      return 1;
    }
  `;
}
