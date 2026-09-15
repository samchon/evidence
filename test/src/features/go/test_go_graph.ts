import {
  EvidFingerprint,
  EvidGoAdapter,
  EvidGraph,
  EvidMarkdownAdapter,
} from "evid";
import type { IEvidInventory, IEvidUnit } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestGraph } from "../../internal/TestGraph";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Evaluates Go type, function, and property evidence with semantic fingerprints.
 *
 * Reciprocal coverage uses the exact selected units and evidence prose does not change implementation identity.
 *
 * 1. Build covered and uncovered claims by symbol.
 * 2. Compare missing IDs.
 * 3. Verify a prose-only edit preserves fingerprints.
 */
export async function test_go_graph(): Promise<void> {
  const requirements = await new EvidMarkdownAdapter().analyze(
    TestSourceSnapshot.create(
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
  const implementation = await new EvidGoAdapter().analyze(
    TestSourceSnapshot.create(
      "src/contracts.go",
      dedent`
        package contracts

        // @evid docs/requirements.md#service Implements the public type.
        type Service struct{}

        // @evid docs/requirements.md#run Implements the operation.
        func Run() {}

        // @evid docs/requirements.md#value Implements the public value.
        var Value = 1
      ` + "\n",
    ),
  );
  const requirementUnits = [
    requireUnit(requirements, "service"),
    requireUnit(requirements, "run"),
    requireUnit(requirements, "value"),
  ];
  const implementationUnits = [
    requireUnit(implementation, "Service"),
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
            resolutions: await TestGraph.resolveDeclarations(
              implementation,
              requirements,
              requirementUnits.map((unit) => unit.id),
            ),
          },
        ],
      },
    ],
  });
  TestValidator.equals("complete Go graph", complete.success, true);

  // Removing any common symbol kind's acknowledgement exposes that requirement.
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
              resolutions: await TestGraph.resolveDeclarations(
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
      `missing Go ${anchor} acknowledgement`,
      TestGraph.obligation(partial, 0, 0).missingUnitIds,
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
  const originalUnit = requireUnit(original, "Run");
  const reasonUnit = requireUnit(editedReason, "Run");
  const bodyUnit = requireUnit(editedBody, "Run");

  TestValidator.equals(
    "Go evidence metadata preserves fingerprint",
    EvidFingerprint.inspect(original, originalUnit.id).fingerprint,
    EvidFingerprint.inspect(editedReason, reasonUnit.id).fingerprint,
  );
  TestValidator.notEquals(
    "Go implementation moves fingerprint",
    EvidFingerprint.inspect(original, originalUnit.id).fingerprint,
    EvidFingerprint.inspect(editedBody, bodyUnit.id).fingerprint,
  );

  // A sibling specification in one declaration group has its own fingerprint.
  const groupedOriginal = await groupedInventory(1);
  const groupedEdited = await groupedInventory(2);
  const firstOriginal = requireUnit(groupedOriginal, "First");
  const firstEdited = requireUnit(groupedEdited, "First");
  TestValidator.equals(
    "Go grouped declaration fingerprint isolation",
    EvidFingerprint.inspect(groupedOriginal, firstOriginal.id).fingerprint,
    EvidFingerprint.inspect(groupedEdited, firstEdited.id).fingerprint,
  );
}

async function fingerprintInventory(
  reason: string,
  statement: string,
): Promise<IEvidInventory> {
  return new EvidGoAdapter().analyze(
    TestSourceSnapshot.create(
      "src/fingerprint.go",
      dedent`
        package contracts

        // @evid docs/requirements.md#run ${reason}
        func Run() int {
            ${statement}
        }
      `,
    ),
  );
}

async function groupedInventory(second: number): Promise<IEvidInventory> {
  return new EvidGoAdapter().analyze(
    TestSourceSnapshot.create(
      "src/grouped.go",
      dedent`
        package contracts

        const (
            First = 1
            Second = ${second}
        )
      ` + "\n",
    ),
  );
}

function requireUnit(
  inventory: IEvidInventory,
  name: string,
): IEvidUnit {
  const unit = inventory.units.find(
    (candidate) =>
      candidate.name === name || candidate.identity.at(-1) === name,
  );
  if (unit === undefined) throw new Error(`Missing Go graph unit: ${name}`);
  return unit;
}
