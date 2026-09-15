import {
  EvidenceFingerprint,
  EvidenceGraph,
  EvidenceJavaAdapter,
  EvidenceMarkdownAdapter,
} from "@wrtnlabs/evidence";
import type { IEvidenceInventory, IEvidenceUnit } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestGraph } from "../../internal/EvidenceTestGraph";
import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Evaluates Java type, function, and property evidence with semantic
 * fingerprints.
 *
 * Graph obligations remain exact across symbol kinds and prose cannot alter
 * code identity.
 *
 * 1. Evaluate covered claims.
 * 2. Evaluate missing claims and compare IDs.
 * 3. Verify annotation-only fingerprint stability.
 */
export async function test_java_graph(): Promise<void> {
  const requirements = await new EvidenceMarkdownAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
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
  const implementation = await new EvidenceJavaAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "src/Contracts.java",
      dedent`
        /** @evidence docs/requirements.md#service Implements the public type. */
        public class Contracts {
            /** @evidence docs/requirements.md#run Implements the operation. */
            public void run() {}

            /** @evidence docs/requirements.md#value Implements the public value. */
            public int value;
        }
      `,
    ),
  );
  const requirementUnits = [
    requireUnit(requirements, "service"),
    requireUnit(requirements, "run"),
    requireUnit(requirements, "value"),
  ];
  const implementationUnits = [
    requireUnit(implementation, "Contracts"),
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
  TestValidator.equals("complete Java graph", complete.success, true);

  // Removing any common symbol kind's acknowledgement exposes that requirement.
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
      `missing Java ${anchor} acknowledgement`,
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
    "Java evidence metadata preserves fingerprint",
    EvidenceFingerprint.inspect(original, originalUnit.id).fingerprint,
    EvidenceFingerprint.inspect(editedReason, reasonUnit.id).fingerprint,
  );
  TestValidator.notEquals(
    "Java implementation moves fingerprint",
    EvidenceFingerprint.inspect(original, originalUnit.id).fingerprint,
    EvidenceFingerprint.inspect(editedBody, bodyUnit.id).fingerprint,
  );

  // One overload family combines every declaration site into one fingerprint.
  const overloadOriginal = await overloadInventory("return value;");
  const overloadEdited = await overloadInventory("return value + 1;");
  const overloadOriginalUnit = requireUnit(overloadOriginal, "calculate");
  const overloadEditedUnit = requireUnit(overloadEdited, "calculate");
  TestValidator.equals(
    "Java overload fingerprint sites",
    overloadOriginalUnit.sites.length,
    2,
  );
  TestValidator.notEquals(
    "Java overload implementation moves family fingerprint",
    EvidenceFingerprint.inspect(overloadOriginal, overloadOriginalUnit.id)
      .fingerprint,
    EvidenceFingerprint.inspect(overloadEdited, overloadEditedUnit.id).fingerprint,
  );

  // A sibling variable has its own source content range within a shared declaration.
  const fieldsOriginal = await fieldInventory("2");
  const fieldsEdited = await fieldInventory("3");
  const firstOriginal = requireUnit(fieldsOriginal, "first");
  const firstEdited = requireUnit(fieldsEdited, "first");
  TestValidator.equals(
    "Java sibling field fingerprint isolation",
    EvidenceFingerprint.inspect(fieldsOriginal, firstOriginal.id).fingerprint,
    EvidenceFingerprint.inspect(fieldsEdited, firstEdited.id).fingerprint,
  );
}

async function fingerprintInventory(
  reason: string,
  statement: string,
): Promise<IEvidenceInventory> {
  return new EvidenceJavaAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "src/Fingerprint.java",
      dedent`
        public class Fingerprint {
            /** @evidence ../docs/requirements.md#run ${reason} */
            public int run() {
                ${statement}
            }
        }
      `,
    ),
  );
}

async function overloadInventory(statement: string): Promise<IEvidenceInventory> {
  return new EvidenceJavaAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "src/Calculator.java",
      dedent`
        public class Calculator {
            public int calculate() { return 0; }
            public int calculate(int value) { ${statement} }
        }
      `,
    ),
  );
}

async function fieldInventory(second: string): Promise<IEvidenceInventory> {
  return new EvidenceJavaAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "src/Fields.java",
      dedent`
        public class Fields {
            public int first = 1, second = ${second};
        }
      `,
    ),
  );
}

function requireUnit(inventory: IEvidenceInventory, name: string): IEvidenceUnit {
  const unit = inventory.units.find(
    (candidate) =>
      candidate.name === name || candidate.identity.at(-1) === name,
  );
  if (unit === undefined) throw new Error(`Missing Java graph unit: ${name}`);
  return unit;
}
