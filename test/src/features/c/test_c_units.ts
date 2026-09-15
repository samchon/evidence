import { EvidenceCAdapter, EvidenceLanguageRegistry } from "evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Classifies the public C surface across tags, aliases, callables, objects, and
 * members.
 *
 * The inventory must retain each distinct declaration category so coverage
 * cannot omit public aggregate structure.
 *
 * 1. Analyze C declarations for tags, typedefs, functions, objects, fields, and
 *    enumerators.
 * 2. Compare the selected unit symbols and full identities.
 * 3. Verify members retain their aggregate owner.
 */
export async function test_c_units(): Promise<void> {
  // Certified metadata describes the exact grammar and explicit-source boundary.
  const language = EvidenceLanguageRegistry.list().find(
    (entry) => entry.type === "c",
  );
  if (language === undefined) throw new Error("Missing C language metadata.");
  if (language.adapter === undefined)
    throw new Error("Missing C adapter metadata.");
  TestValidator.equals(
    "certified C adapter",
    language.adapter.entry,
    "EvidenceCAdapter",
  );
  TestValidator.equals(
    "published C grammar version",
    language.adapter.publicSurface.includes("tree-sitter-c v0.24.2"),
    true,
  );

  const inventory = await new EvidenceCAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "include/shop.h",
      dedent`
        typedef struct Sale {
            int total, tax;
            union {
                int gross;
                long net;
            };
            struct {
                int hidden;
            } named;
            unsigned ready : 1, state : 3;
        } Sale, *SalePointer;

        union Payload {
            int number;
        };

        enum State {
            READY,
            STOPPED = 2,
        };

        typedef enum {
            OFF,
            ON,
        } Switch;

        typedef int Handler(int value), (*HandlerPointer)(int value);

        extern const int external;
        int tentative;
        int initialized = 1;
        int values[4], (*callbacks[2])(int value);
        int (*callback)(int value);

        int add(int value);
        int *make(void);
        __attribute__((used)) int decorated(void);

        _Static_assert(sizeof(int) > 0, "int must have storage");

        static int hidden_object;
        static int hidden_function(void);
      `,
    ),
  );

  // Static declarations and fields of a named anonymous aggregate stay outside.
  TestValidator.equals("complete C units", inventory.diagnostics, []);
  TestValidator.equals(
    "C declaration units",
    inventory.units
      .map((unit) => `${unit.symbol}:${unit.identity.join(".")}`)
      .sort(compare),
    [
      "function:add",
      "function:decorated",
      "function:make",
      "property:callback",
      "property:callbacks",
      "property:enum State.READY",
      "property:enum State.STOPPED",
      "property:external",
      "property:initialized",
      "property:Switch.OFF",
      "property:Switch.ON",
      "property:struct Sale.gross",
      "property:struct Sale.named",
      "property:struct Sale.net",
      "property:struct Sale.ready",
      "property:struct Sale.state",
      "property:struct Sale.tax",
      "property:struct Sale.total",
      "property:tentative",
      "property:union Payload.number",
      "property:values",
      "type:Handler",
      "type:HandlerPointer",
      "type:SalePointer",
      "type:Switch",
      "type:enum State",
      "type:struct Sale",
      "type:union Payload",
    ].sort(compare),
  );
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
