import { EvidenceTypeScriptAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Binds TypeScript JSDoc only to supported declaration hosts.
 *
 * Tag-bearing comments outside declaration JSDoc remain findings and cannot
 * create acknowledgements.
 *
 * 1. Analyze eligible JSDoc and unsupported comment placements.
 * 2. Verify attached declarations and unsupported-host diagnostics.
 */
export async function test_typescript_hosts(): Promise<void> {
  const content = dedent`
    /** @evidence docs/spec.md#mixed Supplies both exported bindings. */
    export const callable = (): void => {}, data = 1;

    export class Service {
      /** @evidence docs/spec.md#run Supplies the public method. */
      run(): void {}
    }

    export const first = 1,
      /** @evidence docs/spec.md#declarator Documents only the second binding. */
      second = 2;

    /** @internal This API is intentionally hidden. */
    export function hidden(): void {}

    /** @evidence docs/spec.md#local This local declaration is not a host. */
    function local(): void {}

    /** This detached prose only mentions @evidence as a word. */
    function localProse(): void {}

    // @evidence docs/spec.md#line A line comment cannot host evidence.
    /* @evidence docs/spec.md#block A non-JSDoc block cannot host evidence. */
    // @evidenceReview docs/spec.md#review #abcdef0 A review cannot use a line comment.
    /* @evidenceExclude docs/spec.md#exclude A withdrawal cannot use a block comment. */
    /** @evidenceExcludeReview docs/spec.md#exclude #abcdef0 A local review is not a host. */
    function reviewedLocally(): void {}
    export const text = "@evidence docs/spec.md#string This is a string.";
  `;
  const inventory = await new EvidenceTypeScriptAdapter().analyze(
    EvidenceTestSourceSnapshot.create("src/hosts.ts", content),
  );

  TestValidator.equals(
    "eligible declarations",
    inventory.declarations.map((entry) => entry.target),
    ["docs/spec.md#mixed", "docs/spec.md#run", "docs/spec.md#declarator"],
  );
  const mixed = inventory.hosts.find((host) =>
    content
      .slice(host.range.start.offset, host.range.end.offset)
      .includes("#mixed"),
  );
  if (mixed === undefined)
    throw new Error("Missing mixed variable JSDoc host.");
  TestValidator.equals(
    "mixed variable host owns both units",
    mixed.unitIds.length,
    2,
  );

  const first = inventory.units.find((unit) => unit.identity[0] === "first");
  const second = inventory.units.find((unit) => unit.identity[0] === "second");
  if (first === undefined || second === undefined)
    throw new Error("Missing split variable units.");
  const statement = inventory.hosts.find(
    (host) =>
      host.unitIds.includes(first.id) && host.unitIds.includes(second.id),
  );
  if (statement === undefined)
    throw new Error("Missing shared undocumented statement host.");
  TestValidator.predicate(
    "statement host remains distinct from declarator documentation",
    content
      .slice(statement.range.start.offset, statement.range.end.offset)
      .includes("export const first"),
  );

  const hidden = inventory.units.find((unit) => unit.identity[0] === "hidden");
  if (hidden === undefined) throw new Error("Missing withdrawn function unit.");
  TestValidator.equals(
    "withdrawal retained on identity",
    hidden.withdrawals.length,
    1,
  );

  // A public declaration remains a policy host without a documentation block.
  const text = inventory.units.find((unit) => unit.identity[0] === "text");
  if (text === undefined)
    throw new Error("Missing undocumented property unit.");
  const undocumented = inventory.hosts.find(
    (host) => host.attachment === "attached" && host.unitIds.includes(text.id),
  );
  if (undocumented === undefined)
    throw new Error("Missing undocumented declaration host.");
  TestValidator.predicate(
    "undocumented host uses declaration range",
    content
      .slice(undocumented.range.start.offset, undocumented.range.end.offset)
      .includes("export const text"),
  );

  TestValidator.equals(
    "unsupported comment findings",
    inventory.diagnostics.map((diagnostic) => diagnostic.code),
    [
      "unsupported-annotation-host",
      "unsupported-annotation-host",
      "unsupported-annotation-host",
      "unsupported-annotation-host",
      "unsupported-annotation-host",
      "unsupported-annotation-host",
    ],
  );
}
