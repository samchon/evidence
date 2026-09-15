import {
  EvidenceFingerprint,
  EvidenceInventory,
  EvidenceRustAdapter,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Preserves Rust tuple-field identity across interleaved comments.
 *
 * Comments between field tokens cannot change tuple indexes, visibility, or
 * documentation ownership.
 *
 * 1. Analyze public and private tuple fields separated by ordinary comments,
 *    documentation, attributes, and whitespace.
 * 2. Require only real public indexes to publish, and attach tags and reviews to
 *    their physical fields.
 * 3. Resolve existing and absent numeric targets, then compare fingerprints after
 *    review-text and field-type edits.
 */
export async function test_rust_tuple_comments(): Promise<void> {
  const content = dedent`
    pub struct Sale(
      // An ordinary comment is not a field.
      /// @evidence docs/spec.md#first Documents the first field.
      /// @evidenceReview docs/spec.md#first #abcdef0 Reviewed the first field.
      #[deprecated]
      /* Whitespace between attributes and visibility. */
      pub /* Whitespace between visibility and type. */ i32,
      // Private fields still occupy their actual numeric position.
      i16,
      /** @evidence docs/spec.md#last Documents the last field. */
      pub i64,
    );
  `;
  const adapter = new EvidenceRustAdapter();
  const inventory = await adapter.analyze(
    EvidenceTestSourceSnapshot.create("src/lib.rs", content),
  );
  const units = new Map(
    inventory.units.map((unit) => [unit.id, unit.identity.join(".")]),
  );
  const hosts = new Map(
    inventory.hosts.map((host) => [
      host.id,
      host.unitIds.map((id) => units.get(id)),
    ]),
  );

  TestValidator.equals(
    "only real public fields are selected",
    [...units.values()].sort((a, b) => a.localeCompare(b)),
    ["Sale", "Sale.0", "Sale.2"],
  );
  TestValidator.equals(
    "tuple comments attach to the real field",
    inventory.declarations
      .map((item) => ({ target: item.target, owners: hosts.get(item.hostId) }))
      .sort((a, b) => a.target.localeCompare(b.target)),
    [
      { target: "docs/spec.md#first", owners: ["Sale.0"] },
      { target: "docs/spec.md#last", owners: ["Sale.2"] },
    ],
  );
  TestValidator.equals(
    "tuple comments are complete",
    inventory.diagnostics,
    [],
  );
  TestValidator.equals(
    "review shares the field host",
    inventory.reviews[0]?.hostId,
    inventory.declarations.find((item) => item.target === "docs/spec.md#first")
      ?.hostId,
  );
  const graph = new EvidenceInventory([inventory]);
  for (const [segment, status] of [
    ["0", "resolved"],
    ["1", "missing"],
    ["2", "resolved"],
    ["3", "missing"],
  ] as const)
    TestValidator.equals(
      `numeric target ${segment}`,
      graph.resolve(
        { file: "/project/src/lib.rs", segments: ["Sale", segment] },
        inventory.units.map((unit) => unit.id),
      ).status,
      status,
    );

  const edited = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "src/lib.rs",
      content.replace(
        "Reviewed the first field.",
        "Reviewed the unchanged field again.",
      ),
    ),
  );
  const changed = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "src/lib.rs",
      content.replace("*/ i32", "*/ u32"),
    ),
  );
  for (const name of ["Sale", "0"]) {
    const unit = inventory.units.find((item) => item.name === name);
    if (unit === undefined) throw new Error(`Missing ${name}.`);
    TestValidator.equals(
      "review metadata is excluded",
      EvidenceFingerprint.inspect(inventory, unit.id).fingerprint,
      EvidenceFingerprint.inspect(edited, unit.id).fingerprint,
    );
    TestValidator.notEquals(
      "real field content is retained",
      EvidenceFingerprint.inspect(inventory, unit.id).fingerprint,
      EvidenceFingerprint.inspect(changed, unit.id).fingerprint,
    );
  }
}
