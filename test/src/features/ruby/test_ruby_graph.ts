import {
  EvidFingerprint,
  EvidGraph,
  EvidMarkdownAdapter,
  EvidRubyAdapter,
} from "evid";
import type { IEvidInventory, IEvidUnit } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestGraph } from "../../internal/TestGraph";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Evaluates Ruby type, function, and property evidence.
 *
 * Each selected host has independent coverage and semantic fingerprint behavior.
 *
 * 1. Link Ruby type, singleton method, and constant evidence to Markdown requirements.
 * 2. Remove each acknowledgement in turn and require the matching requirement to
 *    become the sole missing obligation.
 * 3. Compare fingerprints after evidence-text and implementation-body edits.
 */
export async function test_ruby_graph(): Promise<void> {
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
  const implementation = await new EvidRubyAdapter().analyze(
    TestSourceSnapshot.create(
      "lib/contracts.rb",
      dedent`
        module Contracts
          # @evid docs/requirements.md#service Implements the public type.
          class Service; end

          # @evid docs/requirements.md#run Implements the operation.
          def self.run; 1; end

          # @evid docs/requirements.md#value Implements the public value.
          VALUE = 1
        end
      `,
    ),
  );
  const requirementUnits = [
    requireUnit(requirements, "service"),
    requireUnit(requirements, "run"),
    requireUnit(requirements, "value"),
  ];
  const implementationUnits = [
    requireUnit(implementation, "Contracts.Service"),
    requireUnit(implementation, "Contracts.self.run"),
    requireUnit(implementation, "Contracts.VALUE"),
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
  TestValidator.equals("complete Ruby graph", complete.success, true);

  // Removing any common kind's acknowledgement exposes that exact requirement.
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
      `missing Ruby ${anchor} acknowledgement`,
      TestGraph.obligation(partial, 0, 0).missingUnitIds,
      [required.id],
    );
  }

  const original = await fingerprintInventory("Implements the rule.", "1");
  const editedReason = await fingerprintInventory(
    "Explains the same implementation differently.",
    "1",
  );
  const editedBody = await fingerprintInventory("Implements the rule.", "2");
  const originalUnit = requireUnit(original, "Runner.run");
  const reasonUnit = requireUnit(editedReason, "Runner.run");
  const bodyUnit = requireUnit(editedBody, "Runner.run");

  TestValidator.equals(
    "Ruby evidence metadata preserves fingerprint",
    EvidFingerprint.inspect(original, originalUnit.id).fingerprint,
    EvidFingerprint.inspect(editedReason, reasonUnit.id).fingerprint,
  );
  TestValidator.notEquals(
    "Ruby implementation moves fingerprint",
    EvidFingerprint.inspect(original, originalUnit.id).fingerprint,
    EvidFingerprint.inspect(editedBody, bodyUnit.id).fingerprint,
  );
}

async function fingerprintInventory(
  reason: string,
  statement: string,
): Promise<IEvidInventory> {
  return new EvidRubyAdapter().analyze(
    TestSourceSnapshot.create(
      "lib/fingerprint.rb",
      dedent`
        class Runner
          # @evid docs/requirements.md#run ${reason}
          def run
            ${statement}
          end
        end
      `,
    ),
  );
}

function requireUnit(
  inventory: IEvidInventory,
  identity: string,
): IEvidUnit {
  const unit = inventory.units.find(
    (candidate) => candidate.identity.join(".") === identity,
  );
  if (unit === undefined)
    throw new Error(`Missing Ruby graph unit: ${identity}`);
  return unit;
}
