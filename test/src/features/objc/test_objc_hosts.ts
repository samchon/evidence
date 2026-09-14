import {
  EvidenceFingerprint,
  EvidenceInventory,
  EvidenceObjcAdapter,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Preserves UTF-16 Doxygen positions and merged withdrawals while excluding comments and examples from acknowledgements. */
export async function test_objc_hosts(): Promise<void> {
  const source = dedent`
    /**
     * 계약 😀
     * @evidence docs/spec.md#contract Implements the contract.
     */
    @interface Contract
    /// 값 😀
    /// @evidence docs/spec.md#value Implements the value.
    @property int value;
    /** @internal Withdraws the selector. */
    - (void)retired;
    @end
    /**
     * Examples:
     * ~~~objc
     * @evidence docs/spec.md#fenced Inert example.
     * ~~~
     * @code
     * @evidence docs/spec.md#code Inert example.
     * @endcode
     * <pre>
     * @evidence docs/spec.md#html Inert example.
     * </pre>
     */
    int sample(void) { return 1; }
  `.replaceAll("\n", "\r\n");
  const adapter = new EvidenceObjcAdapter();
  const snapshot = TestSourceSnapshot.combine([
    TestSourceSnapshot.create("src/Contract.h", source),
    TestSourceSnapshot.create(
      "src/Contract.m",
      dedent`
      @implementation Contract
      - (void)retired {}
      @end
    `,
    ),
  ]);
  const inventory = await adapter.analyze(snapshot);

  TestValidator.equals(
    "Doxygen examples never acknowledge",
    inventory.declarations.map((item) => item.target),
    ["docs/spec.md#contract", "docs/spec.md#value"],
  );
  TestValidator.equals(
    "valid attached documentation",
    inventory.diagnostics,
    [],
  );
  const tag = inventory.declarations[0];
  if (tag?.location.range === undefined)
    throw new Error("Missing annotation range.");
  TestValidator.equals(
    "original UTF-16 offset",
    tag.location.range.start.offset,
    source.indexOf("@evidence"),
  );
  TestValidator.equals("CRLF line", tag.location.range.start.line, 3);
  const graph = new EvidenceInventory([inventory]);
  TestValidator.equals(
    "withdrawal propagates to implementation address",
    graph.resolve(
      { file: "/project/src/Contract.m", segments: ["Contract", "-retired"] },
      inventory.units.map((unit) => unit.id),
    ).status,
    "hidden",
  );
  const contract = inventory.units.find((unit) => unit.name === "Contract");
  if (contract === undefined) throw new Error("Missing contract.");
  const annotation = structuredClone(snapshot);
  annotation.files[0]!.content = source.replace(
    "Implements the value.",
    "Describes the same value differently.",
  );
  const rewritten = await adapter.analyze(annotation);
  TestValidator.equals(
    "annotation edit preserves review",
    EvidenceFingerprint.inspect(inventory, contract.id).fingerprint,
    EvidenceFingerprint.inspect(rewritten, contract.id).fingerprint,
  );
  const semantic = structuredClone(snapshot);
  semantic.files[0]!.content = source.replace(
    "@property int value;",
    "@property long value;",
  );
  const changed = await adapter.analyze(semantic);
  TestValidator.notEquals(
    "semantic edit invalidates review",
    EvidenceFingerprint.inspect(inventory, contract.id).fingerprint,
    EvidenceFingerprint.inspect(changed, contract.id).fingerprint,
  );
  for (const tagName of [
    "evidence",
    "evidenceExclude",
    "evidenceReview",
    "evidenceExcludeReview",
    "link",
  ]) {
    const unsupported = await adapter.analyze(
      TestSourceSnapshot.create(
        "src/Unsupported.m",
        `// @${tagName} docs/spec.md#contract Unsupported carrier.\nint run(void) { return 1; }\n`,
      ),
    );
    TestValidator.equals(
      `${tagName} unsupported carrier diagnostic`,
      unsupported.diagnostics.map((item) => item.code),
      ["unsupported-annotation-host"],
    );
    TestValidator.equals(
      `${tagName} never acknowledges`,
      unsupported.declarations,
      [],
    );
    TestValidator.equals(`${tagName} never reviews`, unsupported.reviews, []);
  }
}
