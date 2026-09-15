import { EvidGoAdapter } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestGraph } from "../../internal/EvidTestGraph";
import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/**
 * Resolves Go functions and receiver methods through declaration and owner
 * files.
 *
 * Receiver ownership and file-relative target paths determine the resolved
 * public declaration.
 *
 * 1. Analyze functions and receiver methods.
 * 2. Resolve supported targets.
 * 3. Require wrong owner or file paths to remain unresolved.
 */
export async function test_go_targets(): Promise<void> {
  const adapter = new EvidGoAdapter();
  const reference = await adapter.analyze(
    EvidTestSourceSnapshot.combine([
      EvidTestSourceSnapshot.create(
        "src/sale.go",
        dedent`
          package shop

          type Sale struct {
              Total int
          }
        ` + "\n",
      ),
      EvidTestSourceSnapshot.create(
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
    EvidTestSourceSnapshot.create(
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
  const resolutions = await EvidTestGraph.resolveDeclarations(
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
