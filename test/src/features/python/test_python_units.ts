import { EvidenceLanguageRegistry, EvidencePythonAdapter } from "evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Classifies Python declarations with distinct class and instance ownership.
 *
 * The source fixture combines module declarations, classes, methods, class
 * fields, instance fields, properties, aliases, and hidden forms while language
 * metadata supplies the configured adapter contract.
 *
 * 1. Verify the registered Python language metadata names the expected adapter.
 * 2. Analyze the fixture and verify exact public unit identities and symbols.
 * 3. Verify hidden and local declarations are excluded while class and instance
 *    members retain separate addresses.
 */
export async function test_python_units(): Promise<void> {
  const language = EvidenceLanguageRegistry.list().find(
    (entry) => entry.type === "python",
  );
  if (language === undefined)
    throw new Error("Missing Python language metadata.");
  TestValidator.equals(
    "certified Python adapter",
    language.adapter?.entry,
    "EvidencePythonAdapter",
  );

  const inventory = await new EvidencePythonAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "src/sale.py",
      dedent`
        type JsonValue = dict[str, str]
        VERSION: str = "v1"
        _private_value = 1

        async def fetch():
            return None

        def outer():
            def nested_helper():
                return None
            return nested_helper

        class Sale:
            class Detail:
                pass

            currency: str
            kind = "sale"
            status = "new"

            @staticmethod
            def parse(value):
                return value

            @classmethod
            async def load(cls):
                return cls()

            def total(self):
                return self.quantity

            @property
            def amount(self):
                return self.quantity

            @amount.setter
            def amount(self, value):
                self.quantity = value

            def __init__(self):
                self.quantity: int = 1
                self.note = "new"
                self.status = "instance"

            def _helper(self):
                return None
      `,
    ),
  );

  TestValidator.equals(
    "Python declaration units",
    inventory.units
      .map((unit) => `${unit.symbol}:${unit.identity.join(".")}`)
      .sort(compare),
    [
      "function:Sale.load",
      "function:Sale.parse",
      "function:Sale.prototype.total",
      "function:fetch",
      "function:outer",
      "property:Sale.currency",
      "property:Sale.kind",
      "property:Sale.prototype.amount",
      "property:Sale.prototype.note",
      "property:Sale.prototype.quantity",
      "property:Sale.prototype.status",
      "property:Sale.status",
      "property:VERSION",
      "type:JsonValue",
      "type:Sale",
      "type:Sale.Detail",
    ].sort(compare),
  );

  // A property getter and setter retain one identity with both declaration sites.
  const amount = inventory.units.find(
    (unit) => unit.identity.join(".") === "Sale.prototype.amount",
  );
  if (amount === undefined) throw new Error("Missing Python property unit.");
  TestValidator.equals("property accessor sites", amount.sites.length, 2);
  TestValidator.equals("complete Python inventory", inventory.diagnostics, []);
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
