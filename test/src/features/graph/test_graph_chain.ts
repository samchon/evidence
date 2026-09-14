import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceGraph } from "../../../../packages/evidence/src/graph/EvidenceGraph";
import { EvidenceMarkdownAdapter } from "../../../../packages/evidence/src/adapters/markdown/EvidenceMarkdownAdapter";
import { EvidenceTargetResolver } from "../../../../packages/evidence/src/targets/EvidenceTargetResolver";
import { EvidenceTypeScriptAdapter } from "../../../../packages/evidence/src/adapters/typescript/EvidenceTypeScriptAdapter";
import type { IEvidenceDeclaration } from "../../../../packages/evidence/src/structures/IEvidenceDeclaration";
import type { IEvidenceHost } from "../../../../packages/evidence/src/structures/IEvidenceHost";
import type { IEvidenceInventory } from "../../../../packages/evidence/src/structures/IEvidenceInventory";
import type { IEvidenceUnit } from "../../../../packages/evidence/src/structures/IEvidenceUnit";
import { TestGraph } from "../../internal/TestGraph";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Checks an actual Markdown requirement through TypeScript implementation and test obligations. */
export async function test_graph_chain(): Promise<void> {
  const requirements = await new EvidenceMarkdownAdapter().analyze(
    TestSourceSnapshot.create(
      "docs/requirements.md",
      dedent`
        # Pricing

        ## Rounding {#rounding}

        Addends are summed without intermediate rounding.
      `,
    ),
  );
  const implementation = await new EvidenceTypeScriptAdapter().analyze(
    TestSourceSnapshot.create(
      "src/calculator.ts",
      dedent`
        export class Calculator {
          /** @evidence docs/requirements.md#rounding Implements exact addition. */
          public add(x: number, y: number): number {
            return x + y;
          }
        }
      `,
    ),
  );
  const tests = await new EvidenceTypeScriptAdapter().analyze(
    TestSourceSnapshot.create(
      "src/calculator.test.ts",
      dedent`
        /** @evidence ./calculator.ts#Calculator.prototype.add Verifies exact addition. */
        export function test_add(): void {
          if (1 + 2 !== 3) throw new Error("Unexpected sum.");
        }
      `,
    ),
  );

  const requirementUnit = requireUnit(requirements, "rounding");
  const implementationUnit = requireUnit(implementation, "add");
  const testUnit = requireUnit(tests, "test_add");
  const implementationDeclaration = requireDeclaration(implementation);
  const testDeclaration = requireDeclaration(tests);

  const requirementResolution = await new EvidenceTargetResolver([
    requirements,
  ]).resolve(
    implementationDeclaration,
    requireHost(implementation, implementationDeclaration.hostId),
    [requirementUnit.id],
  );
  const implementationResolution = await new EvidenceTargetResolver([
    implementation,
  ]).resolve(testDeclaration, requireHost(tests, testDeclaration.hostId), [
    implementationUnit.id,
  ]);

  // Both configured claims must independently acknowledge the unit selected by their reference.
  const complete = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: implementation,
        unitIds: [implementationUnit.id],
        references: [
          {
            severity: "error",
            inventory: requirements,
            unitIds: [requirementUnit.id],
            resolutions: [
              {
                declarationId: implementationDeclaration.id,
                resolution: requirementResolution,
              },
            ],
          },
        ],
      },
      {
        severity: "error",
        inventory: tests,
        unitIds: [testUnit.id],
        references: [
          {
            severity: "error",
            inventory: implementation,
            unitIds: [implementationUnit.id],
            resolutions: [
              {
                declarationId: testDeclaration.id,
                resolution: implementationResolution,
              },
            ],
          },
        ],
      },
    ],
  });

  TestValidator.equals("complete chain", complete.success, true);
  TestValidator.equals("complete chain findings", complete.diagnostics, []);

  // Removing the implementation citation breaks only the requirement obligation.
  const uncitedImplementation = structuredClone(implementation);
  uncitedImplementation.declarations = [];
  const missingRequirement = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: uncitedImplementation,
        unitIds: [implementationUnit.id],
        references: [
          {
            severity: "error",
            inventory: requirements,
            unitIds: [requirementUnit.id],
            resolutions: [],
          },
        ],
      },
      {
        severity: "error",
        inventory: tests,
        unitIds: [testUnit.id],
        references: [
          {
            severity: "error",
            inventory: implementation,
            unitIds: [implementationUnit.id],
            resolutions: [
              {
                declarationId: testDeclaration.id,
                resolution: implementationResolution,
              },
            ],
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "requirement becomes missing",
    TestGraph.obligation(missingRequirement, 0, 0).missingUnitIds,
    [requirementUnit.id],
  );
  TestValidator.equals(
    "test obligation remains covered",
    TestGraph.obligation(missingRequirement, 1, 0).missingUnitIds,
    [],
  );

  // Removing the test citation preserves implementation coverage and breaks only its own obligation.
  const uncitedTests = structuredClone(tests);
  uncitedTests.declarations = [];
  const missingTest = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: implementation,
        unitIds: [implementationUnit.id],
        references: [
          {
            severity: "error",
            inventory: requirements,
            unitIds: [requirementUnit.id],
            resolutions: [
              {
                declarationId: implementationDeclaration.id,
                resolution: requirementResolution,
              },
            ],
          },
        ],
      },
      {
        severity: "error",
        inventory: uncitedTests,
        unitIds: [testUnit.id],
        references: [
          {
            severity: "error",
            inventory: implementation,
            unitIds: [implementationUnit.id],
            resolutions: [],
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "implementation obligation remains covered",
    TestGraph.obligation(missingTest, 0, 0).missingUnitIds,
    [],
  );
  TestValidator.equals(
    "test becomes missing",
    TestGraph.obligation(missingTest, 1, 0).missingUnitIds,
    [implementationUnit.id],
  );
}

function requireUnit(
  inventory: IEvidenceInventory,
  name: string,
): IEvidenceUnit {
  const unit = inventory.units.find(
    (candidate) =>
      candidate.name === name || candidate.identity.at(-1) === name,
  );
  if (unit === undefined) throw new Error(`Missing graph unit: ${name}`);
  return unit;
}

function requireDeclaration(
  inventory: IEvidenceInventory,
): IEvidenceDeclaration {
  const declaration = inventory.declarations[0];
  if (declaration === undefined)
    throw new Error("Missing graph declaration fixture.");
  return declaration;
}

function requireHost(inventory: IEvidenceInventory, id: string): IEvidenceHost {
  const host = inventory.hosts.find((candidate) => candidate.id === id);
  if (host === undefined) throw new Error(`Missing graph host: ${id}`);
  return host;
}
