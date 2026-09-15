import {
  EvidFingerprint,
  EvidGraph,
  EvidMarkdownAdapter,
  EvidRustAdapter,
} from "evid";
import type { IEvidInventory, IEvidUnit } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestGraph } from "../../internal/EvidTestGraph";
import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/**
 * Evaluates Rust type, function, and property evidence.
 *
 * Graph coverage and review fingerprints depend on each selected semantic unit.
 *
 * 1. Link Rust type, function, and property hosts to Markdown requirements.
 * 2. Remove each acknowledgement and require its corresponding requirement to
 *    become missing while the remaining graph stays covered.
 * 3. Compare review fingerprints after metadata-only and declaration-content
 *    edits.
 */
export async function test_rust_graph(): Promise<void> {
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
  const implementation = await new EvidRustAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "src/contracts.rs",
      dedent`
        /// @evidence docs/requirements.md#service Implements the public type.
        pub struct Service;

        /// @evidence docs/requirements.md#run Implements the operation.
        pub fn run() {}

        /// @evidence docs/requirements.md#value Implements the public value.
        pub static VALUE: i32 = 1;
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
    requireUnit(implementation, "run"),
    requireUnit(implementation, "VALUE"),
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
  TestValidator.equals("complete Rust graph", complete.success, true);

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
      `missing Rust ${anchor} acknowledgement`,
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
    "Rust evidence metadata preserves fingerprint",
    EvidFingerprint.inspect(original, originalUnit.id).fingerprint,
    EvidFingerprint.inspect(editedReason, reasonUnit.id).fingerprint,
  );
  TestValidator.notEquals(
    "Rust implementation moves fingerprint",
    EvidFingerprint.inspect(original, originalUnit.id).fingerprint,
    EvidFingerprint.inspect(editedBody, bodyUnit.id).fingerprint,
  );

  // A sibling struct field has its own source site and fingerprint.
  const fieldsOriginal = await fieldInventory("i32");
  const fieldsEdited = await fieldInventory("i64");
  const firstOriginal = requireUnit(fieldsOriginal, "first");
  const firstEdited = requireUnit(fieldsEdited, "first");
  TestValidator.equals(
    "Rust sibling field fingerprint isolation",
    EvidFingerprint.inspect(fieldsOriginal, firstOriginal.id).fingerprint,
    EvidFingerprint.inspect(fieldsEdited, firstEdited.id).fingerprint,
  );

  // Impl-level bounds contribute to every associated member declared inside it.
  const implOriginal = await implementationInventory("Clone");
  const implEdited = await implementationInventory("Copy");
  const methodOriginal = requireUnit(implOriginal, "calculate");
  const methodEdited = requireUnit(implEdited, "calculate");
  TestValidator.notEquals(
    "Rust impl header moves member fingerprint",
    EvidFingerprint.inspect(implOriginal, methodOriginal.id).fingerprint,
    EvidFingerprint.inspect(implEdited, methodEdited.id).fingerprint,
  );
}

async function fingerprintInventory(
  reason: string,
  statement: string,
): Promise<IEvidInventory> {
  return new EvidRustAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "src/fingerprint.rs",
      dedent`
        /// @evidence docs/requirements.md#run ${reason}
        pub fn run() -> i32 {
            ${statement}
        }
      `,
    ),
  );
}

async function fieldInventory(second: string): Promise<IEvidInventory> {
  return new EvidRustAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "src/fields.rs",
      dedent`
        pub struct Fields {
            pub first: i32,
            pub second: ${second},
        }
      ` + "\n",
    ),
  );
}

async function implementationInventory(bound: string): Promise<IEvidInventory> {
  return new EvidRustAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "src/implementation.rs",
      dedent`
        pub struct Sale;

        impl Sale
        where
            Sale: ${bound},
        {
            pub fn calculate(&self) {}
        }
      ` + "\n",
    ),
  );
}

function requireUnit(inventory: IEvidInventory, name: string): IEvidUnit {
  const unit = inventory.units.find(
    (candidate) =>
      candidate.name === name || candidate.identity.at(-1) === name,
  );
  if (unit === undefined) throw new Error(`Missing Rust graph unit: ${name}`);
  return unit;
}
