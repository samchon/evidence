import {
  EvidFingerprint,
  EvidInventory,
  EvidObjcAdapter,
} from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/** Attaches Objective-C Doxygen annotations at exact source locations.
 *
 * Eligible documentation retains UTF-16 coordinates and merged withdrawals, while ordinary comments and examples cannot acknowledge units.
 *
 * 1. Analyze documented declarations, withdrawals, and inert comment-shaped text.
 * 2. Verify targets, CRLF positions, and resolution behavior.
 * 3. Compare semantic and documentation fingerprint effects.
 */
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
  const adapter = new EvidObjcAdapter();
  const snapshot = EvidTestSourceSnapshot.combine([
    EvidTestSourceSnapshot.create("src/Contract.h", source),
    EvidTestSourceSnapshot.create(
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
  if (tag === undefined || tag.location.range === undefined)
    throw new Error("Missing annotation range.");
  TestValidator.equals(
    "original UTF-16 offset",
    tag.location.range.start.offset,
    source.indexOf("@evidence"),
  );
  TestValidator.equals("CRLF line", tag.location.range.start.line, 3);
  const graph = new EvidInventory([inventory]);
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
  const annotationFile = annotation.files[0];
  if (annotationFile === undefined)
    throw new Error("Missing annotation source.");
  annotationFile.content = source.replace(
    "Implements the value.",
    "Describes the same value differently.",
  );
  const rewritten = await adapter.analyze(annotation);
  TestValidator.equals(
    "annotation edit preserves review",
    EvidFingerprint.inspect(inventory, contract.id).fingerprint,
    EvidFingerprint.inspect(rewritten, contract.id).fingerprint,
  );
  const semantic = structuredClone(snapshot);
  const semanticFile = semantic.files[0];
  if (semanticFile === undefined) throw new Error("Missing semantic source.");
  semanticFile.content = source.replace(
    "@property int value;",
    "@property long value;",
  );
  const changed = await adapter.analyze(semantic);
  TestValidator.notEquals(
    "semantic edit invalidates review",
    EvidFingerprint.inspect(inventory, contract.id).fingerprint,
    EvidFingerprint.inspect(changed, contract.id).fingerprint,
  );
  for (const tagName of [
    "evidence",
    "evidenceExclude",
    "evidenceReview",
    "evidenceExcludeReview",
    "link",
  ]) {
    const unsupported = await adapter.analyze(
      EvidTestSourceSnapshot.create(
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
