import { EvidCppAdapter, EvidInventory } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Attaches C++ Doxygen evidence and reports annotations in unsupported carriers.
 *
 * A declaration-leading documentation comment can host evidence, while literals and unsupported comments cannot create a graph acknowledgement.
 *
 * 1. Analyze supported Doxygen comments before C++ declarations.
 * 2. Compare attached declarations and hosts with the expected public units.
 * 3. Require inert annotated carriers to remain diagnostics.
 */
export async function test_cpp_hosts(): Promise<void> {
  const inventory = await new EvidCppAdapter().analyze(
    TestSourceSnapshot.create(
      "src/contracts.cpp",
      dedent`
        /**
         * @evid docs/requirements.md#type Implements the class.
         * @code
         * @evid docs/requirements.md#code Doxygen source is inert.
         * @endcode
         * <pre>@evid docs/requirements.md#pre Preformatted text is inert.</pre>
         */
        class Contracts {
        public:
            /// @evid docs/requirements.md#field Implements the field.
            int value;

            /// @evid docs/requirements.md#function Implements the method.
            int run() {
                /** @evid docs/requirements.md#body Body documentation is unsupported. */
                const char *text = "@evid docs/requirements.md#string Strings are unsupported.";
                const char *raw = R"tag(@evid docs/requirements.md#raw Raw strings are unsupported.)tag";
                return text[0] + raw[0];
            }

            int first, second; ///< @evid docs/requirements.md#trailing Implements both fields.

            enum class Result {
                success, ///< @evid docs/requirements.md#enumerator Implements the enumerator.
                failure,
            };

        private:
            /** @evid docs/requirements.md#private Private declarations are unsupported. */
            int secret;
        };

        /** @evid docs/requirements.md#template Implements the template. */
        template <class T>
        struct Box {
            T value;
        };

        /** @evid docs/requirements.md#attribute Implements the decorated function. */
        [[nodiscard]] int decorated();

        // @evid docs/requirements.md#ordinary Ordinary comments are unsupported.
        int ordinary;

        /** @evid docs/requirements.md#static Internal linkage is unsupported. */
        static int hidden;

        /** @evid docs/requirements.md#detached Detached Doxygen is unsupported. */

        int detached;
      `,
    ),
  );

  TestValidator.equals(
    "attached C++ declarations",
    inventory.declarations
      .map((declaration) => declaration.target)
      .sort(compare),
    [
      "docs/requirements.md#attribute",
      "docs/requirements.md#enumerator",
      "docs/requirements.md#field",
      "docs/requirements.md#function",
      "docs/requirements.md#template",
      "docs/requirements.md#trailing",
      "docs/requirements.md#type",
    ],
  );

  // One trailing statement comment owns both field declarators.
  const groupedDeclaration = inventory.declarations.find(
    (declaration) => declaration.target === "docs/requirements.md#trailing",
  );
  if (groupedDeclaration === undefined)
    throw new Error("Missing trailing C++ evidence declaration.");
  const groupedHost = inventory.hosts.find(
    (host) => host.id === groupedDeclaration.hostId,
  );
  if (groupedHost === undefined)
    throw new Error("Missing trailing C++ evidence host.");
  TestValidator.equals("C++ grouped field host", groupedHost.unitIds.length, 2);

  // Every tag-bearing non-Doxygen or unsupported placement stays observable.
  TestValidator.equals(
    "unsupported C++ annotation count",
    inventory.diagnostics.filter(
      (diagnostic) => diagnostic.code === "unsupported-annotation-host",
    ).length,
    7,
  );

  const withdrawn = await new EvidCppAdapter().analyze(
    TestSourceSnapshot.create(
      "include/hidden.hpp",
      dedent`
        /** @internal This declaration withdraws the merged class. */
        class Hidden;

        class Hidden {
        public:
            int value;
        };
      `,
    ),
  );
  const population = new EvidInventory([withdrawn]).select(
    withdrawn.units.map((unit) => unit.id),
  );
  TestValidator.equals(
    "withdrawn C++ hierarchy",
    population.hidden.map((unit) => unit.identity.join(".")).sort(compare),
    ["Hidden", "Hidden.value"],
  );
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
