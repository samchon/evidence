import { EvidenceCppAdapter } from "@wrtnlabs/evidence";
import type { IEvidenceInventory } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Reports C++ preprocessing, specialization, lookup, and syntax boundaries as incomplete.
 *
 * Static extraction must decline to publish a complete surface when unsupported preprocessing or unresolved C++ forms change declaration meaning.
 *
 * 1. Analyze sources at preprocessing, specialization, qualified-lookup, and parse-error boundaries.
 * 2. Require each uncertain source to be incomplete.
 * 3. Require diagnostics to describe the rejected condition.
 */
export async function test_cpp_failures(): Promise<void> {
  const adapter = new EvidenceCppAdapter();

  // Conditional branches cannot be combined into one declared population.
  const conditional = await adapter.analyze(
    TestSourceSnapshot.create(
      "include/conditional.hpp",
      dedent`
        #if DEBUG
        int debug_value;
        #else
        int release_value;
        #endif
      `,
    ),
  );
  TestValidator.equals("conditional C++ source", conditional.complete, false);
  TestValidator.equals(
    "C++ conditional diagnostic",
    hasCode(conditional, "cpp-preprocessor-conditional"),
    true,
  );
  TestValidator.equals("conditional C++ units", conditional.units, []);

  // The pinned grammar rejects a declaration-position macro invocation.
  const macro = await adapter.analyze(
    TestSourceSnapshot.create(
      "include/macro.hpp",
      dedent`
        #define DECLARE_API(TYPE, NAME) TYPE NAME()
        DECLARE_API(int, generated);
      `,
    ),
  );
  TestValidator.equals("macro-generated C++ source", macro.complete, false);
  TestValidator.equals(
    "C++ macro diagnostic",
    hasCode(macro, "cpp-parse-incomplete"),
    true,
  );

  // The pinned grammar rejects ABI-changing pragmas before extraction.
  const pragma = await adapter.analyze(
    TestSourceSnapshot.create(
      "include/packed.hpp",
      dedent`
        #pragma pack(push, 1)
        struct Packed { int value; };
        #pragma pack(pop)
      `,
    ),
  );
  TestValidator.equals("semantic C++ pragma", pragma.complete, false);
  TestValidator.equals(
    "C++ pragma diagnostic",
    hasCode(pragma, "cpp-parse-incomplete"),
    true,
  );

  // Specializations and instantiations need an address beyond template arity.
  const specialization = await adapter.analyze(
    TestSourceSnapshot.create(
      "include/specialization.hpp",
      dedent`
        template <class T>
        class Box {};

        template <>
        class Box<int> {};
      `,
    ),
  );
  TestValidator.equals(
    "specialized C++ source",
    specialization.complete,
    false,
  );
  TestValidator.equals(
    "C++ specialization diagnostic",
    hasCode(specialization, "cpp-template-specialization"),
    true,
  );

  const partial = await adapter.analyze(
    TestSourceSnapshot.create(
      "include/partial.hpp",
      dedent`
        template <class T>
        class Box {};

        template <class T>
        class Box<T *> {};
      `,
    ),
  );
  TestValidator.equals("partial C++ source", partial.complete, false);
  TestValidator.equals(
    "C++ partial specialization diagnostic",
    hasCode(partial, "cpp-template-specialization"),
    true,
  );

  // The grammar rejects explicit instantiation before it can share the primary.
  const instantiation = await adapter.analyze(
    TestSourceSnapshot.create(
      "include/instantiation.hpp",
      dedent`
        template <class T>
        class Box {};

        template class Box<long>;
      `,
    ),
  );
  TestValidator.equals(
    "instantiated C++ source",
    instantiation.complete,
    false,
  );
  TestValidator.equals(
    "C++ instantiation diagnostic",
    hasCode(instantiation, "cpp-parse-incomplete"),
    true,
  );

  // Inheritance, friends, and using-directives require semantic ownership.
  const lookup = await adapter.analyze(
    TestSourceSnapshot.create(
      "include/lookup.hpp",
      dedent`
        class Base {};

        class Derived : public Base {
        public:
            friend void inspect(Derived &);
        };

        namespace shop {}
        using namespace shop;
      `,
    ),
  );
  TestValidator.equals("semantic C++ lookup", lookup.complete, false);
  for (const code of [
    "cpp-inheritance-resolution",
    "cpp-friend-declaration",
    "cpp-using-directive",
  ])
    TestValidator.equals(`C++ ${code}`, hasCode(lookup, code), true);

  // Qualified definitions need a selected declaration that proves ownership.
  const qualified = await adapter.analyze(
    TestSourceSnapshot.create(
      "src/missing.cpp",
      "int Missing::run() { return 0; }\n",
    ),
  );
  TestValidator.equals("unowned C++ definition", qualified.complete, false);
  TestValidator.equals(
    "C++ qualified owner diagnostic",
    hasCode(qualified, "cpp-qualified-owner"),
    true,
  );

  // A bounded using declaration still has to resolve exactly one selected unit.
  const alias = await adapter.analyze(
    TestSourceSnapshot.create("include/alias.hpp", "using missing::Thing;\n"),
  );
  TestValidator.equals("unresolved C++ alias", alias.complete, false);
  TestValidator.equals(
    "C++ alias resolution diagnostic",
    hasCode(alias, "cpp-alias-resolution"),
    true,
  );

  // Multiple selected type definitions cannot form one declaration family.
  const duplicate = await adapter.analyze(
    TestSourceSnapshot.create(
      "include/duplicate.hpp",
      dedent`
        class Shared {};
        struct Shared {};
      `,
    ),
  );
  TestValidator.equals("duplicate C++ definitions", duplicate.complete, false);
  TestValidator.equals(
    "C++ declaration conflict diagnostic",
    hasCode(duplicate, "cpp-declaration-conflict"),
    true,
  );

  // Reserved callable addresses cannot absorb an unrelated method name.
  const callable = await adapter.analyze(
    TestSourceSnapshot.create(
      "include/callable.hpp",
      dedent`
        class Sale {
        public:
            Sale();
            int constructor();
        };
      `,
    ),
  );
  TestValidator.equals("colliding C++ callable", callable.complete, false);
  TestValidator.equals(
    "C++ callable address conflict",
    hasCode(callable, "cpp-declaration-conflict"),
    true,
  );

  // A static data declaration may still have only one selected definition.
  const staticData = await adapter.analyze(
    TestSourceSnapshot.create(
      "src/static-data.cpp",
      dedent`
        class Counters {
        public:
            static int value;
        };

        int Counters::value = 1;
        int Counters::value = 2;
      `,
    ),
  );
  TestValidator.equals("duplicate C++ static data", staticData.complete, false);
  TestValidator.equals(
    "C++ static data conflict",
    hasCode(staticData, "cpp-declaration-conflict"),
    true,
  );

  // Name-only families cannot assign qualified definitions across access levels.
  const overloadAccess = await adapter.analyze(
    TestSourceSnapshot.create(
      "src/overload-access.cpp",
      dedent`
        class Api {
        public:
            void run(int value);

        private:
            void run(double value);
        };

        void Api::run(int value) {}
        void Api::run(double value) {}
      `,
    ),
  );
  TestValidator.equals(
    "mixed-access C++ overloads",
    overloadAccess.complete,
    false,
  );
  TestValidator.equals(
    "C++ overload access diagnostic",
    hasCode(overloadAccess, "cpp-overload-access"),
    true,
  );

  // The pinned grammar rejects modules before any export can become a unit.
  const module = await adapter.analyze(
    TestSourceSnapshot.create(
      "src/shop.cppm",
      dedent`
        export module shop;
        export int run();
      `,
    ),
  );
  TestValidator.equals("C++ module source", module.complete, false);
  TestValidator.equals(
    "C++ module diagnostic",
    hasCode(module, "cpp-parse-incomplete"),
    true,
  );

  // Tree-sitter syntax errors never become a healthy partial inventory.
  const malformed = await adapter.analyze(
    TestSourceSnapshot.create(
      "src/broken.cpp",
      "class Broken { public: int run( { return 0; }\n",
    ),
  );
  TestValidator.equals("malformed C++ source", malformed.complete, false);
  TestValidator.equals(
    "C++ parse diagnostic",
    malformed.diagnostics.some((diagnostic) =>
      diagnostic.code.startsWith("cpp-parse-"),
    ),
    true,
  );
}

function hasCode(inventory: IEvidenceInventory, code: string): boolean {
  return inventory.diagnostics.some((diagnostic) => diagnostic.code === code);
}
