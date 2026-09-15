import {
  EvidenceGraph,
  EvidenceMarkdownAdapter,
  EvidenceTargetResolver,
  EvidenceTypeScriptAdapter,
} from "@wrtnlabs/evidence";
import type {
  IEvidenceDeclaration,
  IEvidenceHost,
  IEvidenceInventory,
  IEvidenceUnit,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestGraph } from "../../internal/EvidenceTestGraph";
import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Evaluates a requirement-to-implementation-to-test chain through real
 * adapters.
 *
 * Each link is an independent configured claim/reference pair. Evidence from
 * the test to the implementation cannot substitute for the implementation's
 * citation to a requirement, and breaking one link must not erase the other
 * link's coverage.
 *
 * 1. Extract a Markdown rounding requirement, a TypeScript method citing it, and a
 *    TypeScript test citing that method; resolve both authored targets.
 * 2. Evaluate both claim/reference pairs and require success with no diagnostics.
 * 3. Remove only the implementation acknowledgement and require the requirement to
 *    become missing while the test-to-implementation obligation remains
 *    covered.
 * 4. Restore the implementation citation and remove only the test acknowledgement;
 *    require implementation-to-requirement coverage to remain and the test's
 *    reference obligation to report the method as missing.
 */
export async function test_graph_chain(): Promise<void> {
  const requirements = await new EvidenceMarkdownAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "docs/requirements.md",
      dedent`
        # Pricing

        ## Rounding {#rounding}

        Addends are summed without intermediate rounding.
      `,
    ),
  );
  const implementation = await new EvidenceTypeScriptAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
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
    EvidenceTestSourceSnapshot.create(
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
    EvidenceTestGraph.obligation(missingRequirement, 0, 0).missingUnitIds,
    [requirementUnit.id],
  );
  TestValidator.equals(
    "test obligation remains covered",
    EvidenceTestGraph.obligation(missingRequirement, 1, 0).missingUnitIds,
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
    EvidenceTestGraph.obligation(missingTest, 0, 0).missingUnitIds,
    [],
  );
  TestValidator.equals(
    "test becomes missing",
    EvidenceTestGraph.obligation(missingTest, 1, 0).missingUnitIds,
    [implementationUnit.id],
  );
}

/**
 * Locates an independently named fixture unit before building graph inputs.
 *
 * Markdown explicit IDs can appear as the final identity segment, while code
 * fixtures use declaration names. Missing extraction fails setup immediately.
 */
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

/**
 * Requires the fixture's authored acknowledgement to survive adapter
 * extraction.
 *
 * The scenario has one citation per citing inventory; absence must fail setup
 * instead of constructing an accidentally empty resolution list.
 */
function requireDeclaration(
  inventory: IEvidenceInventory,
): IEvidenceDeclaration {
  const declaration = inventory.declarations[0];
  if (declaration === undefined)
    throw new Error("Missing graph declaration fixture.");
  return declaration;
}

/**
 * Finds the extracted carrier that owns a fixture acknowledgement.
 *
 * Resolution needs that carrier's source origin, so a missing host is a setup
 * failure rather than a reason to invent a command-relative location.
 */
function requireHost(inventory: IEvidenceInventory, id: string): IEvidenceHost {
  const host = inventory.hosts.find((candidate) => candidate.id === id);
  if (host === undefined) throw new Error(`Missing graph host: ${id}`);
  return host;
}
