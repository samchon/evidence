import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { EvidenceChecker } from "../../../../packages/evidence/src/EvidenceChecker";
import { EvidenceReporter } from "../../../../packages/evidence/src/reporters/EvidenceReporter";
import type { IEvidenceConfigPlan } from "../../../../packages/evidence/src/structures/IEvidenceConfigPlan";
import { TestFileSystem } from "../../internal/TestFileSystem";

/** Runs source discovery, two adapters, target resolution, graph policy, and reports. */
export async function test_checker_pipeline(): Promise<void> {
  const location = join(__dirname, `checker 한글 ${randomUUID()}`);
  await TestFileSystem.experiment(
    location,
    {
      "evidence.config.ts": "export default {};\n",
      "docs/requirements.md": dedent`
        ## Pricing {#pricing}

        Calculate the public price.
      `,
      "contracts/reference.ts": dedent`
        export interface Contract {
          value: number;
        }
      `,
      "src/implementation.ts": dedent`
        /**
         * @evidence docs/requirements.md#pricing Implements the pricing requirement.
         * @evidence ../contracts/reference.ts#Contract Implements the public contract.
         */
        export function calculate(): number {
          return 1;
        }
      `,
    },
    async (directory) => {
      const plan = createPlan(directory, "error");

      // One declaration host independently satisfies Markdown and TypeScript obligations.
      const passing = await EvidenceChecker.evaluate(plan);
      const passingClaim = passing.report.claims[0];
      if (passingClaim === undefined)
        throw new Error("Missing checker result claim.");
      TestValidator.predicate(
        "complete pipeline succeeds",
        passing.report.success,
      );
      TestValidator.equals("complete exit", passing.report.exitCode, 0);
      TestValidator.equals("configured claim index", passingClaim.claim, 2);
      TestValidator.equals(
        "configured reference indexes",
        passingClaim.obligations.map((obligation) => obligation.reference),
        [3, 5],
      );
      TestValidator.equals(
        "covered units",
        passing.report.counts.coveredUnits,
        2,
      );
      TestValidator.equals(
        "complete diagnostics",
        passing.report.diagnostics,
        [],
      );

      // Text and JSON render the same counts and the versioned JSON is deterministic.
      const text = EvidenceReporter.text(passing.report);
      const json = EvidenceReporter.json(passing.report);
      TestValidator.predicate("text coverage", text.includes("Coverage: 2/2"));
      TestValidator.predicate(
        "json schema",
        json.includes('"schemaVersion": 1'),
      );
      TestValidator.equals(
        "deterministic JSON",
        EvidenceReporter.json(passing.report),
        json,
      );

      // Removing both acknowledgements leaves complete analysis with violations.
      await TestFileSystem.save(directory, {
        "src/implementation.ts": dedent`
          export function calculate(): number {
            return 1;
          }
        `,
      });
      const failing = await EvidenceChecker.evaluate(plan);
      TestValidator.equals("violation exit", failing.report.exitCode, 1);
      TestValidator.equals(
        "missing units",
        failing.report.counts.missingUnits,
        2,
      );
      TestValidator.predicate(
        "original diagnostic indexes",
        failing.report.diagnostics.every(
          (diagnostic) =>
            diagnostic.claim === 2 &&
            (diagnostic.reference === 3 || diagnostic.reference === 5),
        ),
      );

      const failingText = EvidenceReporter.text(failing.report);
      TestValidator.predicate(
        "text claim and reference context",
        failingText.includes(
          "claim[2] 'calculator' (typescript) -> reference[3] (markdown)",
        ),
      );
      TestValidator.predicate(
        "text source location",
        failingText.includes("Location:"),
      );
      TestValidator.predicate(
        "text diagnostic subject",
        failingText.includes("Subject:"),
      );
      TestValidator.predicate("text repair", failingText.includes("Repair:"));

      // Warning findings retain a successful process status after complete analysis.
      const warning = await EvidenceChecker.evaluate(
        createPlan(directory, "warning"),
      );
      TestValidator.equals("warning exit", warning.report.exitCode, 0);
      TestValidator.predicate("warning success", warning.report.success);
      TestValidator.equals("warning count", warning.report.counts.warnings, 2);

      // An unreadable reference cannot be mistaken for an empty passing denominator.
      const incomplete = createPlan(directory, "error");
      const incompleteClaim = incomplete.claims[0];
      const firstReference =
        incompleteClaim === undefined
          ? undefined
          : incompleteClaim.references[0];
      if (firstReference === undefined)
        throw new Error("Missing checker fixture reference.");
      firstReference.population.root = "missing-root";

      const partial = await EvidenceChecker.evaluate(incomplete);
      TestValidator.equals("incomplete exit", partial.report.exitCode, 2);
      TestValidator.equals(
        "incomplete status",
        partial.report.status,
        "incomplete",
      );
      TestValidator.predicate(
        "incomplete obligation",
        partial.report.counts.incompleteObligations > 0,
      );
    },
  );
}

function createPlan(
  directory: string,
  severity: "error" | "warning",
): IEvidenceConfigPlan {
  return {
    configFile: join(directory, "evidence.config.ts"),
    claims: [
      {
        index: 2,
        population: {
          name: "calculator",
          type: "typescript",
          files: ["src/**/*.ts"],
          symbol: "function",
          reference: [
            {
              type: "markdown",
              files: ["docs/**/*.md"],
              symbol: "h2",
            },
            {
              type: "typescript",
              files: ["contracts/**/*.ts"],
              symbol: "type",
            },
          ],
        },
        severity,
        symbols: ["function"],
        references: [
          {
            index: 3,
            population: {
              type: "markdown",
              files: ["docs/**/*.md"],
              symbol: "h2",
            },
            severity,
            symbols: ["h2"],
          },
          {
            index: 5,
            population: {
              type: "typescript",
              files: ["contracts/**/*.ts"],
              symbol: "type",
            },
            severity,
            symbols: ["type"],
          },
        ],
      },
    ],
  };
}
