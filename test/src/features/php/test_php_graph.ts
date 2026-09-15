import { EvidGraph, EvidPhpAdapter, EvidTypeScriptAdapter } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestGraph } from "../../internal/EvidTestGraph";
import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/**
 * Evaluates PHP selectors as required cross-language references.
 *
 * Selected PHP units need evidence, and a retained review alone must not cover
 * an obligation.
 *
 * 1. Extract PHP units and matching TypeScript claims for every selector.
 * 2. Evaluate present and absent acknowledgements.
 * 3. Verify review-only references remain missing.
 */
export async function test_php_graph(): Promise<void> {
  const reference = await new EvidPhpAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "src/Contract.php",
      dedent`
    <?php
    class Contract {}
    function run() { return 1; }
    const value = 1;
  `,
    ),
  );
  const claims = await new EvidTypeScriptAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "src/Claims.ts",
      dedent`
    /** @evidence ./Contract.php#Contract Verifies the type. */
    export class TypeClaim {}
    /** @evidence ./Contract.php#run Verifies the operation. */
    export function runClaim() {}
    /** @evidence ./Contract.php#value Verifies the value. */
    export const valueClaim = 1;
  `,
    ),
  );

  TestValidator.equals(
    "complete reference extraction",
    reference.diagnostics,
    [],
  );
  for (const symbol of ["type", "function", "property"] as const) {
    const unitIds = reference.units
      .filter((unit) => unit.symbol === symbol)
      .map((unit) => unit.id);
    TestValidator.equals(`undocumented ${symbol} selected`, unitIds.length, 1);
    for (const acknowledged of [true, false]) {
      const claim = structuredClone(claims);
      claim.declarations = acknowledged
        ? claim.declarations.filter((item) =>
            item.target.endsWith(
              symbol === "type"
                ? "#Contract"
                : symbol === "function"
                  ? "#run"
                  : "#value",
            ),
          )
        : [];
      const graph = EvidGraph.evaluate({
        claims: [
          {
            severity: "error",
            inventory: claim,
            unitIds: claim.units.map((unit) => unit.id),
            references: [
              {
                severity: "error",
                inventory: reference,
                unitIds,
                resolutions: await EvidTestGraph.resolveDeclarations(
                  claim,
                  reference,
                  unitIds,
                ),
              },
            ],
          },
        ],
      });
      TestValidator.equals(
        `${symbol} cross-language coverage ${acknowledged}`,
        graph.success,
        acknowledged,
      );
      TestValidator.equals(
        `${symbol} exact missing population`,
        EvidTestGraph.obligation(graph, 0, 0).missingUnitIds,
        acknowledged ? [] : unitIds,
      );
    }
  }
  const review = await new EvidPhpAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "src/Review.php",
      dedent`
    <?php
    /** @evidenceReview ./Contract.php#run Reviewed without an acknowledgement. */
    function review() { return 1; }
  `,
    ),
  );
  TestValidator.equals(
    "review is separate from evidence",
    review.declarations,
    [],
  );
  TestValidator.equals("review is retained", review.reviews.length, 1);
  const functions = reference.units
    .filter((unit) => unit.symbol === "function")
    .map((unit) => unit.id);
  const graph = EvidGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: review,
        unitIds: review.units.map((unit) => unit.id),
        references: [
          {
            severity: "error",
            inventory: reference,
            unitIds: functions,
            resolutions: [],
            reviewResolutions: await EvidTestGraph.resolveReviews(
              review,
              reference,
              functions,
            ),
          },
        ],
      },
    ],
  });
  TestValidator.equals(
    "review never supplies missing coverage",
    EvidTestGraph.obligation(graph, 0, 0).missingUnitIds,
    functions,
  );
}
