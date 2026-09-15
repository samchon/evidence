import { EvidCppAdapter } from "evid";
import type { IEvidInventory, IEvidUnit } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/** Merges compatible C++ declarations and definitions into their semantic identities.
 *
 * A callable family may appear as declarations, overloads, and qualified out-of-class definitions, all of which must contribute sites to one owner.
 *
 * 1. Analyze class and namespace declarations with matching qualified definitions.
 * 2. Compare the resulting callable identities and their declaration-site counts.
 * 3. Require overload families to remain separate from unrelated names.
 */
export async function test_cpp_definitions(): Promise<void> {
  const inventory = await new EvidCppAdapter().analyze(
    EvidTestSourceSnapshot.combine([
      EvidTestSourceSnapshot.create(
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
      EvidTestSourceSnapshot.create(
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
  inventory: IEvidInventory,
  identity: string,
): IEvidUnit {
  const unit = inventory.units.find(
    (candidate) => candidate.identity.join(".") === identity,
  );
  if (unit === undefined) throw new Error(`Missing C++ unit: ${identity}`);
  return unit;
}
