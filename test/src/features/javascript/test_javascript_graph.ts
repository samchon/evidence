import {
  EvidFingerprint,
  EvidGraph,
  EvidJavaScriptAdapter,
  EvidMarkdownAdapter,
} from "evid";
import type { IEvidInventory, IEvidUnit } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestGraph } from "../../internal/EvidTestGraph";
import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/**
 * Evaluates JavaScript type, function, and property coverage and fingerprints.
 *
 * Exact host selection governs graph obligations while evidence prose remains
 * outside implementation scope.
 *
 * 1. Evaluate each symbol kind with and without acknowledgement.
 * 2. Compare missing IDs.
 * 3. Verify source-scope fingerprints.
 */
export async function test_javascript_graph(): Promise<void> {
  const requirements = await new EvidMarkdownAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "docs/requirements.md",
      dedent`
        ## Service {#service}

        The service is public.

        ## Run {#run}

        The operation runs.

        ## Value {#value}

        The value is exported.
      `,
    ),
  );
  const implementation = await new EvidJavaScriptAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "src/contracts.mjs",
      dedent`
        /** @evidence docs/requirements.md#service Implements the public type. */
        export class Service {}

        /** @evidence docs/requirements.md#run Implements the operation. */
        export function run() { return 1; }

        /** @evidence docs/requirements.md#value Implements the exported value. */
        export const value = 1;
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
  const resolutions = await EvidTestGraph.resolveDeclarations(
    implementation,
    requirements,
    requirementUnits.map((unit) => unit.id),
  );

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
            resolutions,
          },
        ],
      },
    ],
  });
  TestValidator.equals("complete JavaScript graph", complete.success, true);

  // Removing each symbol kind's acknowledgement exposes its exact requirement.
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
      `missing ${anchor} acknowledgement`,
      EvidTestGraph.obligation(partial, 0, 0).missingUnitIds,
      [required.id],
    );
  }

  const original = await fingerprintInventory(
    "Returns the value.",
    "return 1;",
  );
  const editedReason = await fingerprintInventory(
    "Explains the same implementation differently.",
    "return 1;",
  );
  const editedBody = await fingerprintInventory(
    "Returns the value.",
    "return 2;",
  );
  const originalUnit = requireUnit(original, "run");
  const reasonUnit = requireUnit(editedReason, "run");
  const bodyUnit = requireUnit(editedBody, "run");

  TestValidator.equals(
    "evidence metadata preserves fingerprint",
    EvidFingerprint.inspect(original, originalUnit.id).fingerprint,
    EvidFingerprint.inspect(editedReason, reasonUnit.id).fingerprint,
  );
  TestValidator.notEquals(
    "implementation change moves fingerprint",
    EvidFingerprint.inspect(original, originalUnit.id).fingerprint,
    EvidFingerprint.inspect(editedBody, bodyUnit.id).fingerprint,
  );
}

async function fingerprintInventory(
  reason: string,
  statement: string,
): Promise<IEvidInventory> {
  return new EvidJavaScriptAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "src/fingerprint.mjs",
      dedent`
        /** @evidence docs/requirements.md#run ${reason} */
        export function run() { ${statement} }
      `,
    ),
  );
}

function requireUnit(inventory: IEvidInventory, name: string): IEvidUnit {
  const unit = inventory.units.find(
    (candidate) =>
      candidate.name === name || candidate.identity.at(-1) === name,
  );
  if (unit === undefined)
    throw new Error(`Missing JavaScript graph unit: ${name}`);
  return unit;
}
