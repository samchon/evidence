import { EvidFingerprint, EvidInventory, EvidKotlinAdapter } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/**
 * Preserves KDoc coordinates, lexical withdrawals, and fingerprints without
 * accepting examples.
 *
 * KDoc hosts evidence at original source positions while examples and withdrawn
 * hierarchy stay outside acknowledgement.
 *
 * 1. Analyze KDoc with Unicode and withdrawals. 2. Verify coordinates and hidden
 *    descendants. 3. Compare semantic and annotation-only fingerprints.
 */
export async function test_kotlin_hosts(): Promise<void> {
  const source = dedent`
    /**
     * 계약 😀
     * @evidence docs/spec.md#contract Implements the contract.
     */
    @Deprecated("legacy")
    class Contract {
      /** @internal Withdraws the nested type. */
      class Retired { val child = 1; }
      /** @evidence docs/spec.md#value Implements the value. */
      val \`value.part\` = 1
    }
    /**
     * Examples:
     * ~~~kotlin
     * @evidence docs/spec.md#example Inert example.
     * ~~~
     *
     *     @evidence docs/spec.md#indented Inert indented example.
     */
    fun sample() = 1
  `.replaceAll("\n", "\r\n");
  const adapter = new EvidKotlinAdapter();
  const inventory = await adapter.analyze(
    EvidTestSourceSnapshot.create("src/Contract.kt", source),
  );

  TestValidator.equals(
    "KDoc examples remain inert",
    inventory.declarations.map((item) => item.target),
    ["docs/spec.md#contract", "docs/spec.md#value"],
  );
  TestValidator.equals(
    "KDoc positions remain valid",
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
    3,
  );
  const selected = inventory.units.map((unit) => unit.id);
  const graph = new EvidInventory([inventory]);
  TestValidator.equals(
    "withdrawn descendant target",
    graph.resolve(
      {
        file: "/project/src/Contract.kt",
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
        file: "/project/src/Contract.kt",
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
        file: "/project/src/Contract.kt",
        segments: ["Contract", "value", "part"],
      },
      selected,
    ).status,
    "missing",
  );
  const contract = inventory.units.find((unit) => unit.name === "Contract");
  if (contract === undefined) throw new Error("Missing contract unit.");
  const rewritten = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "src/Contract.kt",
      source.replace(
        "Implements the value.",
        "Records the same value differently.",
      ),
    ),
  );
  TestValidator.equals(
    "descendant annotation does not stale ancestor review",
    EvidFingerprint.inspect(inventory, contract.id).fingerprint,
    EvidFingerprint.inspect(rewritten, contract.id).fingerprint,
  );
  const changed = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "src/Contract.kt",
      source.replace("= 1", "= 2"),
    ),
  );
  TestValidator.notEquals(
    "semantic subtree edit changes fingerprint",
    EvidFingerprint.inspect(inventory, contract.id).fingerprint,
    EvidFingerprint.inspect(changed, contract.id).fingerprint,
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
      EvidTestSourceSnapshot.create(
        "src/Unsupported.kt",
        `// @${tag} docs/spec.md#contract Unsupported carrier.\nfun run() = 1\n`,
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
}
