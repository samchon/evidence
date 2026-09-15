import {
  EvidenceCAdapter,
  EvidenceFingerprint,
  EvidenceGraph,
  EvidenceMarkdownAdapter,
} from "@wrtnlabs/evidence";
import type { IEvidenceInventory, IEvidenceUnit } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestGraph } from "../../internal/EvidenceTestGraph";
import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Evaluates C type, function, and property evidence with semantic fingerprints.
 *
 * Every selected C symbol kind must have reciprocal acknowledgement, while
 * documentation-only edits must not change implementation identity.
 *
 * 1. Build claim and reference inventories for each supported C symbol kind.
 * 2. Require covered declarations to pass and missing declarations to remain
 *    obligations.
 * 3. Compare fingerprints before and after an evidence-prose-only edit.
 */
export async function test_c_graph(): Promise<void> {
  const requirements = await new EvidenceMarkdownAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "docs/requirements.md",
      dedent`
        ## Record {#record}

        The record is declared.

        ## Run {#run}

        The operation runs.

        ## Value {#value}

        The value is declared.
      `,
    ),
  );
  const implementation = await new EvidenceCAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "src/contracts.c",
      dedent`
        /** @evidence docs/requirements.md#record Implements the record. */
        struct Record {
            /** @evidence docs/requirements.md#value Implements the value. */
            int value;
        };

        /** @evidence docs/requirements.md#run Implements the operation. */
        int run(void) { return 1; }
      `,
    ),
  );
  const requirementUnits = [
    requireUnit(requirements, "record"),
    requireUnit(requirements, "run"),
    requireUnit(requirements, "value"),
  ];
  const implementationUnits = [
    requireUnit(implementation, "Record"),
    requireUnit(implementation, "run"),
    requireUnit(implementation, "value"),
  ];

  const complete = EvidenceGraph.evaluate({
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
            resolutions: await EvidenceTestGraph.resolveDeclarations(
              implementation,
              requirements,
              requirementUnits.map((unit) => unit.id),
            ),
          },
        ],
      },
    ],
  });
  TestValidator.equals("complete C graph", complete.success, true);

  // Removing any common symbol kind's acknowledgement exposes its requirement.
  for (const required of requirementUnits) {
    const anchor = required.identity.at(-1) ?? required.name;
    const missing = structuredClone(implementation);
    missing.declarations = missing.declarations.filter(
      (declaration) => !declaration.target.endsWith(`#${anchor}`),
    );
    const partial = EvidenceGraph.evaluate({
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
              resolutions: await EvidenceTestGraph.resolveDeclarations(
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
      `missing C ${anchor} acknowledgement`,
      EvidenceTestGraph.obligation(partial, 0, 0).missingUnitIds,
      [required.id],
    );
  }

  const original = await fingerprintInventory(
    "Implements the rule.",
    "return 1;",
  );
  const editedReason = await fingerprintInventory(
    "Explains the same implementation differently.",
    "return 1;",
  );
  const editedBody = await fingerprintInventory(
    "Implements the rule.",
    "return 2;",
  );
  const originalUnit = requireUnit(original, "run");
  const reasonUnit = requireUnit(editedReason, "run");
  const bodyUnit = requireUnit(editedBody, "run");
  TestValidator.equals(
    "C evidence metadata preserves fingerprint",
    EvidenceFingerprint.inspect(original, originalUnit.id).fingerprint,
    EvidenceFingerprint.inspect(editedReason, reasonUnit.id).fingerprint,
  );
  TestValidator.notEquals(
    "C implementation moves fingerprint",
    EvidenceFingerprint.inspect(original, originalUnit.id).fingerprint,
    EvidenceFingerprint.inspect(editedBody, bodyUnit.id).fingerprint,
  );

  // Shared type text belongs to each object, while sibling initializers stay local.
  const objectsOriginal = await objectInventory("2");
  const objectsEdited = await objectInventory("3");
  const firstOriginal = requireUnit(objectsOriginal, "first");
  const firstEdited = requireUnit(objectsEdited, "first");
  TestValidator.equals(
    "C sibling object fingerprint isolation",
    EvidenceFingerprint.inspect(objectsOriginal, firstOriginal.id).fingerprint,
    EvidenceFingerprint.inspect(objectsEdited, firstEdited.id).fingerprint,
  );
}

async function fingerprintInventory(
  reason: string,
  statement: string,
): Promise<IEvidenceInventory> {
  return new EvidenceCAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "src/fingerprint.c",
      dedent`
        /** @evidence docs/requirements.md#run ${reason} */
        int run(void) { ${statement} }
      `,
    ),
  );
}

async function objectInventory(second: string): Promise<IEvidenceInventory> {
  return new EvidenceCAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "src/objects.c",
      dedent`
        int first = 1, second = ${second};
      `,
    ),
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
  if (unit === undefined) throw new Error(`Missing C graph unit: ${name}`);
  return unit;
}
