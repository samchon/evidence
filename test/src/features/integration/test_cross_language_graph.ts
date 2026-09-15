import { createEvidenceConfigPlan, EvidenceChecker } from "@wrtnlabs/evidence";
import type {
  IEvidenceCheckAnalysis,
  IEvidenceConfigPlan,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";

/**
 * Runs one graph through Markdown, Prisma, Swagger, implementation, and test
 * declarations.
 *
 * The cross-language graph must keep independently configured obligations and
 * distinguish coverage violations from target-resolution and parser failures.
 *
 * 1. Evaluate the five-claim fixture spanning TypeScript, Markdown, Prisma, and
 *    Swagger; require six covered obligations with the expected claim,
 *    reference, artifact, and unit counts.
 * 2. Remove one implementation-to-Markdown citation and require only that
 *    obligation to become missing, with exit 1 and its graph diagnostic.
 * 3. Add a second Markdown requirement and require the denominator to grow to
 *    seven units with one missing acknowledgement.
 * 4. Rename the barrel export cited by the test claim and require the precise
 *    file-qualified target-missing-member diagnostic plus the resulting gap.
 * 5. Malform the Swagger document and require incomplete exit 2, diagnostics at
 *    every affected graph position, and no derivative empty-reference or
 *    missing acknowledgement findings.
 * 6. Restore the fixture records and require the same complete six-obligation
 *    graph in the existing checker process.
 */
export async function test_cross_language_graph(): Promise<void> {
  const location = join(__dirname, `cross-language-${randomUUID()}`);
  const records = fixtureRecords();

  await EvidenceTestFileSystem.experiment(
    location,
    records,
    async (directory) => {
      const plan = createPlan(directory);

      // The baseline has six independent obligations spanning every artifact family.
      const complete = await EvidenceChecker.evaluate(plan);
      assertCompleteGraph(complete, "baseline");

      TestValidator.equals(
        "cross-language obligations",
        complete.report.claims.map((claim) => [
          claim.claim,
          claim.type,
          claim.obligations.map((obligation) => [
            obligation.reference,
            obligation.type,
            obligation.units,
            obligation.coveredUnits,
            obligation.missingUnits,
          ]),
        ]),
        [
          [
            0,
            "typescript",
            [
              [0, "markdown", 1, 1, 0],
              [1, "prisma", 1, 1, 0],
            ],
          ],
          [1, "typescript", [[0, "typescript", 1, 1, 0]]],
          [2, "prisma", [[0, "markdown", 1, 1, 0]]],
          [3, "swagger", [[0, "markdown", 1, 1, 0]]],
          [4, "markdown", [[0, "swagger", 1, 1, 0]]],
        ],
      );

      // Removing one implementation citation breaks only its Markdown obligation.
      await EvidenceTestFileSystem.save(directory, {
        "src/sale.ts": implementationSource(false),
      });
      const removedCitation = await EvidenceChecker.evaluate(plan);

      TestValidator.equals(
        "removed citation exit",
        removedCitation.report.exitCode,
        1,
      );
      TestValidator.equals(
        "removed citation counts",
        [
          removedCitation.report.counts.units,
          removedCitation.report.counts.coveredUnits,
          removedCitation.report.counts.missingUnits,
        ],
        [6, 5, 1],
      );
      assertDiagnostic(removedCitation, "graph-missing-acknowledgement", 0, 0);

      // Adding one requirement expands the denominator instead of passing silently.
      await EvidenceTestFileSystem.save(directory, {
        "src/sale.ts": requireRecord(records, "src/sale.ts"),
        "docs/implementation.md": dedent`
        ## Implementation {#implementation}

        The sale service exposes a public creation function.

        ## Cancellation {#cancellation}

        The sale service exposes a public cancellation function.
      `,
      });
      const addedRequirement = await EvidenceChecker.evaluate(plan);

      TestValidator.equals(
        "new requirement exit",
        addedRequirement.report.exitCode,
        1,
      );
      TestValidator.equals(
        "new requirement denominator",
        [
          addedRequirement.report.counts.units,
          addedRequirement.report.counts.coveredUnits,
          addedRequirement.report.counts.missingUnits,
        ],
        [7, 6, 1],
      );
      assertDiagnostic(addedRequirement, "graph-missing-acknowledgement", 0, 0);

      // Renaming a barrel export invalidates the test's file-qualified public target.
      await EvidenceTestFileSystem.save(directory, {
        "docs/implementation.md": requireRecord(
          records,
          "docs/implementation.md",
        ),
        "src/index.ts": 'export { createSale as makeSale } from "./sale";\n',
      });
      const renamedExport = await EvidenceChecker.evaluate(plan);

      TestValidator.equals(
        "renamed export exit",
        renamedExport.report.exitCode,
        1,
      );
      TestValidator.equals(
        "renamed export target",
        renamedExport.report.diagnostics
          .filter((diagnostic) => diagnostic.code === "target-missing-member")
          .map((diagnostic) => [
            diagnostic.claim,
            diagnostic.reference,
            diagnostic.target,
          ]),
        [[1, 0, "../src/index.ts#createSale"]],
      );
      assertDiagnostic(renamedExport, "graph-missing-acknowledgement", 1, 0);

      // A malformed Swagger document interrupts both directions that depend on it.
      await EvidenceTestFileSystem.save(directory, {
        "src/index.ts": requireRecord(records, "src/index.ts"),
        "openapi.yaml": "openapi: [",
      });
      const malformedSwagger = await EvidenceChecker.evaluate(plan);

      TestValidator.equals(
        "malformed parser exit",
        malformedSwagger.report.exitCode,
        2,
      );
      TestValidator.equals(
        "malformed parser status",
        malformedSwagger.report.status,
        "incomplete",
      );
      TestValidator.equals(
        "malformed parser affected graph positions",
        malformedSwagger.report.diagnostics
          .filter(
            (diagnostic) =>
              diagnostic.code === "swagger-normalization-failed" ||
              diagnostic.code === "inventory-incomplete",
          )
          .map((diagnostic) => [diagnostic.claim, diagnostic.reference]),
        [
          [3, undefined],
          [3, undefined],
          [4, 0],
          [4, 0],
        ],
      );
      TestValidator.equals(
        "malformed parser suppresses derivative gaps",
        malformedSwagger.report.diagnostics.filter(
          (diagnostic) =>
            diagnostic.code === "graph-empty-reference" ||
            diagnostic.code === "graph-missing-acknowledgement",
        ),
        [],
      );

      // Repairing every mutation restores the exact complete graph in the same process.
      await EvidenceTestFileSystem.save(directory, {
        "openapi.yaml": requireRecord(records, "openapi.yaml"),
      });
      const repaired = await EvidenceChecker.evaluate(plan);
      assertCompleteGraph(repaired, "repaired");
    },
  );
}

function fixtureRecords(): Record<string, string> {
  return {
    "evidence.config.ts": "export default {};\n",
    "docs/implementation.md": dedent`
      ## Implementation {#implementation}

      The sale service exposes a public creation function.
    `,
    "docs/persistence.md": dedent`
      ## Persistence {#persistence}

      Every sale is stored with its public identifier.
    `,
    "docs/api.md": dedent`
      ## Sales API {#sales-api}

      The API exposes sale creation.
    `,
    "docs/guide.md": dedent`
      ## Create a sale {#create-a-sale}

      Call the public operation.

      <!-- @evidence POST:/sales Documents the public sale workflow. -->
    `,
    "prisma/schema.prisma": dedent`
      datasource db {
        provider = "postgresql"
      }

      /// @evidence docs/persistence.md#persistence Persists the required sale identity.
      model Sale {
        id String @id
      }
    `,
    "openapi.yaml": swaggerSource(),
    "src/sale.ts": implementationSource(true),
    "src/index.ts": 'export { createSale } from "./sale";\n',
    "test/sale.test.ts": dedent`
      /** @evidence ../src/index.ts#createSale Verifies the public sale function. */
      export function test_create_sale(): void {}
    `,
  };
}

function implementationSource(includeRequirement: boolean): string {
  return dedent`
    /**
     *${
       includeRequirement
         ? " @evidence docs/implementation.md#implementation Implements the documented service entry.\n     *"
         : ""
     } @evidence prisma:Sale Creates the persisted sale model.
     */
    export function createSale(): string {
      return "sale";
    }
  `;
}

function swaggerSource(): string {
  return dedent`
    openapi: 3.1.0
    info:
      title: Sales
      version: 1.0.0
    paths:
      /sales:
        post:
          description: |-
            Creates a sale.
            @evidence docs/api.md#sales-api Exposes the documented sale operation.
          responses:
            "201":
              description: Created
  `;
}

function createPlan(directory: string): IEvidenceConfigPlan {
  return createEvidenceConfigPlan(
    {
      severity: "error",
      claims: [
        {
          name: "implementation",
          type: "typescript",
          files: ["src/sale.ts"],
          symbol: "function",
          reference: [
            {
              type: "markdown",
              files: ["docs/implementation.md"],
              symbol: "h2",
            },
            {
              type: "prisma",
              files: ["prisma/schema.prisma"],
              symbol: "model",
            },
          ],
        },
        {
          name: "tests",
          type: "typescript",
          files: ["test/**/*.ts"],
          symbol: "function",
          reference: {
            type: "typescript",
            files: ["src/**/*.ts"],
            symbol: "function",
          },
        },
        {
          name: "database",
          type: "prisma",
          files: ["prisma/schema.prisma"],
          symbol: "model",
          reference: {
            type: "markdown",
            files: ["docs/persistence.md"],
            symbol: "h2",
          },
        },
        {
          name: "api",
          type: "swagger",
          files: ["openapi.yaml"],
          symbol: "operation",
          reference: {
            type: "markdown",
            files: ["docs/api.md"],
            symbol: "h2",
          },
        },
        {
          name: "guide",
          type: "markdown",
          files: ["docs/guide.md"],
          symbol: "h2",
          reference: {
            type: "swagger",
            file: "openapi.yaml",
            symbol: "operation",
          },
        },
      ],
    },
    join(directory, "evidence.config.ts"),
  );
}

function assertCompleteGraph(
  analysis: IEvidenceCheckAnalysis,
  scenario: string,
): void {
  TestValidator.equals(
    `${scenario} status`,
    analysis.report.status,
    "complete",
  );
  TestValidator.equals(`${scenario} exit`, analysis.report.exitCode, 0);
  TestValidator.equals(
    `${scenario} diagnostics`,
    analysis.report.diagnostics,
    [],
  );
  TestValidator.equals(`${scenario} counts`, analysis.report.counts, {
    claims: 5,
    activeClaims: 5,
    obligations: 6,
    activeObligations: 6,
    incompleteObligations: 0,
    units: 6,
    coveredUnits: 6,
    missingUnits: 0,
    errors: 0,
    warnings: 0,
  });
}

function assertDiagnostic(
  analysis: IEvidenceCheckAnalysis,
  code: string,
  claim: number,
  reference: number,
): void {
  TestValidator.predicate(
    `${code} at ${claim}:${reference}`,
    analysis.report.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === code &&
        diagnostic.claim === claim &&
        diagnostic.reference === reference,
    ),
  );
}

function requireRecord(records: Record<string, string>, name: string): string {
  const content = records[name];
  if (content === undefined) throw new Error(`Missing fixture record: ${name}`);
  return content;
}
