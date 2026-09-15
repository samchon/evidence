import {
  EvidCSharpAdapter,
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
 * Evaluates C# type, function, and property evidence and fingerprints.
 *
 * Each symbol kind must cover its requirement, and changing prose alone must
 * not invalidate the implementation fingerprint.
 *
 * 1. Build C# claim and reference inventories for every supported symbol kind.
 * 2. Require covered graphs to pass and missing evidence to retain the exact
 *    reference units.
 * 3. Edit evidence prose without changing code and require the implementation
 *    fingerprint to remain stable.
 */
export async function test_csharp_graph(): Promise<void> {
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
  const implementation = await new EvidCSharpAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "src/Contracts.cs",
      dedent`
        /// @evidence docs/requirements.md#service Implements the public type.
        public partial class Contracts
        {
            /// @evidence docs/requirements.md#run Implements the operation.
            public void Run() { }
        }

        partial class Contracts
        {
            /// @evidence docs/requirements.md#value Implements the public value.
            public int Value { get; set; }
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
    requireUnit(implementation, "Run"),
    requireUnit(implementation, "Value"),
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
  TestValidator.equals("complete C# graph", complete.success, true);

  // Removing any supported symbol kind's acknowledgement exposes its requirement.
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
      `missing C# ${anchor} acknowledgement`,
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
  const originalUnit = requireUnit(original, "Run");
  const reasonUnit = requireUnit(editedReason, "Run");
  const bodyUnit = requireUnit(editedBody, "Run");

  TestValidator.equals(
    "C# evidence metadata preserves fingerprint",
    EvidFingerprint.inspect(original, originalUnit.id).fingerprint,
    EvidFingerprint.inspect(editedReason, reasonUnit.id).fingerprint,
  );
  TestValidator.notEquals(
    "C# implementation moves fingerprint",
    EvidFingerprint.inspect(original, originalUnit.id).fingerprint,
    EvidFingerprint.inspect(editedBody, bodyUnit.id).fingerprint,
  );
}

async function fingerprintInventory(
  reason: string,
  statement: string,
): Promise<IEvidInventory> {
  return new EvidCSharpAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "src/Fingerprint.cs",
      dedent`
        public class Fingerprint
        {
            /// @evidence ../docs/requirements.md#run ${reason}
            public int Run()
            {
                ${statement}
            }
        }
      `,
    ),
  );
}

function requireUnit(inventory: IEvidInventory, name: string): IEvidUnit {
  const unit = inventory.units.find(
    (candidate) =>
      candidate.name === name || candidate.identity.at(-1) === name,
  );
  if (unit === undefined) throw new Error(`Missing C# graph unit: ${name}`);
  return unit;
}
