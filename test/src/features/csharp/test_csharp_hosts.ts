import { EvidCSharpAdapter, EvidInventory } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Attaches C# XML documentation and rejects inert source carriers.
 *
 * The fixture separates eligible declaration docs from code examples, directives, strings, body comments, and inaccessible members.
 *
 * 1. Extract evidence from XML documentation on public types, grouped fields, and methods.
 * 2. Verify grouped fields share a host and XML code/example regions remain inert.
 * 3. Require non-XML comments and inaccessible or directive-separated carriers to report unsupported annotations, while a withdrawn partial hierarchy stays hidden.
 */
export async function test_csharp_hosts(): Promise<void> {
  const inventory = await new EvidCSharpAdapter().analyze(
    TestSourceSnapshot.create(
      "src/Contracts.cs",
      dedent`
        /// <summary>
        /// @evid docs/requirements.md#type Implements the public type.
        /// <code>
        /// @evid docs/requirements.md#code Code examples are inert.
        /// </code>
        /// <example>
        /// @evid docs/requirements.md#example Examples are inert.
        /// </example>
        /// <c>@evid docs/requirements.md#inline Inline code is inert.</c>
        /// </summary>
        [Obsolete]
        public class Contracts : IService
        {
            /// @evid docs/requirements.md#fields Implements both fields.
            public int First = 1, Second = 2;

            /**
             * @evid docs/requirements.md#method Implements the method.
             */
            public void Run() { }

            // @evid docs/requirements.md#ordinary Ordinary comments are unsupported.
            public void Ordinary() { }

            /// @evid docs/requirements.md#private Private members are unsupported.
            private void Private() { }

            /// @evid docs/requirements.md#explicit Explicit implementations are unsupported.
            void IService.Run() { }

            /// @evid docs/requirements.md#directive Preprocessor directives break attachment.
            #nullable enable
            public void DirectiveBoundary() { }

            /// @evid docs/requirements.md#before-directive A directive splits the sequence.
            #nullable disable
            /// @evid docs/requirements.md#after-directive A new sequence can attach.
            public void AfterDirective() { }

            public void Literals()
            {
                var normal = "@evid docs/requirements.md#string Strings are unsupported.";
                var verbatim = @"@evid docs/requirements.md#verbatim Verbatim strings are unsupported.";
                var raw = """@evid docs/requirements.md#raw Raw strings are unsupported.""";
                var interpolated = $"@evid docs/requirements.md#interpolated {1}";
                // @evid docs/requirements.md#body Body comments are unsupported.
            }
        }

        public interface IService
        {
            void Run();
        }
      `,
    ),
  );

  // XML wrappers remain usable while their code and example regions stay inert.
  TestValidator.equals(
    "C# attached declarations",
    inventory.declarations
      .map((declaration) => declaration.target)
      .sort(compare),
    [
      "docs/requirements.md#after-directive",
      "docs/requirements.md#fields",
      "docs/requirements.md#method",
      "docs/requirements.md#type",
    ],
  );
  const grouped = inventory.hosts.find(
    (host) =>
      host.unitIds.some((unitId) => unitId.includes('"First"')) &&
      host.unitIds.some((unitId) => unitId.includes('"Second"')),
  );
  if (grouped === undefined)
    throw new Error("Missing grouped C# field documentation host.");
  TestValidator.equals(
    "C# grouped field host units",
    grouped.unitIds.length,
    2,
  );

  // Non-XML comments, strings, and docs on unpublished members are visible failures.
  TestValidator.equals(
    "unsupported C# annotation count",
    inventory.diagnostics.filter(
      (diagnostic) => diagnostic.code === "unsupported-annotation-host",
    ).length,
    10,
  );

  const withdrawn = await new EvidCSharpAdapter().analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "src/Hidden.cs",
        dedent`
          public partial class Hidden
          {
              public int Value { get; set; }
          }
        `,
      ),
      TestSourceSnapshot.create(
        "src/Hidden.Partial.cs",
        dedent`
          /// @internal Every selected part belongs to one withdrawn type.
          partial class Hidden
          {
              public void Open() { }
          }
        `,
      ),
    ]),
  );
  const population = new EvidInventory([withdrawn]).select(
    withdrawn.units.map((unit) => unit.id),
  );
  TestValidator.equals(
    "withdrawn C# partial hierarchy",
    population.hidden.map((unit) => unit.identity.join(".")).sort(compare),
    ["Hidden", "Hidden.Open", "Hidden.Value"],
  );
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
