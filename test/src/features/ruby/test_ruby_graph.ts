import {
  EvidenceFingerprint,
  EvidenceGraph,
  EvidenceMarkdownAdapter,
  EvidenceRubyAdapter,
} from "evidence";
import type { IEvidenceInventory, IEvidenceUnit } from "evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestGraph } from "../../internal/EvidenceTestGraph";
import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Evaluates Ruby type, function, and property evidence.
 *
 * Each selected host has independent coverage and semantic fingerprint
 * behavior.
 *
 * 1. Link Ruby type, singleton method, and constant evidence to Markdown
 *    requirements.
 * 2. Remove each acknowledgement in turn and require the matching requirement to
 *    become the sole missing obligation.
 * 3. Compare fingerprints after evidence-text and implementation-body edits.
 */
export async function test_ruby_graph(): Promise<void> {
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
  const implementation = await new EvidenceRubyAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "lib/contracts.rb",
      dedent`
        module Contracts
          # @evidence docs/requirements.md#service Implements the public type.
          class Service; end

          # @evidence docs/requirements.md#run Implements the operation.
          def self.run; 1; end

          # @evidence docs/requirements.md#value Implements the public value.
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
  TestValidator.equals("complete Ruby graph", complete.success, true);

  // Removing any common kind's acknowledgement exposes that exact requirement.
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
      `missing Ruby ${anchor} acknowledgement`,
      EvidenceTestGraph.obligation(partial, 0, 0).missingUnitIds,
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
    EvidenceFingerprint.inspect(original, originalUnit.id).fingerprint,
    EvidenceFingerprint.inspect(editedReason, reasonUnit.id).fingerprint,
  );
  TestValidator.notEquals(
    "Ruby implementation moves fingerprint",
    EvidenceFingerprint.inspect(original, originalUnit.id).fingerprint,
    EvidenceFingerprint.inspect(editedBody, bodyUnit.id).fingerprint,
  );
}

async function fingerprintInventory(
  reason: string,
  statement: string,
): Promise<IEvidenceInventory> {
  return new EvidenceRubyAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "lib/fingerprint.rb",
      dedent`
        class Runner
          # @evidence docs/requirements.md#run ${reason}
          def run
            ${statement}
          end
        end
      `,
    ),
  );
}

function requireUnit(inventory: IEvidenceInventory, identity: string): IEvidenceUnit {
  const unit = inventory.units.find(
    (candidate) => candidate.identity.join(".") === identity,
  );
  if (unit === undefined)
    throw new Error(`Missing Ruby graph unit: ${identity}`);
  return unit;
}
