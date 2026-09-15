import { EvidJavaScriptAdapter } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Binds JavaScript evidence to JSDoc without reading JSX or literal examples.
 *
 * Only declaration-owned JSDoc is eligible; JSX and literal text remain inert.
 *
 * 1. Analyze documented declarations.
 * 2. Compare evidence hosts.
 * 3. Reject JSX and literal annotation carriers.
 */
export async function test_javascript_hosts(): Promise<void> {
  const content = dedent`
    /** @evid docs/spec.md#service Implements the service contract. */
    export class Service {
      /** @evid docs/spec.md#run Implements the operation. */
      run() {}
    }

    /** @evid docs/spec.md#view Implements the view. */
    export const View = () => (
      <section>
        @evid docs/spec.md#jsx This JSX text is not documentation.
      </section>
    );

    export const template = \`@evid docs/spec.md#template Not documentation.\`;
    export const expression = /@evid[^#]+#regex/;
    export const text = "@evid docs/spec.md#string Not documentation.";

    // @evid docs/spec.md#line A line comment is not JSDoc.
    export const unsupported = 1;
  `;
  const inventory = await new EvidJavaScriptAdapter().analyze(
    TestSourceSnapshot.create("src/view.mjs", content),
  );

  TestValidator.equals(
    "JavaScript evidence declarations",
    inventory.declarations
      .map((declaration) => declaration.target)
      .sort(compare),
    ["docs/spec.md#run", "docs/spec.md#service", "docs/spec.md#view"].sort(
      compare,
    ),
  );
  TestValidator.equals(
    "unsupported JavaScript host",
    inventory.diagnostics.filter(
      (diagnostic) => diagnostic.code === "unsupported-annotation-host",
    ).length,
    1,
  );

  // Every public declaration remains available to documentation policies.
  TestValidator.predicate(
    "every unit has a policy host",
    inventory.units.every((unit) =>
      inventory.hosts.some(
        (host) =>
          host.attachment === "attached" && host.unitIds.includes(unit.id),
      ),
    ),
  );
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
