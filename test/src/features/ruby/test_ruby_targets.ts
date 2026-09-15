import { EvidRubyAdapter } from "evid";
import type { EvidTargetResolutionStatus } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestGraph } from "../../internal/EvidTestGraph";
import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

interface IEvidRubyTargetStatus {
  target: string | undefined;
  status: EvidTargetResolutionStatus;
}

/**
 * Resolves Ruby containers, method sides, attributes, setters, and operators.
 *
 * Ruby target spelling must preserve the owning container and callable form.
 *
 * 1. Build a Ruby reference inventory containing containers, instance and
 *    singleton methods, attributes, setters, and operators.
 * 2. Resolve claim tags against every supported spelling and require resolved
 *    statuses and their intended public units.
 */
export async function test_ruby_targets(): Promise<void> {
  const adapter = new EvidRubyAdapter();
  const reference = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "lib/shop/sale.rb",
      dedent`
        module Shop
          class Sale
            attr_accessor :status

            def total; end
            def price=(value); end
            def [](key); end
            def self.find; end
          end
        end
      `,
    ),
  );
  const claim = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "test/verify.rb",
      dedent`
        module Verify
          # @evidence ../lib/shop/sale.rb#Shop.Sale Verifies the class.
          # @evidence ../lib/shop/sale.rb#Shop.Sale.total Verifies the instance method.
          # @evidence ../lib/shop/sale.rb#Shop.Sale.self.find Verifies the singleton method.
          # @evidence ../lib/shop/sale.rb#Shop.Sale.status Verifies the attribute.
          # @evidence ../lib/shop/sale.rb#Shop.Sale["price="] Verifies the setter.
          # @evidence ../lib/shop/sale.rb#Shop.Sale["[]"] Verifies the operator.
          # @evidence ../lib/shop/sale.rb#Shop.Sale.find Does not erase the method side.
          def run; end
        end
      `,
    ),
  );

  TestValidator.equals(
    "complete Ruby target reference",
    reference.diagnostics,
    [],
  );
  TestValidator.equals("complete Ruby target claim", claim.diagnostics, []);
  const resolutions = await EvidTestGraph.resolveDeclarations(
    claim,
    reference,
    reference.units.map((unit) => unit.id),
  );

  TestValidator.equals(
    "Ruby target statuses",
    resolutions
      .map((resolution) => ({
        target: claim.declarations.find(
          (declaration) => declaration.id === resolution.declarationId,
        )?.target,
        status: resolution.resolution.status,
      }))
      .sort(compareTarget),
    (<IEvidRubyTargetStatus[]>[
      {
        target: '../lib/shop/sale.rb#Shop.Sale["[]"]',
        status: "resolved",
      },
      {
        target: '../lib/shop/sale.rb#Shop.Sale["price="]',
        status: "resolved",
      },
      {
        target: "../lib/shop/sale.rb#Shop.Sale",
        status: "resolved",
      },
      {
        target: "../lib/shop/sale.rb#Shop.Sale.find",
        status: "missing-member",
      },
      {
        target: "../lib/shop/sale.rb#Shop.Sale.self.find",
        status: "resolved",
      },
      {
        target: "../lib/shop/sale.rb#Shop.Sale.status",
        status: "resolved",
      },
      {
        target: "../lib/shop/sale.rb#Shop.Sale.total",
        status: "resolved",
      },
    ]).sort(compareTarget),
  );
}

function compareTarget(
  left: IEvidRubyTargetStatus,
  right: IEvidRubyTargetStatus,
): number {
  return compare(left.target ?? "", right.target ?? "");
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
