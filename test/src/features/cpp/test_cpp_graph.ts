import {
  EvidCppAdapter,
  EvidFingerprint,
  EvidGraph,
  EvidMarkdownAdapter,
} from "evid";
import type { IEvidInventory, IEvidUnit } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestGraph } from "../../internal/EvidTestGraph";
import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/**
 * Evaluates C++ type, function, and property evidence with semantic
 * fingerprints.
 *
 * Graph success requires reciprocal coverage of the exact C++ unit selection,
 * and evidence text alone cannot alter implementation identity.
 *
 * 1. Construct covered and uncovered claims for each C++ symbol kind.
 * 2. Require the graph to expose the full missing reference population when
 *    evidence is absent.
 * 3. Verify a prose-only evidence change leaves the selected unit fingerprint
 *    stable.
 */
export async function test_cpp_graph(): Promise<void> {
  const requirements = await new EvidMarkdownAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "docs/requirements.md",
      dedent`
        ## Sale {#sale}

        The sale type exists.

        ## Run {#run}

        The operation runs.

        ## Total {#total}

        The sale exposes a total.
      `,
    ),
  );
  const implementation = await new EvidCppAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "src/contracts.cpp",
      dedent`
        /** @evidence docs/requirements.md#sale Implements the sale type. */
        class Sale {
        public:
            /** @evidence docs/requirements.md#total Implements the total. */
            int total;
        };

        /** @evidence docs/requirements.md#run Implements the operation. */
        int run() { return 1; }
      `,
    ),
  );
  const requirementUnits = [
    requireUnit(requirements, "sale"),
    requireUnit(requirements, "run"),
    requireUnit(requirements, "total"),
  ];
  const implementationUnits = [
    requireUnit(implementation, "Sale"),
    requireUnit(implementation, "run"),
    requireUnit(implementation, "total"),
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
  TestValidator.equals("complete C++ graph", complete.success, true);

  // Removing any common symbol kind's acknowledgement exposes its requirement.
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
      `missing C++ ${anchor} acknowledgement`,
      EvidTestGraph.obligation(partial, 0, 0).missingUnitIds,
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
    "C++ evidence metadata preserves fingerprint",
    EvidFingerprint.inspect(original, originalUnit.id).fingerprint,
    EvidFingerprint.inspect(editedReason, reasonUnit.id).fingerprint,
  );
  TestValidator.notEquals(
    "C++ implementation moves fingerprint",
    EvidFingerprint.inspect(original, originalUnit.id).fingerprint,
    EvidFingerprint.inspect(editedBody, bodyUnit.id).fingerprint,
  );

  // Shared declaration text belongs to each object, while initializers stay local.
  const objectsOriginal = await objectInventory("2");
  const objectsEdited = await objectInventory("3");
  const firstOriginal = requireUnit(objectsOriginal, "first");
  const firstEdited = requireUnit(objectsEdited, "first");
  TestValidator.equals(
    "C++ sibling object fingerprint isolation",
    EvidFingerprint.inspect(objectsOriginal, firstOriginal.id).fingerprint,
    EvidFingerprint.inspect(objectsEdited, firstEdited.id).fingerprint,
  );
}

async function fingerprintInventory(
  reason: string,
  statement: string,
): Promise<IEvidInventory> {
  return new EvidCppAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "src/fingerprint.cpp",
      dedent`
        /** @evidence docs/requirements.md#run ${reason} */
        int run() { ${statement} }
      `,
    ),
  );
}

async function objectInventory(second: string): Promise<IEvidInventory> {
  return new EvidCppAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "src/objects.cpp",
      `int first = 1, second = ${second};\n`,
    ),
  );
}

function requireUnit(inventory: IEvidInventory, name: string): IEvidUnit {
  const unit = inventory.units.find(
    (candidate) =>
      candidate.name === name || candidate.identity.at(-1) === name,
  );
  if (unit === undefined) throw new Error(`Missing C++ graph unit: ${name}`);
  return unit;
}
