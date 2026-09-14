import { EvidenceRubyAdapter } from "@wrtnlabs/evidence";
import type { IEvidenceInventory, IEvidenceUnit } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Merges compatible Ruby reopenings while retaining replacement conflicts.
 *
 * Reopened declarations can share identity, but incompatible definitions must remain incomplete.
 *
 * 1. Analyze compatible reopenings and conflicting replacements.
 * 2. Verify merged units and conflict diagnostics.
 */
export async function test_ruby_definitions(): Promise<void> {
  const compatible = await new EvidenceRubyAdapter().analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "lib/shop/sale.rb",
        dedent`
          module Shop
            class Sale < Record
              def total; 1; end
            end
          end
        `,
      ),
      TestSourceSnapshot.create(
        "lib/shop/sale_extensions.rb",
        dedent`
          module Shop
            class Sale
              def currency; "USD"; end
            end
          end
        `,
      ),
    ]),
  );

  TestValidator.equals(
    "compatible Ruby reopenings",
    compatible.diagnostics,
    [],
  );
  TestValidator.equals(
    "reopened Ruby class sites",
    requireUnit(compatible, "Shop.Sale").sites.length,
    2,
  );

  const conflicting = await new EvidenceRubyAdapter().analyze(
    TestSourceSnapshot.create(
      "lib/conflicts.rb",
      dedent`
        module Conflict
          class Entry < First
            VALUE = 1
            attr_reader :name
            def run; 1; end
          end
        end

        module Conflict
          module Entry
            VALUE = 2
            attr_reader :name
            def run; 2; end
          end
        end

        class Collision
          attr_reader :status
          def status; :ready; end
        end

        class Parent < First; end
        class Parent < Second; end
      `,
    ),
  );
  const codes = new Set(
    conflicting.diagnostics.map((diagnostic) => diagnostic.code),
  );

  // Runtime replacements stay represented by all sites while completeness fails.
  TestValidator.equals(
    "conflicting Ruby inventory",
    conflicting.complete,
    false,
  );
  for (const code of [
    "ruby-address-conflict",
    "ruby-attribute-redefinition",
    "ruby-constant-redefinition",
    "ruby-container-kind",
    "ruby-method-redefinition",
    "ruby-superclass-conflict",
  ])
    TestValidator.predicate(`Ruby conflict ${code}`, codes.has(code));
  TestValidator.equals(
    "redefined Ruby method sites",
    requireUnit(conflicting, "Conflict.Entry.run").sites.length,
    2,
  );
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
