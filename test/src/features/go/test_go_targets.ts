import { EvidenceGoAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestGraph } from "../../internal/TestGraph";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Resolves Go functions and receiver methods through actual declaration and owner files. */
export async function test_go_targets(): Promise<void> {
  const adapter = new EvidenceGoAdapter();
  const reference = await adapter.analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "src/sale.go",
        dedent`
          package shop

          type Sale struct {
              Total int
          }
        ` + "\n",
      ),
      TestSourceSnapshot.create(
        "src/methods.go",
        dedent`
          package shop

          func (Sale) Calculate() int {
              return 0
          }

          func Add(left, right int) int {
              return left + right
          }
        `,
      ),
    ]),
  );
  const claim = await adapter.analyze(
    TestSourceSnapshot.create(
      "test/sale_test.go",
      dedent`
        package shop_test

        // @evidence ../src/sale.go#Sale Verifies the type.
        // @evidence ../src/sale.go#Sale.Total Verifies the field.
        // @evidence ../src/sale.go#Sale.Calculate Verifies the owner-file method alias.
        // @evidence ../src/methods.go#Sale.Calculate Verifies the declaration-file method.
        // @evidence ../src/methods.go#Add Verifies the function.
        func Verify() {}
      `,
    ),
  );
  TestValidator.equals("complete Go reference", reference.diagnostics, []);
  TestValidator.equals("complete Go claim", claim.diagnostics, []);
  const resolutions = await TestGraph.resolveDeclarations(
    claim,
    reference,
    reference.units.map((unit) => unit.id),
  );

  TestValidator.equals(
    "resolved Go targets",
    resolutions.map((resolution) => resolution.resolution.status),
    ["resolved", "resolved", "resolved", "resolved", "resolved"],
  );
  TestValidator.equals(
    "resolved Go method identity",
    new Set(
      resolutions
        .flatMap((resolution) => resolution.resolution.units)
        .filter((unit) => unit.name === "Calculate")
        .map((unit) => unit.id),
    ).size,
    1,
  );
}
