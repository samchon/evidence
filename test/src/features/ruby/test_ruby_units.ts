import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceLanguageRegistry } from "../../../../packages/evidence/src/EvidenceLanguageRegistry";
import { EvidenceRubyAdapter } from "../../../../packages/evidence/src/EvidenceRubyAdapter";
import type { IEvidenceInventory } from "../../../../packages/evidence/src/structures/IEvidenceInventory";
import type { IEvidenceUnit } from "../../../../packages/evidence/src/structures/IEvidenceUnit";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Classifies Ruby reopenings, visibility, method sides, constants, and attributes. */
export async function test_ruby_units(): Promise<void> {
  // Certified metadata identifies the pinned grammar and declared source boundary.
  const language = EvidenceLanguageRegistry.list().find(
    (entry) => entry.type === "ruby",
  );
  if (language?.adapter === undefined)
    throw new Error("Missing Ruby adapter metadata.");
  TestValidator.equals(
    "certified Ruby adapter",
    language.adapter.entry,
    "EvidenceRubyAdapter",
  );
  TestValidator.equals(
    "published Ruby grammar version",
    language.adapter.publicSurface.includes("tree-sitter-ruby v0.23.1"),
    true,
  );

  const inventory = await new EvidenceRubyAdapter().analyze(
    TestSourceSnapshot.create(
      "lib/shop.rb",
      dedent`
        module Shop
          class Sale
            attr_reader :name
            attr_writer :secret
            attr_accessor :status

            def total; 1; end
            def price=(value); value; end
            def [](key); key; end

            private
            def hidden; end
            attr_reader :private_attribute

            public :hidden
            private :price=

            def self.find; end
            private_class_method :find
            public_class_method :find

            def wrapped; end
            private def self.wrapped; end

            class << self
              attr_reader :version

              private
              def concealed; end

              public
              def list; end
            end

            VALUE = 1
            PRIVATE_VALUE = 2
            private_constant :PRIVATE_VALUE
          end

          module Utils
            module_function
            def parse; end

            public
            def instance_only; end

            def helper; end
            module_function :helper

            def original; end
            alias copy original
            alias_method :second_copy, :original
          end
        end

        module Shop
          class Sale
            class Nested; end
          end
        end

        TOP = 1
        def top_level; end
      `,
    ),
  );

  TestValidator.equals("complete Ruby units", inventory.diagnostics, []);
  TestValidator.equals(
    "Ruby declaration units",
    inventory.units
      .map((unit) => `${unit.symbol}:${unit.identity.join(".")}`)
      .sort(compare),
    [
      "function:Shop.Sale.[]",
      "function:Shop.Sale.hidden",
      "function:Shop.Sale.self.find",
      "function:Shop.Sale.self.list",
      "function:Shop.Sale.self.wrapped",
      "function:Shop.Sale.total",
      "function:Shop.Utils.copy",
      "function:Shop.Utils.instance_only",
      "function:Shop.Utils.original",
      "function:Shop.Utils.second_copy",
      "function:Shop.Utils.self.helper",
      "function:Shop.Utils.self.parse",
      "property:Shop.Sale.name",
      "property:Shop.Sale.secret",
      "property:Shop.Sale.self.version",
      "property:Shop.Sale.status",
      "property:Shop.Sale.VALUE",
      "property:TOP",
      "type:Shop",
      "type:Shop.Sale",
      "type:Shop.Sale.Nested",
      "type:Shop.Utils",
    ].sort(compare),
  );

  // Reopened containers retain every declaration site and explicit hierarchy.
  const shop = requireUnit(inventory, "Shop");
  const sale = requireUnit(inventory, "Shop.Sale");
  const nested = requireUnit(inventory, "Shop.Sale.Nested");
  TestValidator.equals("reopened Ruby module sites", shop.sites.length, 2);
  TestValidator.equals("reopened Ruby class sites", sale.sites.length, 2);
  TestValidator.equals("Ruby class parent", sale.parentId, shop.id);
  TestValidator.equals("Ruby nested class parent", nested.parentId, sale.id);

  // One attr_accessor call retains both capabilities on one property site.
  const status = requireUnit(inventory, "Shop.Sale.status");
  TestValidator.equals("Ruby accessor property site", status.sites.length, 1);
}

function requireUnit(
  inventory: IEvidenceInventory,
  identity: string,
): IEvidenceUnit {
  const unit = inventory.units.find(
    (candidate) => candidate.identity.join(".") === identity,
  );
  if (unit === undefined) throw new Error(`Missing Ruby unit: ${identity}`);
  return unit;
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
