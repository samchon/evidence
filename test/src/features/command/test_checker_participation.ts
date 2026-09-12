import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { EvidenceChecker } from "../../../../packages/evidence/src/EvidenceChecker";
import type { IEvidenceConfigPlan } from "../../../../packages/evidence/src/structures/IEvidenceConfigPlan";
import { TestFileSystem } from "../../internal/TestFileSystem";

/** Rejects unowned target families and exclusions outside configured carriers. */
export async function test_checker_participation(): Promise<void> {
  const location = join(__dirname, `participation 한글 ${randomUUID()}`);
  await TestFileSystem.experiment(
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
      const unrelated = await EvidenceChecker.evaluate(plan);
      TestValidator.predicate(
        "non-participating target",
        unrelated.report.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "check-non-participating-acknowledgement",
        ),
      );

      // A matching exclusion remains invalid when its host file misses the carrier globs.
      await TestFileSystem.save(directory, {
        "src/implementation.ts": dedent`
          /** @evidenceExclude docs/spec.md#requirement This requirement does not apply. */
          export function implementation(): void {}
        `,
      });
      const claim = plan.claims[0];
      if (claim === undefined)
        throw new Error("Missing participation fixture claim.");
      claim.population.evidenceExcludeCarriers = ["src/exclusions.ts"];

      const misplaced = await EvidenceChecker.evaluate(plan);
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

function createPlan(directory: string): IEvidenceConfigPlan {
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
