import { EvidPythonAdapter } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestGraph } from "../../internal/TestGraph";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/**
 * Resolves canonical file-qualified targets for Python declarations.
 *
 * The reference and claim snapshots use a type, class property, instance method, and module function to test target parsing against the same public address model used by graph resolution.
 *
 * 1. Analyze the Python reference and TypeScript claim inventories.
 * 2. Resolve each canonical target and verify every resolution succeeds.
 * 3. Verify the resolved units have the expected type, property, method, and function identities.
 */
export async function test_python_targets(): Promise<void> {
  const adapter = new EvidPythonAdapter();
  const reference = await adapter.analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "src/sale.py",
        dedent`
          class Sale:
              currency = "USD"

              def total(self):
                  return 0
        `,
      ),
      TestSourceSnapshot.create(
        "src/calculator.py",
        dedent`
          def add(left, right):
              return left + right
        `,
      ),
    ]),
  );
  const claim = await adapter.analyze(
    TestSourceSnapshot.create(
      "test/test_sale.py",
      dedent`
        def verify():
            """
            @evid ../src/sale.py#Sale Verifies the type.
            @evid ../src/sale.py#Sale.currency Verifies the class attribute.
            @evid ../src/sale.py#Sale.prototype.total Verifies the instance method.
            @evid ../src/calculator.py#add Verifies the function.
            """
            return None
      `,
    ),
  );
  const resolutions = await TestGraph.resolveDeclarations(
    claim,
    reference,
    reference.units.map((unit) => unit.id),
  );

  TestValidator.equals(
    "resolved Python targets",
    resolutions.map((resolution) => resolution.resolution.status),
    ["resolved", "resolved", "resolved", "resolved"],
  );
  TestValidator.equals(
    "resolved Python identities",
    resolutions
      .flatMap((resolution) => {
        const unit = resolution.resolution.units[0];
        return unit === undefined ? [] : [unit.identity.join(".")];
      })
      .sort(compare),
    ["Sale", "Sale.currency", "Sale.prototype.total", "add"].sort(compare),
  );
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
