import { EvidenceRubyAdapter } from "@wrtnlabs/evidence";
import type { EvidenceTargetResolutionStatus } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestGraph } from "../../internal/TestGraph";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

interface IRubyTargetStatus {
  target: string | undefined;
  status: EvidenceTargetResolutionStatus;
}

/** Resolves Ruby containers, method sides, attributes, setters, and operators. */
export async function test_ruby_targets(): Promise<void> {
  const adapter = new EvidenceRubyAdapter();
  const reference = await adapter.analyze(
    TestSourceSnapshot.create(
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
    TestSourceSnapshot.create(
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
  const resolutions = await TestGraph.resolveDeclarations(
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
    (<IRubyTargetStatus[]>[
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
  left: IRubyTargetStatus,
  right: IRubyTargetStatus,
): number {
  return compare(left.target ?? "", right.target ?? "");
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
