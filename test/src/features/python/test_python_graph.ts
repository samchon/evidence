import {
  EvidFingerprint,
  EvidGraph,
  EvidMarkdownAdapter,
  EvidPythonAdapter,
} from "evid";
import type { IEvidInventory, IEvidUnit } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestGraph } from "../../internal/EvidTestGraph";
import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/**
 * Evaluates Python evidence hosts against Markdown requirements and
 * fingerprints.
 *
 * A type, function docstring, and property comment acknowledge separate
 * requirements, allowing graph coverage and semantic-change behavior to be
 * checked independently.
 *
 * 1. Analyze the requirement document and Python implementation, then require
 *    complete graph coverage.
 * 2. Remove each acknowledgement in turn and verify the corresponding requirement
 *    is the exact missing obligation.
 * 3. Compare function fingerprints after metadata-only and implementation-body
 *    edits, preserving the former and changing the latter.
 */
export async function test_python_graph(): Promise<void> {
  const requirements = await new EvidMarkdownAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "docs/requirements.md",
      dedent`
        ## Service {#service}

        The service is public.

        ## Run {#run}

        The operation runs.

        ## Value {#value}

        The value is public.
      `,
    ),
  );
  const implementation = await new EvidPythonAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "src/contracts.py",
      dedent`
        # @evidence docs/requirements.md#service Implements the public type.
        class Service:
            pass

        def run():
            """@evidence docs/requirements.md#run Implements the operation."""
            return 1

        # @evidence docs/requirements.md#value Implements the public value.
        value = 1
      `,
    ),
  );
  const requirementUnits = [
    requireUnit(requirements, "service"),
    requireUnit(requirements, "run"),
    requireUnit(requirements, "value"),
  ];
  const implementationUnits = [
    requireUnit(implementation, "Service"),
    requireUnit(implementation, "run"),
    requireUnit(implementation, "value"),
  ];

  const complete = EvidGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: implementation,
        unitIds: implementationUnits.map((unit) => unit.id),
        references: [
          {
            severity: "error",
            inventory: requirements,
            unitIds: requirementUnits.map((unit) => unit.id),
            resolutions: await EvidTestGraph.resolveDeclarations(
              implementation,
              requirements,
              requirementUnits.map((unit) => unit.id),
            ),
          },
        ],
      },
    ],
  });
  TestValidator.equals("complete Python graph", complete.success, true);

  // Removing any symbol kind's acknowledgement exposes that exact requirement.
  for (const required of requirementUnits) {
    const anchor = required.identity.at(-1) ?? required.name;
    const missing = structuredClone(implementation);
    missing.declarations = missing.declarations.filter(
      (declaration) => !declaration.target.endsWith(`#${anchor}`),
    );
    const partial = EvidGraph.evaluate({
      claims: [
        {
          severity: "error",
          inventory: missing,
          unitIds: implementationUnits.map((unit) => unit.id),
          references: [
            {
              severity: "error",
              inventory: requirements,
              unitIds: requirementUnits.map((unit) => unit.id),
              resolutions: await EvidTestGraph.resolveDeclarations(
                missing,
                requirements,
                requirementUnits.map((unit) => unit.id),
              ),
            },
          ],
        },
      ],
    });
    TestValidator.equals(
      `missing Python ${anchor} acknowledgement`,
      EvidTestGraph.obligation(partial, 0, 0).missingUnitIds,
      [required.id],
    );
  }

  const original = await fingerprintInventory(
    "Implements the rule.",
    "return 1",
  );
  const editedReason = await fingerprintInventory(
    "Explains the same implementation differently.",
    "return 1",
  );
  const editedBody = await fingerprintInventory(
    "Implements the rule.",
    "return 2",
  );
  const originalUnit = requireUnit(original, "run");
  const reasonUnit = requireUnit(editedReason, "run");
  const bodyUnit = requireUnit(editedBody, "run");

  TestValidator.equals(
    "Python evidence metadata preserves fingerprint",
    EvidFingerprint.inspect(original, originalUnit.id).fingerprint,
    EvidFingerprint.inspect(editedReason, reasonUnit.id).fingerprint,
  );
  TestValidator.notEquals(
    "Python implementation moves fingerprint",
    EvidFingerprint.inspect(original, originalUnit.id).fingerprint,
    EvidFingerprint.inspect(editedBody, bodyUnit.id).fingerprint,
  );
}

async function fingerprintInventory(
  reason: string,
  statement: string,
): Promise<IEvidInventory> {
  return new EvidPythonAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "src/fingerprint.py",
      dedent`
        def run():
            """@evidence docs/requirements.md#run ${reason}"""
            ${statement}
      `,
    ),
  );
}

function requireUnit(inventory: IEvidInventory, name: string): IEvidUnit {
  const unit = inventory.units.find(
    (candidate) =>
      candidate.name === name || candidate.identity.at(-1) === name,
  );
  if (unit === undefined) throw new Error(`Missing Python graph unit: ${name}`);
  return unit;
}
