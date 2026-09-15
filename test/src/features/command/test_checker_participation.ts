import { EvidChecker } from "evid";
import type { IEvidConfigPlan } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { EvidTestFileSystem } from "../../internal/EvidTestFileSystem";

/**
 * Rejects acknowledgements that lie outside a claim's target and exclusion
 * boundaries.
 *
 * A TypeScript-function claim owns Markdown heading targets only. Its graph
 * must expose an annotation for a Prisma target as a
 * configuration-participation error, and must constrain valid Markdown
 * exclusions to declared carrier files.
 *
 * 1. Evaluate a function annotated with a Prisma model and require the
 *    check-non-participating-acknowledgement diagnostic.
 * 2. Replace it with an exclusion for the configured Markdown target, then limit
 *    exclusion carriers to a different source file.
 * 3. Require the misplaced source host to report graph-out-of-scope-host with exit
 *    1 rather than silently accepting or discarding the exclusion.
 */
export async function test_checker_participation(): Promise<void> {
  const location = join(__dirname, `participation ${randomUUID()}`);
  await EvidTestFileSystem.experiment(
    location,
    {
      "evidence.config.ts": "export default {};\n",
      "docs/spec.md": "## Requirement {#requirement}\n",
      "src/implementation.ts": dedent`
        /** @evidence prisma:Sale Implements a population this claim does not reference. */
        export function implementation(): void {}
      `,
    },
    async (directory) => {
      const plan = createPlan(directory);

      // A syntactically distinct target family is diagnosed instead of discarded.
      const unrelated = await EvidChecker.evaluate(plan);
      TestValidator.predicate(
        "non-participating target",
        unrelated.report.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "check-non-participating-acknowledgement",
        ),
      );

      // A matching exclusion remains invalid when its host file misses the carrier globs.
      await EvidTestFileSystem.save(directory, {
        "src/implementation.ts": dedent`
          /** @evidenceExclude docs/spec.md#requirement This requirement does not apply. */
          export function implementation(): void {}
        `,
      });
      const claim = plan.claims[0];
      if (claim === undefined)
        throw new Error("Missing participation fixture claim.");
      claim.population.evidenceExcludeCarriers = ["src/exclusions.ts"];

      const misplaced = await EvidChecker.evaluate(plan);
      TestValidator.predicate(
        "misplaced exclusion",
        misplaced.report.diagnostics.some(
          (diagnostic) => diagnostic.code === "graph-out-of-scope-host",
        ),
      );
      TestValidator.equals(
        "misplaced exclusion exit",
        misplaced.report.exitCode,
        1,
      );
    },
  );
}

function createPlan(directory: string): IEvidConfigPlan {
  return {
    configFile: join(directory, "evidence.config.ts"),
    claims: [
      {
        index: 0,
        population: {
          type: "typescript",
          files: ["src/**/*.ts"],
          symbol: "function",
          reference: {
            type: "markdown",
            files: ["docs/**/*.md"],
            symbol: "h2",
          },
        },
        severity: "error",
        symbols: ["function"],
        references: [
          {
            index: 0,
            population: {
              type: "markdown",
              files: ["docs/**/*.md"],
              symbol: "h2",
            },
            severity: "error",
            symbols: ["h2"],
          },
        ],
      },
    ],
  };
}
