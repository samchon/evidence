import { EvidenceFingerprint, EvidenceInventory, EvidenceZigAdapter } from "evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Attaches Zig documentation with exact coordinates and withdrawal semantics.
 *
 * Lexical withdrawals and review fingerprints affect eligible documentation,
 * while code examples cannot acknowledge units.
 *
 * 1. Analyze documentation, withdrawals, and inert examples.
 * 2. Verify coordinates, records, and resolution.
 * 3. Compare annotation and semantic fingerprint effects.
 */
export async function test_zig_hosts(): Promise<void> {
  const source = dedent`
    /// 계약 🔎
    /// @evidence docs/spec.md#contract Implements the contract.
    pub const Contract = struct {
      /// @internal Withdraws the nested type.
      pub const Retired = struct { pub const child = 1; };
      /// @evidence docs/spec.md#value Implements the value.
      pub const @"value.part" = 1;
    };
    /// Examples:
    /// ~~~zig
    /// @evidence docs/spec.md#example Inert example.
    /// ~~~
    ///
    ///     @evidence docs/spec.md#indented Inert indented example.
    /// <pre>
    /// @evidence docs/spec.md#html Inert HTML example.
    /// </pre>
    pub fn sample() i32 { return 1; }
  `.replaceAll("\n", "\r\n");
  const adapter = new EvidenceZigAdapter();
  const inventory = await adapter.analyze(
    EvidenceTestSourceSnapshot.create("src/Contract.zig", source),
  );

  TestValidator.equals(
    "Zig documentation examples remain inert",
    inventory.declarations.map((item) => item.target),
    ["docs/spec.md#contract", "docs/spec.md#value"],
  );
  TestValidator.equals(
    "Zig documentation positions remain valid",
    inventory.diagnostics,
    [],
  );
  const declaration = inventory.declarations[0];
  if (declaration === undefined || declaration.location.range === undefined)
    throw new Error("Missing declaration range.");
  TestValidator.equals(
    "UTF-16 offset after astral text",
    declaration.location.range.start.offset,
    source.indexOf("@evidence"),
  );
  TestValidator.equals(
    "CRLF source line",
    declaration.location.range.start.line,
    2,
  );
  const selected = inventory.units.map((unit) => unit.id);
  const graph = new EvidenceInventory([inventory]);
  TestValidator.equals(
    "withdrawn descendant target",
    graph.resolve(
      {
        file: "/project/src/Contract.zig",
        segments: ["Contract", "Retired", "child"],
      },
      selected,
    ).status,
    "hidden",
  );
  TestValidator.equals(
    "literal dotted property",
    graph.resolve(
      {
        file: "/project/src/Contract.zig",
        segments: ["Contract", "value.part"],
      },
      selected,
    ).status,
    "resolved",
  );
  TestValidator.equals(
    "dotted text does not imply containment",
    graph.resolve(
      {
        file: "/project/src/Contract.zig",
        segments: ["Contract", "value", "part"],
      },
      selected,
    ).status,
    "missing",
  );
  const contract = inventory.units.find((unit) => unit.name === "Contract");
  if (contract === undefined) throw new Error("Missing contract unit.");
  const rewritten = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "src/Contract.zig",
      source.replace(
        "Implements the value.",
        "Records the same value differently.",
      ),
    ),
  );
  TestValidator.equals(
    "descendant annotation does not stale ancestor review",
    EvidenceFingerprint.inspect(inventory, contract.id).fingerprint,
    EvidenceFingerprint.inspect(rewritten, contract.id).fingerprint,
  );
  const changed = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "src/Contract.zig",
      source.replace("= 1", "= 2"),
    ),
  );
  TestValidator.notEquals(
    "semantic subtree edit changes fingerprint",
    EvidenceFingerprint.inspect(inventory, contract.id).fingerprint,
    EvidenceFingerprint.inspect(changed, contract.id).fingerprint,
  );

  // Every Evid tag kind on an ordinary comment remains an unsupported carrier.
  for (const tag of [
    "evidence",
    "evidenceExclude",
    "evidenceReview",
    "evidenceExcludeReview",
    "link",
  ]) {
    const unsupported = await adapter.analyze(
      EvidenceTestSourceSnapshot.create(
        "src/Unsupported.zig",
        `// @${tag} docs/spec.md#contract Unsupported carrier.\npub fn run() i32 { return 1; }\n`,
      ),
    );
    TestValidator.equals(
      `${tag} ordinary comments never acknowledge`,
      unsupported.declarations,
      [],
    );
    TestValidator.equals(
      `${tag} ordinary comments never review`,
      unsupported.reviews,
      [],
    );
    TestValidator.equals(
      `${tag} diagnostic`,
      unsupported.diagnostics.map((item) => item.code),
      ["unsupported-annotation-host"],
    );
  }
  for (const content of [
    "//! @evidence docs/spec.md#contract Container documentation has no declaration host.\npub const value = 1;",
    "/// @evidence docs/spec.md#contract Private declaration is not a public carrier.\nconst value = 1;",
    "pub fn run() void {\n/// @evidence docs/spec.md#contract Function-body documentation is not public.\nconst local = 1;\n}",
  ]) {
    const unsupported = await adapter.analyze(
      EvidenceTestSourceSnapshot.create("src/Unsupported.zig", content),
    );
    TestValidator.equals(
      "nonpublic documentation never acknowledges",
      unsupported.declarations,
      [],
    );
    TestValidator.equals(
      "nonpublic documentation remains actionable",
      unsupported.diagnostics.map((item) => item.code),
      ["unsupported-annotation-host"],
    );
  }
}
