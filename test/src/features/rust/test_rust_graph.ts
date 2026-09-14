import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceFingerprint } from "../../../../packages/evidence/src/graph/EvidenceFingerprint";
import { EvidenceGraph } from "../../../../packages/evidence/src/graph/EvidenceGraph";
import { EvidenceMarkdownAdapter } from "../../../../packages/evidence/src/adapters/markdown/EvidenceMarkdownAdapter";
import { EvidenceRustAdapter } from "../../../../packages/evidence/src/adapters/rust/EvidenceRustAdapter";
import type { IEvidenceInventory } from "../../../../packages/evidence/src/structures/IEvidenceInventory";
import type { IEvidenceUnit } from "../../../../packages/evidence/src/structures/IEvidenceUnit";
import { TestGraph } from "../../internal/TestGraph";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Evaluates Rust type, function, and property evidence and semantic fingerprints. */
export async function test_rust_graph(): Promise<void> {
  const requirements = await new EvidenceMarkdownAdapter().analyze(
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
  const implementation = await new EvidenceRustAdapter().analyze(
    TestSourceSnapshot.create(
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
  TestValidator.equals("complete Rust graph", complete.success, true);

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
      `missing Rust ${anchor} acknowledgement`,
      TestGraph.obligation(partial, 0, 0).missingUnitIds,
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
    EvidenceFingerprint.inspect(original, originalUnit.id).fingerprint,
    EvidenceFingerprint.inspect(editedReason, reasonUnit.id).fingerprint,
  );
  TestValidator.notEquals(
    "Rust implementation moves fingerprint",
    EvidenceFingerprint.inspect(original, originalUnit.id).fingerprint,
    EvidenceFingerprint.inspect(editedBody, bodyUnit.id).fingerprint,
  );

  // A sibling struct field has its own source site and fingerprint.
  const fieldsOriginal = await fieldInventory("i32");
  const fieldsEdited = await fieldInventory("i64");
  const firstOriginal = requireUnit(fieldsOriginal, "first");
  const firstEdited = requireUnit(fieldsEdited, "first");
  TestValidator.equals(
    "Rust sibling field fingerprint isolation",
    EvidenceFingerprint.inspect(fieldsOriginal, firstOriginal.id).fingerprint,
    EvidenceFingerprint.inspect(fieldsEdited, firstEdited.id).fingerprint,
  );

  // Impl-level bounds contribute to every associated member declared inside it.
  const implOriginal = await implementationInventory("Clone");
  const implEdited = await implementationInventory("Copy");
  const methodOriginal = requireUnit(implOriginal, "calculate");
  const methodEdited = requireUnit(implEdited, "calculate");
  TestValidator.notEquals(
    "Rust impl header moves member fingerprint",
    EvidenceFingerprint.inspect(implOriginal, methodOriginal.id).fingerprint,
    EvidenceFingerprint.inspect(implEdited, methodEdited.id).fingerprint,
  );
}

async function fingerprintInventory(
  reason: string,
  statement: string,
): Promise<IEvidenceInventory> {
  return new EvidenceRustAdapter().analyze(
    TestSourceSnapshot.create(
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

async function fieldInventory(second: string): Promise<IEvidenceInventory> {
  return new EvidenceRustAdapter().analyze(
    TestSourceSnapshot.create(
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

async function implementationInventory(
  bound: string,
): Promise<IEvidenceInventory> {
  return new EvidenceRustAdapter().analyze(
    TestSourceSnapshot.create(
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

function requireUnit(
  inventory: IEvidenceInventory,
  name: string,
): IEvidenceUnit {
  const unit = inventory.units.find(
    (candidate) =>
      candidate.name === name || candidate.identity.at(-1) === name,
  );
  if (unit === undefined) throw new Error(`Missing Rust graph unit: ${name}`);
  return unit;
}
