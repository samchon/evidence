import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceCppAdapter } from "../../../../packages/evidence/src/adapters/cpp/EvidenceCppAdapter";
import type { EvidenceTargetResolutionStatus } from "../../../../packages/evidence/src/typings/EvidenceTargetResolutionStatus";
import { TestGraph } from "../../internal/TestGraph";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

interface ICppTargetStatus {
  target: string | undefined;
  status: EvidenceTargetResolutionStatus;
}

/** Resolves C++ namespaces, templates, callable names, and bounded aliases. */
export async function test_cpp_targets(): Promise<void> {
  const adapter = new EvidenceCppAdapter();
  const reference = await adapter.analyze(
    TestSourceSnapshot.create(
      "include/models.hpp",
      dedent`
        namespace shop {
            class Sale {
            public:
                Sale();
                ~Sale();
                int total() const;
                operator bool() const;
                Sale operator +(const Sale &) const;
            };

            template <class T>
            struct Box {
                T value;
            };
        }

        namespace public_api {
            using shop::Sale;
        }

        namespace public_alias = shop;
      `,
    ),
  );
  const claim = await adapter.analyze(
    TestSourceSnapshot.create(
      "test/verify.cpp",
      dedent`
        /**
         * @evidence ../include/models.hpp#shop.Sale Verifies the class.
         * @evidence ../include/models.hpp#shop.Sale.constructor Verifies construction.
         * @evidence ../include/models.hpp#shop.Sale.destructor Verifies destruction.
         * @evidence ../include/models.hpp#shop.Sale.total Verifies the method family.
         * @evidence ../include/models.hpp#shop.Sale["operator bool"] Verifies conversion.
         * @evidence ../include/models.hpp#shop.Sale["operator +"] Verifies the operator.
         * @evidence ../include/models.hpp#shop["Box\`1"] Verifies template arity.
         * @evidence ../include/models.hpp#shop["Box\`1"].value Verifies the template member.
         * @evidence ../include/models.hpp#public_api.Sale.total Verifies a using declaration.
         * @evidence ../include/models.hpp#public_alias["Box\`1"].value Verifies a namespace alias.
         * @evidence ../include/models.hpp#shop.Box.value Does not erase template arity.
         */
        void verify() {}
      `,
    ),
  );

  TestValidator.equals(
    "complete C++ target reference",
    reference.diagnostics,
    [],
  );
  TestValidator.equals("complete C++ target claim", claim.diagnostics, []);
  const resolutions = await TestGraph.resolveDeclarations(
    claim,
    reference,
    reference.units.map((unit) => unit.id),
  );

  TestValidator.equals(
    "C++ target statuses",
    resolutions
      .map((resolution) => ({
        target: claim.declarations.find(
          (declaration) => declaration.id === resolution.declarationId,
        )?.target,
        status: resolution.resolution.status,
      }))
      .sort(compareTarget),
    (<ICppTargetStatus[]>[
      {
        target: "../include/models.hpp#public_api.Sale.total",
        status: "resolved",
      },
      {
        target: '../include/models.hpp#public_alias["Box`1"].value',
        status: "resolved",
      },
      { target: '../include/models.hpp#shop["Box`1"]', status: "resolved" },
      {
        target: '../include/models.hpp#shop["Box`1"].value',
        status: "resolved",
      },
      {
        target: "../include/models.hpp#shop.Box.value",
        status: "missing-member",
      },
      { target: "../include/models.hpp#shop.Sale", status: "resolved" },
      {
        target: '../include/models.hpp#shop.Sale["operator +"]',
        status: "resolved",
      },
      {
        target: '../include/models.hpp#shop.Sale["operator bool"]',
        status: "resolved",
      },
      {
        target: "../include/models.hpp#shop.Sale.constructor",
        status: "resolved",
      },
      {
        target: "../include/models.hpp#shop.Sale.destructor",
        status: "resolved",
      },
      { target: "../include/models.hpp#shop.Sale.total", status: "resolved" },
    ]).sort(compareTarget),
  );
}

function compareTarget(
  left: ICppTargetStatus,
  right: ICppTargetStatus,
): number {
  return compare(left.target ?? "", right.target ?? "");
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
