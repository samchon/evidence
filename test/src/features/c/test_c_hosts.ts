import { EvidCAdapter, EvidInventory } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Attaches C Doxygen evidence and rejects annotations in inert source carriers.
 *
 * Only documentation that leads an eligible declaration may satisfy evidence; comments in literals or unsupported positions must remain visible failures.
 *
 * 1. Analyze Doxygen comments before supported declarations.
 * 2. Compare the resulting declarations and attached hosts.
 * 3. Require tag-bearing inert carriers to produce unsupported-host diagnostics.
 */
export async function test_c_hosts(): Promise<void> {
  const inventory = await new EvidCAdapter().analyze(
    TestSourceSnapshot.create(
      "src/contracts.c",
      dedent`
        /**
         * @evid docs/requirements.md#type Implements the aggregate.
         * @code
         * @evid docs/requirements.md#code Doxygen source is inert.
         * @endcode
         * <pre>@evid docs/requirements.md#pre Preformatted text is inert.</pre>
         */
        struct Contracts {
            /// @evid docs/requirements.md#field Implements the field.
            int value;
        };

        /// @evid docs/requirements.md#function Implements the function.
        int run(void) {
            /** @evid docs/requirements.md#body Body documentation is unsupported. */
            const char *text = "@evid docs/requirements.md#string Strings are unsupported.";
            return text[0];
        }

        int first, second; ///< @evid docs/requirements.md#trailing Implements both objects.

        enum Result {
            SUCCESS, /**< @evid docs/requirements.md#enumerator Implements the enumerator. */
            FAILURE,
        };

        // @evid docs/requirements.md#ordinary Ordinary comments are unsupported.
        int ordinary;

        /*
         * @evid docs/requirements.md#ordinary-block Ordinary block comments are unsupported.
         */
        int ordinary_block;

        /** @evid docs/requirements.md#static Static declarations are unsupported. */
        static int hidden;

        /** @evid docs/requirements.md#detached Detached Doxygen is unsupported. */

        int detached;

        /** @evid docs/requirements.md#directive A directive breaks attachment. */
        #define CONTRACT_VALUE 1
        int after_directive;
      `,
    ),
  );

  TestValidator.equals(
    "C attached declarations",
    inventory.declarations
      .map((declaration) => declaration.target)
      .sort(compare),
    [
      "docs/requirements.md#enumerator",
      "docs/requirements.md#field",
      "docs/requirements.md#function",
      "docs/requirements.md#trailing",
      "docs/requirements.md#type",
    ],
  );

  // One trailing statement comment owns every declarator from that site.
  const groupedDeclaration = inventory.declarations.find(
    (declaration) => declaration.target === "docs/requirements.md#trailing",
  );
  if (groupedDeclaration === undefined)
    throw new Error("Missing trailing C evidence declaration.");
  const groupedHost = inventory.hosts.find(
    (host) => host.id === groupedDeclaration.hostId,
  );
  if (groupedHost === undefined)
    throw new Error("Missing trailing C evidence host.");
  TestValidator.equals("C grouped object host", groupedHost.unitIds.length, 2);

  // Every tag-bearing inert carrier remains visible as an unsupported host.
  TestValidator.equals(
    "unsupported C annotation count",
    inventory.diagnostics.filter(
      (diagnostic) => diagnostic.code === "unsupported-annotation-host",
    ).length,
    7,
  );

  const withdrawn = await new EvidCAdapter().analyze(
    TestSourceSnapshot.create(
      "include/hidden.h",
      dedent`
        /** @internal This forward declaration withdraws the merged type. */
        struct Hidden;

        struct Hidden {
            int value;
        };
      `,
    ),
  );
  const population = new EvidInventory([withdrawn]).select(
    withdrawn.units.map((unit) => unit.id),
  );
  TestValidator.equals(
    "withdrawn C hierarchy",
    population.hidden.map((unit) => unit.identity.join(".")).sort(compare),
    ["struct Hidden", "struct Hidden.value"],
  );
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
