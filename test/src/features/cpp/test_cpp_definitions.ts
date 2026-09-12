import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceCppAdapter } from "../../../../packages/evidence/src/EvidenceCppAdapter";
import type { IEvidenceInventory } from "../../../../packages/evidence/src/structures/IEvidenceInventory";
import type { IEvidenceUnit } from "../../../../packages/evidence/src/structures/IEvidenceUnit";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Merges C++ declarations, overloads, and qualified definitions by identity. */
export async function test_cpp_definitions(): Promise<void> {
  const inventory = await new EvidenceCppAdapter().analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "include/shop.hpp",
        dedent`
          namespace shop {
              class Sale {
              public:
                  Sale();
                  ~Sale();
                  int total() const;
                  int total(int tax) const;
                  static int count;
                  int value;
              };

              int open(int value);

              template <class T>
              class Box {
              public:
                  T get() const;
              };

              template <class... Types>
              class Pack {
              public:
                  void visit();
              };
          }
        `,
      ),
      TestSourceSnapshot.create(
        "src/shop.cpp",
        dedent`
          namespace shop {
              Sale::Sale() {}
              Sale::~Sale() {}

              int Sale::total() const { return value; }
              int Sale::total(int tax) const { return value + tax; }
              int Sale::count = 0;

              int open(int value) { return value; }

              template <class T>
              T Box<T>::get() const { return T{}; }

              template <class... Types>
              void Pack<Types...>::visit() {}
          }
        `,
      ),
    ]),
  );

  TestValidator.equals("complete C++ definitions", inventory.diagnostics, []);

  // Header declarations and source definitions contribute sites to one unit.
  TestValidator.equals(
    "C++ constructor declaration and definition",
    requireUnit(inventory, "shop.Sale.constructor").sites.length,
    2,
  );
  TestValidator.equals(
    "C++ destructor declaration and definition",
    requireUnit(inventory, "shop.Sale.destructor").sites.length,
    2,
  );
  TestValidator.equals(
    "C++ overload declaration and definition family",
    requireUnit(inventory, "shop.Sale.total").sites.length,
    4,
  );
  TestValidator.equals(
    "C++ static data declaration and definition",
    requireUnit(inventory, "shop.Sale.count").sites.length,
    2,
  );
  TestValidator.equals(
    "C++ free function declaration and definition",
    requireUnit(inventory, "shop.open").sites.length,
    2,
  );

  // A template owner keeps its arity in an out-of-class member definition.
  const templateMethod = requireUnit(inventory, "shop.Box`1.get");
  TestValidator.equals(
    "C++ template method sites",
    templateMethod.sites.length,
    2,
  );
  TestValidator.equals(
    "C++ template method parent",
    templateMethod.parentId,
    requireUnit(inventory, "shop.Box`1").id,
  );
  TestValidator.equals(
    "C++ parameter-pack owner",
    requireUnit(inventory, "shop.Pack`1.visit").sites.length,
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
  if (unit === undefined) throw new Error(`Missing C++ unit: ${identity}`);
  return unit;
}
