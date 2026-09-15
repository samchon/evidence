import { EvidFingerprint, EvidInventory, EvidSwiftAdapter } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/**
 * Attaches Swift DocC with exact coordinates and withdrawal behavior.
 *
 * Attributes, CRLF text, and examples must not alter eligible host semantics.
 *
 * 1. Analyze DocC hosts, withdrawals, and examples.
 * 2. Verify coordinates, targets, and fingerprints.
 */
export async function test_swift_hosts(): Promise<void> {
  const source = dedent`
    /// 계약 😀
    /// @evidence docs/spec.md#contract Implements the contract.
    @available(*, deprecated)
    public struct Contract {
      /** @internal Withdraws the nested type. */
      public struct Retired { public let child = 1 }
      /// @evidence docs/spec.md#value Implements the value.
      public let 값 = 1
    }
    /**
     * Examples:
     * ~~~swift
     * @evidence docs/spec.md#example Inert fenced example.
     * ~~~
     *
     *     @evidence docs/spec.md#indented Inert indented example.
     */
    public func sample() {}
  `.replaceAll("\n", "\r\n");
  const adapter = new EvidSwiftAdapter();
  const inventory = await adapter.analyze(
    EvidTestSourceSnapshot.create("src/Contract.swift", source),
  );

  TestValidator.equals(
    "only attached non-example annotations",
    inventory.declarations.map((declaration) => declaration.target),
    ["docs/spec.md#contract", "docs/spec.md#value"],
  );
  TestValidator.equals("valid DocC positions", inventory.diagnostics, []);
  const declaration = inventory.declarations[0];
  TestValidator.equals(
    "original UTF-16 offset after astral text",
    declaration?.location?.range?.start?.offset,
    source.indexOf("@evidence"),
  );
  TestValidator.equals(
    "original CRLF line",
    declaration?.location?.range?.start?.line,
    2,
  );
  const contract = inventory.units.find((unit) => unit.name === "Contract");
  if (contract === undefined) throw new Error("Missing contract.");
  TestValidator.equals(
    "DocC attaches before the attribute",
    contract.sites[0]?.range?.start?.offset,
    source.indexOf("@available"),
  );
  const graph = new EvidInventory([inventory]);
  TestValidator.equals(
    "withdrawn nested descendants",
    graph.resolve(
      {
        file: "/project/src/Contract.swift",
        segments: ["Contract", "Retired", "child"],
      },
      inventory.units.map((unit) => unit.id),
    ).status,
    "hidden",
  );
  const rewritten = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "src/Contract.swift",
      source.replace(
        "Implements the value.",
        "Explains this value differently.",
      ),
    ),
  );
  TestValidator.equals(
    "annotation edits preserve ancestor reviews",
    EvidFingerprint.inspect(inventory, contract.id).fingerprint,
    EvidFingerprint.inspect(rewritten, contract.id).fingerprint,
  );
  const changed = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "src/Contract.swift",
      source.replace("let 값 = 1", "let 값 = 2"),
    ),
  );
  TestValidator.notEquals(
    "semantic member edit stales ancestor reviews",
    EvidFingerprint.inspect(inventory, contract.id).fingerprint,
    EvidFingerprint.inspect(changed, contract.id).fingerprint,
  );

  // A string that resembles an annotation remains semantic implementation content.
  const literalSource =
    'public func literal() -> String { "@evidence docs/spec.md#value Literal content." }';
  const literal = await adapter.analyze(
    EvidTestSourceSnapshot.create("src/Literal.swift", literalSource),
  );
  const literalChanged = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "src/Literal.swift",
      literalSource.replace("Literal content.", "Changed content."),
    ),
  );
  const literalUnit = literal.units[0];
  if (literalUnit === undefined) throw new Error("Missing literal function.");
  TestValidator.notEquals(
    "unsupported annotation strings remain fingerprint content",
    EvidFingerprint.inspect(literal, literalUnit.id).fingerprint,
    EvidFingerprint.inspect(literalChanged, literalUnit.id).fingerprint,
  );

  for (const tag of [
    "evidence",
    "evidenceExclude",
    "evidenceReview",
    "evidenceExcludeReview",
    "link",
  ]) {
    const unsupported = await adapter.analyze(
      EvidTestSourceSnapshot.create(
        "src/Unsupported.swift",
        `// @${tag} docs/spec.md#contract Unsupported carrier.\npublic func run() {}\n`,
      ),
    );
    TestValidator.equals(
      `${tag} cannot acknowledge`,
      unsupported.declarations,
      [],
    );
    TestValidator.equals(`${tag} cannot review`, unsupported.reviews, []);
    TestValidator.equals(
      `${tag} reports host boundary`,
      unsupported.diagnostics.map((diagnostic) => diagnostic.code),
      ["unsupported-annotation-host"],
    );
  }
}
