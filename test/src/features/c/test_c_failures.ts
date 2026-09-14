import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceCAdapter } from "../../../../packages/evidence/src/adapters/c/EvidenceCAdapter";
import type { IEvidenceInventory } from "../../../../packages/evidence/src/structures/IEvidenceInventory";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Reports C preprocessing, declaration conflicts, and malformed syntax. */
export async function test_c_failures(): Promise<void> {
  const adapter = new EvidenceCAdapter();

  // Conditional branches are not treated as simultaneous declarations.
  const conditional = await adapter.analyze(
    TestSourceSnapshot.create(
      "include/conditional.h",
      dedent`
        #if DEBUG
        int debug_value;
        #else
        int release_value;
        #endif
      `,
    ),
  );
  TestValidator.equals("conditional C source", conditional.complete, false);
  TestValidator.equals(
    "C conditional diagnostic",
    hasCode(conditional, "c-preprocessor-conditional"),
    true,
  );
  TestValidator.equals("conditional C units", conditional.units, []);

  // Declaration-position calls may be macros that generate any public form.
  const macro = await adapter.analyze(
    TestSourceSnapshot.create(
      "include/macro.h",
      dedent`
        #define DECLARE_API(TYPE, NAME) TYPE NAME(void)
        DECLARE_API(int, generated);
      `,
    ),
  );
  TestValidator.equals("macro-generated C source", macro.complete, false);
  TestValidator.equals(
    "C macro diagnostic",
    hasCode(macro, "c-macro-declaration"),
    true,
  );

  // ABI-changing pragmas cannot disappear from a healthy declared surface.
  const pragma = await adapter.analyze(
    TestSourceSnapshot.create(
      "include/packed.h",
      dedent`
        #pragma pack(push, 1)
        struct Packed { int value; };
        #pragma pack(pop)
      ` + "\n",
    ),
  );
  TestValidator.equals("semantic C pragma", pragma.complete, false);
  TestValidator.equals(
    "C pragma diagnostic",
    hasCode(pragma, "c-preprocessor-directive"),
    true,
  );

  // Multiple definitions cannot form one function or tag family.
  const definitions = await adapter.analyze(
    TestSourceSnapshot.create(
      "src/duplicates.c",
      dedent`
        int run(void) { return 1; }
        int run(void) { return 2; }

        struct Record { int first; };
        struct Record { int second; };
      `,
    ),
  );
  TestValidator.equals("duplicate C definitions", definitions.complete, false);
  TestValidator.equals(
    "C definition conflict diagnostic",
    hasCode(definitions, "c-declaration-conflict"),
    true,
  );

  // C tag kinds share one namespace and ordinary names cannot change entity kind.
  const names = await adapter.analyze(
    TestSourceSnapshot.create(
      "include/names.h",
      dedent`
        struct Shared;
        union Shared;

        int value(void);
        extern int value;
      `,
    ),
  );
  TestValidator.equals("conflicting C names", names.complete, false);
  TestValidator.equals(
    "C tag conflict diagnostic",
    hasCode(names, "c-tag-conflict"),
    true,
  );
  TestValidator.equals(
    "C ordinary name conflict diagnostic",
    hasCode(names, "c-declaration-conflict"),
    true,
  );

  // Macro definitions alone do not imply generated declarations.
  const definitionOnly = await adapter.analyze(
    TestSourceSnapshot.create(
      "include/definitions.h",
      dedent`
        #define VALUE 1
        int explicit_value;
      ` + "\n",
    ),
  );
  TestValidator.equals(
    "explicit C declaration after macros",
    definitionOnly.complete,
    true,
  );
  TestValidator.equals(
    "explicit C declaration unit",
    definitionOnly.units.map((unit) => unit.name),
    ["explicit_value"],
  );

  // Tree-sitter syntax errors never become a healthy partial inventory.
  const malformed = await adapter.analyze(
    TestSourceSnapshot.create("src/broken.c", "int broken( { return 0; }\n"),
  );
  TestValidator.equals("malformed C source", malformed.complete, false);
  TestValidator.equals(
    "C parse diagnostic",
    malformed.diagnostics.some((diagnostic) =>
      diagnostic.code.startsWith("c-parse-"),
    ),
    true,
  );
}

function hasCode(inventory: IEvidenceInventory, code: string): boolean {
  return inventory.diagnostics.some((diagnostic) => diagnostic.code === code);
}
