import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceInventory } from "../../../../packages/evidence/src/graph/EvidenceInventory";
import { EvidenceRubyAdapter } from "../../../../packages/evidence/src/adapters/ruby/EvidenceRubyAdapter";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Attaches Ruby RDoc comments and rejects tags in non-documentation carriers. */
export async function test_ruby_hosts(): Promise<void> {
  const inventory = await new EvidenceRubyAdapter().analyze(
    TestSourceSnapshot.create(
      "lib/contracts.rb",
      dedent`
        # @evidence docs/requirements.md#type Implements the class.
        class Contracts
          # @evidence docs/requirements.md#method Implements the method.
          def run
            # @evidence docs/requirements.md#body Body comments are unsupported.
            text = "@evidence docs/requirements.md#string Strings are unsupported."
            heredoc = <<~DOC
              @evidence docs/requirements.md#heredoc Heredocs are unsupported.
            DOC
            [text, heredoc]
          end

          # @evidence docs/requirements.md#attributes Implements both attributes.
          attr_reader :first, :second

          private
          # @evidence docs/requirements.md#private Private methods are unsupported.
          def hidden; end

          # @evidence docs/requirements.md#detached Detached comments are unsupported.

          def detached; end
        end

        =begin
        @evidence docs/requirements.md#embedded Implements embedded RDoc.
        =end
        class Embedded; end

        value = 1 # @evidence docs/requirements.md#inline Inline comments are unsupported.
                  class Aligned; end

        # @evidence docs/requirements.md#trailing Trailing comments are unsupported.
      `,
    ),
  );

  TestValidator.equals(
    "attached Ruby declarations",
    inventory.declarations
      .map((declaration) => declaration.target)
      .sort(compare),
    [
      "docs/requirements.md#attributes",
      "docs/requirements.md#embedded",
      "docs/requirements.md#method",
      "docs/requirements.md#type",
    ],
  );

  // One attribute carrier owns both public property units.
  const attributes = inventory.declarations.find(
    (declaration) => declaration.target === "docs/requirements.md#attributes",
  );
  if (attributes === undefined)
    throw new Error("Missing Ruby attribute evidence declaration.");
  const host = inventory.hosts.find(
    (candidate) => candidate.id === attributes.hostId,
  );
  if (host === undefined) throw new Error("Missing Ruby attribute host.");
  TestValidator.equals("Ruby grouped attribute host", host.unitIds.length, 2);

  // Body comments, strings, heredocs, private and detached comments stay observable.
  TestValidator.equals(
    "unsupported Ruby annotation count",
    inventory.diagnostics.filter(
      (diagnostic) => diagnostic.code === "unsupported-annotation-host",
    ).length,
    7,
  );

  const withdrawn = await new EvidenceRubyAdapter().analyze(
    TestSourceSnapshot.create(
      "lib/hidden.rb",
      dedent`
        # @internal This class and its descendants are internal.
        class Hidden
          def value; end
        end
      `,
    ),
  );
  const population = new EvidenceInventory([withdrawn]).select(
    withdrawn.units.map((unit) => unit.id),
  );
  TestValidator.equals(
    "withdrawn Ruby hierarchy",
    population.hidden.map((unit) => unit.identity.join(".")).sort(compare),
    ["Hidden", "Hidden.value"],
  );
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
