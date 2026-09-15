import { EvidenceFingerprint, EvidenceInventory, EvidenceRubyAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Attaches embedded Ruby RDoc across nested declaration indentation.
 *
 * Column-zero comments respect blank-line and lexical scope boundaries before
 * they can document a member.
 *
 * 1. Analyze nested embedded RDoc under LF, CRLF, and tab-indented source.
 * 2. Require tags and reviews to attach to their nested owners, withdrawals to
 *    hide descendants, and metadata-only edits to preserve the ancestor
 *    fingerprint.
 * 3. Require blank lines, lexical boundaries, and mismatched indentation to leave
 *    tagged carriers unsupported instead of acknowledging a declaration.
 */
export async function test_ruby_embedded_comments(): Promise<void> {
  const source = dedent`
    class Sale
    =begin rdoc
    계약 💎
    @evidence docs/spec.md#create Documents creation.
    =end
      class Create
    =begin
    @evidence docs/spec.md#title Documents the title.
    @evidenceReview docs/spec.md#title #abcdef0 Reviewed the title.
    =end
        attr_reader :title
      end
    =begin
    @internal Withdraws the nested owner.
    =end
      class Retired
        attr_reader :old
      end
    end
  `;
  const adapter = new EvidenceRubyAdapter();
  for (const content of [
    source,
    source.replaceAll("\n", "\r\n"),
    source.replaceAll("  ", "\t"),
  ]) {
    const inventory = await adapter.analyze(
      EvidenceTestSourceSnapshot.create("lib/sale.rb", content),
    );
    const units = new Map(
      inventory.units.map((unit) => [unit.id, unit.identity.join(".")]),
    );
    const hosts = new Map(
      inventory.hosts.map((host) => [
        host.id,
        host.unitIds.map((id) => units.get(id)),
      ]),
    );

    TestValidator.equals(
      "nested embedded documentation owners",
      inventory.declarations
        .map((item) => ({
          target: item.target,
          owners: hosts.get(item.hostId),
        }))
        .sort((a, b) => a.target.localeCompare(b.target)),
      [
        { target: "docs/spec.md#create", owners: ["Sale.Create"] },
        { target: "docs/spec.md#title", owners: ["Sale.Create.title"] },
      ],
    );
    TestValidator.equals(
      "embedded documentation is complete",
      inventory.diagnostics,
      [],
    );
    TestValidator.equals(
      "embedded review retains the field host",
      inventory.reviews[0]?.hostId,
      inventory.declarations.find(
        (item) => item.target === "docs/spec.md#title",
      )?.hostId,
    );
    TestValidator.equals(
      "embedded withdrawal keeps its owner",
      new EvidenceInventory([inventory])
        .select(inventory.units.map((unit) => unit.id))
        .hidden.map((unit) => unit.identity.join("."))
        .sort((a, b) => a.localeCompare(b)),
      ["Sale.Retired", "Sale.Retired.old"],
    );
    for (const item of inventory.declarations)
      TestValidator.equals(
        "original tag coordinates",
        item.location.range?.start?.offset,
        content.indexOf(`@evidence ${item.target}`),
      );
    const edited = await adapter.analyze(
      EvidenceTestSourceSnapshot.create(
        "lib/sale.rb",
        content.replace(
          "Documents the title.",
          "Records the same title contract.",
        ),
      ),
    );
    const changed = await adapter.analyze(
      EvidenceTestSourceSnapshot.create(
        "lib/sale.rb",
        content.replace("attr_reader :title", "attr_accessor :title"),
      ),
    );
    const sale = inventory.units.find((unit) => unit.name === "Sale");
    if (sale === undefined) throw new Error("Missing Sale.");
    TestValidator.equals(
      "nested metadata does not stale ancestor reviews",
      EvidenceFingerprint.inspect(inventory, sale.id).fingerprint,
      EvidenceFingerprint.inspect(edited, sale.id).fingerprint,
    );
    TestValidator.notEquals(
      "nested declaration edits stale ancestor reviews",
      EvidenceFingerprint.inspect(inventory, sale.id).fingerprint,
      EvidenceFingerprint.inspect(changed, sale.id).fingerprint,
    );
  }

  // Blank lines, an intervening end, and mismatched line-comment indentation still break attachment.
  for (const content of [
    "class Sale\n=begin\n@evidence docs/spec.md#detached Detached documentation.\n=end\n\n  class Child; end\nend\n",
    "class Sale\n=begin\n@evidence docs/spec.md#boundary Must not escape the class.\n=end\nend\nclass Other; end\n",
    "class Sale\n# @evidence docs/spec.md#indent A line comment must match indentation.\n  class Child; end\nend\n",
  ]) {
    const inventory = await adapter.analyze(
      EvidenceTestSourceSnapshot.create("lib/sale.rb", content),
    );
    TestValidator.equals(
      "unsupported comment does not acknowledge",
      inventory.declarations,
      [],
    );
    TestValidator.equals(
      "unsupported comment stays visible",
      inventory.diagnostics.map((item) => item.code),
      ["unsupported-annotation-host"],
    );
  }
}
